#!/usr/bin/env bash
# Auto-heal: restart app/nginx if site stops responding.
set -uo pipefail

APP_NAME="master-na-dom"
APP_DIR="/var/www/master-na-dom"
HEALTH_URL="http://127.0.0.1:3000/api/health"
LOG_TAG="master-na-dom-health"
MAX_LOG=/var/log/master-na-dom-health.log

log() {
  echo "$(date -Is) $*" | tee -a "$MAX_LOG"
}

# Ensure nginx is running
if ! systemctl is-active --quiet nginx; then
  log "nginx down — starting"
  systemctl start nginx || log "FAILED to start nginx"
fi

# Check Next.js health endpoint
if curl -sf --max-time 15 "$HEALTH_URL" >/dev/null 2>&1; then
  exit 0
fi

log "Health check FAILED ($HEALTH_URL) — restarting $APP_NAME"

cd "$APP_DIR" || exit 1

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.cjs --only "$APP_NAME"
fi

pm2 save

sleep 8

if curl -sf --max-time 15 "$HEALTH_URL" >/dev/null 2>&1; then
  log "Recovery OK"
  exit 0
fi

log "Recovery FAILED — attempting full rebuild"
NODE_OPTIONS=--max-old-space-size=2048 npm run build >>"$MAX_LOG" 2>&1 || true
pm2 restart "$APP_NAME" --update-env
pm2 save

sleep 8

if curl -sf --max-time 15 "$HEALTH_URL" >/dev/null 2>&1; then
  log "Recovery after rebuild OK"
else
  log "CRITICAL: site still down after rebuild"
fi
