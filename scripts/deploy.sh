#!/usr/bin/env bash
#
# Atomic release-based deploy for master-na-dom.online. Source of truth: GitHub.
#
#   /var/www/master-na-dom/
#     .git                     control repo (only used to fetch + create worktrees)
#     releases/<timestamp>/    one checkout + build per release (git worktree)
#     shared/                  persistent, NOT in git: .env.local, SQLite DBs, VK state,
#                              user-generated images, node_modules-<lockhash>/
#     current -> releases/<timestamp>   (symlink, swapped atomically)
#
# Usage:
#   scripts/deploy.sh --dry-run   fetch + build + healthcheck a new release on a temp
#                                  port, then STOP. Never touches current/PM2/nginx.
#   scripts/deploy.sh             full deploy: build, healthcheck on temp port, atomic
#                                  swap of `current`, PM2 restart, production
#                                  healthcheck, automatic rollback on failure.
#
# Normally it is invoked by GitHub Actions through scripts/ci-deploy.sh (see docs/DEPLOY.md).
#
# Env overrides (all optional):
#   APP_ROOT          default /var/www/master-na-dom
#   DEPLOY_REMOTE     default origin
#   DEPLOY_BRANCH     default main
#   SOURCE_REF        default $DEPLOY_REMOTE/$DEPLOY_BRANCH. A given ref must be an ancestor of
#                     origin/main unless ALLOW_ANY_REF=1 (used for pre-merge testing).
#   KEEP_RELEASES     default 3
#   HEALTHCHECK_PORT  default 3005
#   PM2_APP_NAME      default master-na-dom

set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/master-na-dom}"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
HEALTHCHECK_PORT="${HEALTHCHECK_PORT:-3005}"
PM2_APP_NAME="${PM2_APP_NAME:-master-na-dom}"
DEPLOY_REMOTE="${DEPLOY_REMOTE:-origin}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
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

# --- 0. Preconditions --------------------------------------------------------
[[ -d "$APP_ROOT/.git" ]] || die "$APP_ROOT is not a git checkout"
mkdir -p "$RELEASES_DIR" "$SHARED_DIR"

exec 9>"$APP_ROOT/.deploy.lock"
flock -n 9 || die "another deploy is already running"

git -C "$APP_ROOT" worktree prune

log "fetching $DEPLOY_REMOTE/$DEPLOY_BRANCH"
git -C "$APP_ROOT" fetch --quiet --prune "$DEPLOY_REMOTE" "$DEPLOY_BRANCH"

SOURCE_REF="${SOURCE_REF:-$DEPLOY_REMOTE/$DEPLOY_BRANCH}"
SOURCE_SHA="$(git -C "$APP_ROOT" rev-parse --verify "$SOURCE_REF^{commit}")" || die "cannot resolve $SOURCE_REF"
if [[ "${ALLOW_ANY_REF:-0}" != "1" ]]; then
  git -C "$APP_ROOT" merge-base --is-ancestor "$SOURCE_SHA" "$DEPLOY_REMOTE/$DEPLOY_BRANCH" \
    || die "$SOURCE_SHA is not on $DEPLOY_REMOTE/$DEPLOY_BRANCH (set ALLOW_ANY_REF=1 to override)"
fi
log "deploying $SOURCE_SHA ($(git -C "$APP_ROOT" log -1 --format=%s "$SOURCE_SHA"))"

# --- 1. Shared, persistent, non-git files -----------------------------------
# name relative to the project root. If shared/<name> does not exist yet it is created as a
# symlink to the current live path (never moved/copied), so this works against a server
# that has not been migrated yet, and against one that has.
SHARED_ITEMS=(
  ".env.local"
  "data/ai-content.db"
  "data/leads.db"
  "data/recrawl-cursor.json"
  "data/vk-automation"
  "data/vk-accounts.json"
  "data/vk-account-merge.json"
  "data/vk-tasks.json"
  "data/vk-plan.csv"
  "data/vk-task-log.json"
  "data/vk-url-bind-batches.json"
  "data/vk-unparsed-urls.json"
  "data/vk-automation-queue.json"
  "data/vk-content-templates.json"
  "data/vk-visual-templates.json"
  "public/images/promaster"
  "public/vk-assets"
  "public/dzen-images"
)

