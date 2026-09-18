#!/usr/bin/env bash
#
# Forced command for the GitHub Actions deploy key. Installed on the server as
# /usr/local/sbin/mnd-ci-deploy and referenced from /root/.ssh/authorized_keys:
#
#   command="/usr/local/sbin/mnd-ci-deploy",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA... github-actions
#
# The key can do nothing except: `deploy <sha>` / `dry-run <sha>`, where <sha> must be a
# commit that is already on GitHub's main. The deploy script that runs is the one from
# that same commit, so deploy logic ships together with the code.

set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/master-na-dom}"
LOG=/var/log/mnd-deploy.log

cmd="${SSH_ORIGINAL_COMMAND:-}"
if [[ ! "$cmd" =~ ^(deploy|dry-run)\ ([0-9a-f]{40})$ ]]; then
  echo "usage: deploy <40-hex-sha> | dry-run <40-hex-sha>" >&2
  exit 2
fi
mode="${BASH_REMATCH[1]}"
sha="${BASH_REMATCH[2]}"

exec > >(tee -a "$LOG") 2>&1
echo "=== $(date -Is) $mode $sha ==="

git -C "$APP_ROOT" fetch --quiet --prune origin main
git -C "$APP_ROOT" cat-file -e "$sha^{commit}" 2>/dev/null || { echo "commit $sha not found on origin"; exit 3; }
git -C "$APP_ROOT" merge-base --is-ancestor "$sha" origin/main || { echo "commit $sha is not on origin/main"; exit 4; }

script="$(mktemp /tmp/mnd-deploy.XXXXXX.sh)"
trap 'rm -f "$script"' EXIT
git -C "$APP_ROOT" show "$sha:scripts/deploy.sh" > "$script"

args=()
[[ "$mode" == "dry-run" ]] && args=(--dry-run)
SOURCE_REF="$sha" bash "$script" "${args[@]}"
