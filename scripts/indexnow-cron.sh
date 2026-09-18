#!/bin/bash
# Ежедневная отправка sitemap в IndexNow (Яндекс/Bing/Seznam) — cron 30 10 * * *.
set -a
. /var/www/master-na-dom/.env.local
set +a
cd /var/www/master-na-dom && node scripts/indexnow-submit.mjs
