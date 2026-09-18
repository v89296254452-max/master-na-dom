#!/usr/bin/env bash
#
# Atomic release-based deploy for master-na-dom.online.
#
# Problem this solves (see docs/PRODUCTION-MEMORY-AUDIT.md): previously
# `npm run build` wrote into the SAME directory the live `next start`
# process was reading from, live. PM2 restarted mid-build into a partially
# written .next and crash-looped on ENOENT for prerender-manifest.json.
#
# Scheme:
#   /var/www/master-na-dom/
#     releases/<timestamp>/   - one full checkout + build per release
#     shared/                 - persistent data NOT duplicated per release
#                                (.env.local, ai-content.db, leads.db,
#                                 public/images/promaster, vk-assets, ...)
#     current -> releases/<timestamp>  (symlink, swapped atomically)
#
# Usage:
#   scripts/deploy.sh --dry-run      build + healthcheck a new release on a
#                                     temp port, then STOP. Never touches
#                                     `current`, PM2, or nginx. Safe to run
#                                     anytime, including against a live prod
#                                     that hasn't been migrated to this
#                                     layout yet (shared/ files are read via
#                                     symlink to their current live paths).
#   scripts/deploy.sh                full deploy: build, healthcheck on temp
#                                     port, atomic symlink swap, `pm2 reload`,
#                                     production healthcheck, auto-rollback
#                                     on failure. Requires the one-time
#                                     migration described in
#                                     docs/PRODUCTION-HARDENING-PLAN.md to
#                                     have already happened (APP_ROOT/current
#                                     must exist and ecosystem.config.cjs
#                                     must point PM2's cwd at it).
#
# Env overrides (all optional):
#   APP_ROOT (default /var/www/master-na-dom)
#   KEEP_RELEASES (default 3)
#   HEALTHCHECK_PORT (default 3005)
#   PM2_APP_NAME (default master-na-dom)
#   SOURCE_REF (default: current HEAD of APP_ROOT/.git, detached checkout)

set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/master-na-dom}"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
HEALTHCHECK_PORT="${HEALTHCHECK_PORT:-3005}"
PM2_APP_NAME="${PM2_APP_NAME:-master-na-dom}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
NEW_RELEASE="$RELEASES_DIR/$TIMESTAMP"

log() { echo "[deploy $(date '+%H:%M:%S')] $*"; }
die() { echo "[deploy $(date '+%H:%M:%S')] ERROR: $*" >&2; exit 1; }

cleanup_temp_server() {
  if [[ -n "${TEMP_PID:-}" ]] && kill -0 "$TEMP_PID" 2>/dev/null; then
    kill "$TEMP_PID" 2>/dev/null || true
    wait "$TEMP_PID" 2>/dev/null || true
  fi
}
trap cleanup_temp_server EXIT

# --- 0. Preconditions -------------------------------------------------------
[[ -d "$APP_ROOT/.git" ]] || die "$APP_ROOT is not a git checkout - can't determine what to deploy"
mkdir -p "$RELEASES_DIR" "$SHARED_DIR"

# One-time-ish: make sure shared/ has what it needs to exist, symlinked from
# wherever the live data currently lives. If shared/<name> already exists
# (real file/dir, already migrated), we leave it alone - never overwritten.
ensure_shared() {
  local name="$1" live_path="$2"
  local shared_path="$SHARED_DIR/$name"
  if [[ -e "$shared_path" || -L "$shared_path" ]]; then
    return 0
  fi
  if [[ -e "$live_path" ]]; then
    mkdir -p "$(dirname "$shared_path")"
    # Symlink FROM shared TO the current live path - does not move/copy the
    # live file, safe to run against a not-yet-migrated production tree.
    ln -s "$live_path" "$shared_path"
    log "shared/$name -> $live_path (symlinked, not moved)"
  else
    log "WARNING: $live_path not found, shared/$name will be unavailable in new releases"
  fi
}
ensure_shared ".env.local"            "$APP_ROOT/.env.local"
ensure_shared "data/ai-content.db"    "$APP_ROOT/data/ai-content.db"
ensure_shared "data/leads.db"         "$APP_ROOT/data/leads.db"
ensure_shared "data/vk-automation"    "$APP_ROOT/data/vk-automation"
ensure_shared "public/images/promaster" "$APP_ROOT/public/images/promaster"
ensure_shared "public/vk-assets"      "$APP_ROOT/public/vk-assets"
ensure_shared "public/dzen-images"    "$APP_ROOT/public/dzen-images"

