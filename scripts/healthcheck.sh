#!/usr/bin/env bash
# Auto-heal (cron, every 2 min): restart the app / nginx if the site stops responding.
# Never builds: builds happen only in scripts/deploy.sh, in a separate release directory.
set -uo pipefail

APP_NAME="master-na-dom"
APP_ROOT="/var/www/master-na-dom"
HEALTH_URL="http://127.0.0.1:3000/api/health"
LOG=/var/log/master-na-dom-health.log

log() { echo "$(date -Is) $*" | tee -a "$LOG"; }

# A deploy in progress restarts the app on purpose - don't fight it.
if ! flock -n "$APP_ROOT/.deploy.lock" true 2>/dev/null; then exit 0; fi

if ! systemctl is-active --quiet nginx; then
  log "nginx down - starting"
  systemctl start nginx || log "FAILED to start nginx"
fi

if curl -sf --max-time 15 "$HEALTH_URL" >/dev/null 2>&1; then
  exit 0
fi

log "Health check FAILED ($HEALTH_URL) - restarting $APP_NAME"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start "$APP_ROOT/current/ecosystem.config.cjs" --only "$APP_NAME"
fi
pm2 save >/dev/null

sleep 10
if curl -sf --max-time 15 "$HEALTH_URL" >/dev/null 2>&1; then
  log "Recovery OK"
else
  log "CRITICAL: site still down after restart - consider scripts/rollback.sh"
fi