ensure_shared() {
  local name="$1" live_path="$APP_ROOT/$1" shared_path="$SHARED_DIR/$1"
  if [[ -e "$shared_path" || -L "$shared_path" ]]; then return 0; fi
  if [[ -e "$live_path" ]]; then
    mkdir -p "$(dirname "$shared_path")"
    ln -s "$live_path" "$shared_path"
    log "shared/$name -> $live_path (symlinked, not moved)"
  else
    log "note: $live_path not found, shared/$name will be unavailable in new releases"
  fi
}
for item in "${SHARED_ITEMS[@]}"; do ensure_shared "$item"; done

# --- 2. New release directory ------------------------------------------------
log "creating release $TIMESTAMP"
git -C "$APP_ROOT" worktree add --detach "$NEW_RELEASE" "$SOURCE_SHA" >/dev/null
echo "$SOURCE_SHA" > "$NEW_RELEASE/.release-sha"

for item in "${SHARED_ITEMS[@]}"; do
  shared_path="$SHARED_DIR/$item"
  [[ -e "$shared_path" || -L "$shared_path" ]] || continue
  mkdir -p "$(dirname "$NEW_RELEASE/$item")"
  rm -rf "$NEW_RELEASE/$item"
  ln -s "$shared_path" "$NEW_RELEASE/$item"
done

# --- 3. Dependencies (cached by lockfile hash, lives in shared/) ------------
LOCK_HASH="$(sha256sum "$NEW_RELEASE/package-lock.json" | cut -c1-12)"
NM_DIR="$SHARED_DIR/node_modules-$LOCK_HASH"
if [[ -d "$NM_DIR" ]]; then
  log "package-lock unchanged ($LOCK_HASH) - reusing $NM_DIR"
else
  log "npm ci (new lockfile $LOCK_HASH)"
  # devDependencies are required by `next build` (typescript, tailwind, ...).
  (cd "$NEW_RELEASE" && npm ci --include=dev --no-audit --no-fund > "$NEW_RELEASE/.deploy-install.log" 2>&1) \
    || die "npm ci failed, see $NEW_RELEASE/.deploy-install.log"
  mv "$NEW_RELEASE/node_modules" "$NM_DIR"
fi
ln -s "$NM_DIR" "$NEW_RELEASE/node_modules"

# --- 4. Build in the NEW directory - the live process is untouched ----------
log "build"
(cd "$NEW_RELEASE" && NODE_ENV=production npm run build) || die "build failed"

for f in ".next/BUILD_ID" ".next/prerender-manifest.json" ".next/routes-manifest.json"; do
  [[ -f "$NEW_RELEASE/$f" ]] || die "build artifact missing: $f"
done
log "build artifacts present"

(cd "$NEW_RELEASE" && npx tsc --noEmit -p tsconfig.json) || die "typecheck failed"
log "typecheck OK"

# --- 5. Boot the new release on a temp port and healthcheck ------------------
log "starting temp instance on port $HEALTHCHECK_PORT"
(cd "$NEW_RELEASE" && NODE_ENV=production PORT="$HEALTHCHECK_PORT" HOST=127.0.0.1 \
  node node_modules/next/dist/bin/next start -H 127.0.0.1 -p "$HEALTHCHECK_PORT" \
  > "$NEW_RELEASE/.deploy-boot.log" 2>&1 &)
TEMP_PID=""
for _ in $(seq 1 30); do
  sleep 1
  PID="$(ss -tlnp 2>/dev/null | grep ":$HEALTHCHECK_PORT " | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
  [[ -n "$PID" ]] && { TEMP_PID="$PID"; break; }
done
[[ -n "$TEMP_PID" ]] || die "temp instance never bound port $HEALTHCHECK_PORT - see $NEW_RELEASE/.deploy-boot.log"

node "$NEW_RELEASE/scripts/healthcheck.mjs" --base="http://127.0.0.1:$HEALTHCHECK_PORT" \
  || die "healthcheck failed against new release on temp port $HEALTHCHECK_PORT"