# --- 1. Create new release directory ---------------------------------------
log "creating release $TIMESTAMP"
mkdir -p "$NEW_RELEASE"

SOURCE_REF="${SOURCE_REF:-$(git -C "$APP_ROOT" rev-parse HEAD)}"
git -C "$APP_ROOT" worktree add --detach "$NEW_RELEASE" "$SOURCE_REF" >/dev/null
log "checked out $SOURCE_REF into $NEW_RELEASE"

# --- 2. Link shared data into the new release -------------------------------
link_shared() {
  local name="$1"
  local shared_path="$SHARED_DIR/$name"
  local release_path="$NEW_RELEASE/$name"
  [[ -e "$shared_path" || -L "$shared_path" ]] || return 0
  mkdir -p "$(dirname "$release_path")"
  rm -rf "$release_path" # worktree checkout may have created an empty dir/gitignored placeholder
  ln -s "$shared_path" "$release_path"
}
link_shared ".env.local"
link_shared "data/ai-content.db"
link_shared "data/leads.db"
link_shared "data/vk-automation"
link_shared "public/images/promaster"
link_shared "public/vk-assets"
link_shared "public/dzen-images"

# --- 3. Install deps + build (in the NEW directory - live process untouched) -
# Fast path: if package-lock.json is byte-identical to the previous release's
# (i.e. dependencies didn't change), symlink node_modules instead of a full
# reinstall - the common case, and it's what makes deploys fast enough to use
# routinely instead of being tempted back to building in-place. Falls back to
# a real `npm install` (--include=dev: `next build` needs devDependencies -
# typescript, tailwind, eslint-config-next - and NODE_ENV=production during
# install would otherwise silently skip them) whenever the lockfile changed
# or no previous release exists yet.
PREV_FOR_DEPS="$(ls -1 "$RELEASES_DIR" 2>/dev/null | sort -r | grep -v "^$TIMESTAMP$" | head -1 || true)"
REUSED_NODE_MODULES=0
if [[ -n "$PREV_FOR_DEPS" ]] && [[ -d "$RELEASES_DIR/$PREV_FOR_DEPS/node_modules" ]] \
   && cmp -s "$NEW_RELEASE/package-lock.json" "$RELEASES_DIR/$PREV_FOR_DEPS/package-lock.json" 2>/dev/null; then
  log "package-lock.json unchanged since $PREV_FOR_DEPS - reusing node_modules (symlink)"
  ln -s "$RELEASES_DIR/$PREV_FOR_DEPS/node_modules" "$NEW_RELEASE/node_modules"
  REUSED_NODE_MODULES=1
else
  log "npm install (lockfile changed or no prior release - full install)"
  (cd "$NEW_RELEASE" && npm install --include=dev > "$NEW_RELEASE/.deploy-install.log" 2>&1) || die "npm install failed, see $NEW_RELEASE/.deploy-install.log"
fi

log "build"
(cd "$NEW_RELEASE" && NODE_ENV=production npm run build) || die "build failed"

# --- 4. Verify build artifacts before going any further ---------------------
for f in ".next/BUILD_ID" ".next/prerender-manifest.json" ".next/routes-manifest.json"; do
  [[ -f "$NEW_RELEASE/$f" ]] || die "build artifact missing: $f - refusing to healthcheck a broken build"
done
log "build artifacts present (BUILD_ID, prerender-manifest.json, routes-manifest.json)"

