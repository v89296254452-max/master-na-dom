#!/usr/bin/env bash
#
# Manual rollback: point `current` at a specific (or the previous) release
# and reload PM2. deploy.sh already does this automatically on a failed
# deploy - this script is for rolling back an already-live release that
# turned out to have a problem after the fact (e.g. a content bug found
# after deploy finished and healthchecks passed).
#
# Usage:
#   scripts/rollback.sh                 # roll back to the release before current
#   scripts/rollback.sh 20260916-091530 # roll back to a specific release
#   scripts/rollback.sh --list          # list available releases

set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/master-na-dom}"
RELEASES_DIR="$APP_ROOT/releases"
CURRENT_LINK="$APP_ROOT/current"
PM2_APP_NAME="${PM2_APP_NAME:-master-na-dom}"

log() { echo "[rollback $(date '+%H:%M:%S')] $*"; }
die() { echo "[rollback $(date '+%H:%M:%S')] ERROR: $*" >&2; exit 1; }

[[ -d "$RELEASES_DIR" ]] || die "no releases dir at $RELEASES_DIR - nothing to roll back"

if [[ "${1:-}" == "--list" ]]; then
  CUR="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
  for r in $(ls -1 "$RELEASES_DIR" | sort -r); do
    mark=""
    [[ "$RELEASES_DIR/$r" == "$CUR" ]] && mark=" (current)"
    echo "$r$mark"
  done
  exit 0
fi

CURRENT_TARGET="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
[[ -n "$CURRENT_TARGET" ]] || die "current symlink not set - nothing to roll back from"

if [[ -n "${1:-}" ]]; then
  TARGET_RELEASE="$RELEASES_DIR/$1"
  [[ -d "$TARGET_RELEASE" ]] || die "release $1 not found under $RELEASES_DIR (use --list)"
else
  # Previous = most recent release directory that isn't the current one.
  TARGET_RELEASE=""
  for r in $(ls -1 "$RELEASES_DIR" | sort -r); do
    candidate="$RELEASES_DIR/$r"
    if [[ "$candidate" != "$CURRENT_TARGET" ]]; then
      TARGET_RELEASE="$candidate"
      break
    fi
  done
  [[ -n "$TARGET_RELEASE" ]] || die "no other release available to roll back to"
fi

log "rolling back current: $CURRENT_TARGET -> $TARGET_RELEASE"
ln -sfn "$TARGET_RELEASE" "$CURRENT_LINK.tmp"
mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"

log "pm2 reload $PM2_APP_NAME"
pm2 reload "$PM2_APP_NAME" --update-env

sleep 2
if node "$TARGET_RELEASE/scripts/healthcheck.mjs" --base="http://127.0.0.1:3000"; then
  log "rollback complete, healthcheck OK: current -> $TARGET_RELEASE"
else
  log "WARNING: rollback switched current but healthcheck failed - investigate manually, do not assume this is fixed"
  exit 1
fi