log "healthcheck OK on temp port $HEALTHCHECK_PORT"
cleanup_temp_server
TEMP_PID=""

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY RUN finished: build + healthcheck passed. current/PM2/nginx were NOT touched."
  log "Release kept at $NEW_RELEASE"
  exit 0
fi

# --- 6. Atomic swap + PM2 restart, automatic rollback ------------------------
pm2_cwd() {
  pm2 jlist 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      try { const a = JSON.parse(s).find(p => p.name === process.argv[1]); process.stdout.write(a ? a.pm2_env.pm_cwd : ""); } catch {}
    });' "$PM2_APP_NAME"
}
wait_healthy() {
  for _ in $(seq 1 45); do
    curl -sf --max-time 5 "http://127.0.0.1:3000/api/health" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
OLD_PM2_CWD="$(pm2_cwd)"
MIGRATING=0
[[ "$OLD_PM2_CWD" != "$CURRENT_LINK" ]] && MIGRATING=1

swap_current() {
  ln -sfn "$1" "$CURRENT_LINK.tmp"
  mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"
}

restart_app() {
  if [[ "$MIGRATING" == "1" ]]; then
    log "ONE-TIME MIGRATION: PM2 cwd ${OLD_PM2_CWD:-<none>} -> $CURRENT_LINK"
    pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
    pm2 start "$CURRENT_LINK/ecosystem.config.cjs" --only "$PM2_APP_NAME"
    pm2 save >/dev/null
  else
    pm2 reload "$PM2_APP_NAME" --update-env
  fi
}

rollback() {
  log "ROLLING BACK"
  if [[ "$MIGRATING" == "1" ]]; then
    pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
    if [[ -n "$OLD_PM2_CWD" && -f "$OLD_PM2_CWD/ecosystem.config.cjs" ]]; then
      (cd "$OLD_PM2_CWD" && pm2 start ecosystem.config.cjs --only "$PM2_APP_NAME") || true
      pm2 save >/dev/null || true
    fi
  elif [[ -n "$PREVIOUS_RELEASE" ]]; then
    swap_current "$PREVIOUS_RELEASE"
    pm2 reload "$PM2_APP_NAME" --update-env || true
  fi
}

log "switching current -> $NEW_RELEASE (previous: ${PREVIOUS_RELEASE:-none})"
swap_current "$NEW_RELEASE"

if ! restart_app; then
  rollback
  die "deploy failed at PM2 restart, rolled back"
fi

if ! wait_healthy || ! node "$NEW_RELEASE/scripts/healthcheck.mjs" --base="http://127.0.0.1:3000"; then
  rollback
  die "deploy failed post-switch healthcheck, rolled back"
fi
log "production healthcheck OK - deploy complete ($TIMESTAMP, $SOURCE_SHA)"
echo "$(date -Is) $TIMESTAMP $SOURCE_SHA" >> "$SHARED_DIR/deploy-history.log"

# --- 7. Prune old releases + unreferenced node_modules ----------------------
mapfile -t OLD_RELEASES < <(ls -1 "$RELEASES_DIR" | sort -r | tail -n +$((KEEP_RELEASES + 1)))
for r in "${OLD_RELEASES[@]:-}"; do
  [[ -z "$r" ]] && continue
  log "pruning old release $r"
  git -C "$APP_ROOT" worktree remove --force "$RELEASES_DIR/$r" 2>/dev/null || rm -rf "$RELEASES_DIR/$r"
done
for nm in "$SHARED_DIR"/node_modules-*; do
  [[ -d "$nm" ]] || continue
  in_use=0
  for rel in "$RELEASES_DIR"/*; do
    [[ "$(readlink -f "$rel/node_modules" 2>/dev/null)" == "$(readlink -f "$nm")" ]] && { in_use=1; break; }
  done
  [[ "$in_use" == "0" ]] && { log "pruning unused $(basename "$nm")"; rm -rf "$nm"; }
done

log "done. current -> $NEW_RELEASE"