# --- 5. tests (lint/typecheck) ----------------------------------------------
(cd "$NEW_RELEASE" && npx tsc --noEmit -p tsconfig.json) || die "typecheck failed"
log "typecheck OK"

# --- 6. Boot the new release on a temp port, healthcheck --------------------
log "starting temp instance on port $HEALTHCHECK_PORT"
(cd "$NEW_RELEASE" && NODE_ENV=production PORT="$HEALTHCHECK_PORT" HOST=127.0.0.1 \
  node node_modules/next/dist/bin/next start -H 127.0.0.1 -p "$HEALTHCHECK_PORT" \
  > "$NEW_RELEASE/.deploy-boot.log" 2>&1 &)
TEMP_PID=""
for i in $(seq 1 30); do
  sleep 1
  PID="$(ss -tlnp 2>/dev/null | grep ":$HEALTHCHECK_PORT " | grep -oP 'pid=\K[0-9]+' || true)"
  [[ -n "$PID" ]] && { TEMP_PID="$PID"; break; }
done
[[ -n "$TEMP_PID" ]] || die "temp instance never bound port $HEALTHCHECK_PORT - see $NEW_RELEASE/.deploy-boot.log"

if ! node "$NEW_RELEASE/scripts/healthcheck.mjs" --base="http://127.0.0.1:$HEALTHCHECK_PORT"; then
  die "healthcheck failed against new release on temp port $HEALTHCHECK_PORT"
fi
log "healthcheck OK on temp port $HEALTHCHECK_PORT"

cleanup_temp_server
TEMP_PID=""

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY RUN: build + healthcheck passed. NOT switching current, NOT touching PM2/nginx."
  log "Release kept at $NEW_RELEASE for inspection (not auto-cleaned in dry-run mode)."
  exit 0
fi

# --- 7. Atomic symlink swap --------------------------------------------------
[[ -d "$RELEASES_DIR" ]] || die "no releases dir - has the one-time migration happened? see docs/PRODUCTION-HARDENING-PLAN.md"
PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
log "switching current -> $NEW_RELEASE (previous: ${PREVIOUS_RELEASE:-none})"
ln -sfn "$NEW_RELEASE" "$CURRENT_LINK.tmp"
mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"

# --- 8. PM2 reload + production healthcheck, auto-rollback on failure ------
log "pm2 reload $PM2_APP_NAME"
if ! pm2 reload "$PM2_APP_NAME" --update-env; then
  log "pm2 reload failed - rolling back"
  [[ -n "$PREVIOUS_RELEASE" ]] && { ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK.tmp"; mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"; pm2 reload "$PM2_APP_NAME" --update-env || true; }
  die "deploy failed at pm2 reload, rolled back to $PREVIOUS_RELEASE"
fi

sleep 2
if ! node "$NEW_RELEASE/scripts/healthcheck.mjs" --base="http://127.0.0.1:3000"; then
  log "production healthcheck failed after switch - rolling back"
  if [[ -n "$PREVIOUS_RELEASE" ]]; then
    ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK.tmp"
    mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"
    pm2 reload "$PM2_APP_NAME" --update-env || true
  fi
  die "deploy failed post-switch healthcheck, rolled back to $PREVIOUS_RELEASE"
fi
log "production healthcheck OK - deploy complete ($TIMESTAMP)"

# --- 9. Prune old releases (keep last $KEEP_RELEASES) -----------------------
mapfile -t OLD_RELEASES < <(ls -1 "$RELEASES_DIR" | sort -r | tail -n +$((KEEP_RELEASES + 1)))
for r in "${OLD_RELEASES[@]:-}"; do
  [[ -z "$r" ]] && continue
  log "pruning old release $r"
  git -C "$APP_ROOT" worktree remove --force "$RELEASES_DIR/$r" 2>/dev/null || rm -rf "$RELEASES_DIR/$r"
done

log "done. current -> $NEW_RELEASE"
