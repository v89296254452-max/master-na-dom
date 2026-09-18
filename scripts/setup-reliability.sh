#!/usr/bin/env bash
# One-time server setup: PM2 ecosystem + cron healthcheck + nginx hardening.
set -euo pipefail

APP_DIR="/var/www/master-na-dom"
APP_NAME="master-na-dom"

echo "== [1/5] make scripts executable =="
chmod +x "$APP_DIR/scripts/start-prod.sh"
chmod +x "$APP_DIR/scripts/healthcheck.sh"

echo "== [2/5] switch PM2 to ecosystem config =="
cd "$APP_DIR"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs --only "$APP_NAME"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo "== [3/5] install cron healthcheck (every 2 min) =="
CRON_LINE="*/2 * * * * $APP_DIR/scripts/healthcheck.sh >> /var/log/master-na-dom-health.log 2>&1"
(crontab -l 2>/dev/null | grep -Fv "healthcheck.sh"; echo "$CRON_LINE") | crontab -
echo "cron installed: $CRON_LINE"

echo "== [4/5] nginx config =="
cat > /etc/nginx/sites-available/master-na-dom <<'NGINX'
upstream nextjs_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 443 ssl;
    server_name master-na-dom.online www.master-na-dom.online 45.130.43.157;

    client_max_body_size 50M;

    ssl_certificate /etc/letsencrypt/live/master-na-dom.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/master-na-dom.online/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Health endpoint for monitoring (no cache)
    location = /api/health {
        proxy_pass http://nextjs_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        access_log off;
    }

    location / {
        proxy_pass http://nextjs_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_next_upstream_tries 2;
    }
}

server {
    listen 80;
    server_name master-na-dom.online www.master-na-dom.online 45.130.43.157;
    return 301 https://master-na-dom.online$request_uri;
}
NGINX

nginx -t
systemctl reload nginx
systemctl enable nginx

echo "== [5/5] verify =="
sleep 4
curl -sf http://127.0.0.1:3000/api/health && echo " — health OK"
curl -sI http://127.0.0.1:3000/ | head -1
curl -sI https://master-na-dom.online/ | head -1
pm2 status
echo "RELIABILITY_SETUP_DONE"
