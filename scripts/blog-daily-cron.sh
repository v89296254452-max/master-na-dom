#!/usr/bin/env bash
cd /var/www/master-na-dom || exit 1
echo "===== $(date "+%Y-%m-%d %H:%M") ====="
node scripts/generate-blog-daily.mjs --count 3
pm2 reload master-na-dom master-na-dom-2 >/dev/null 2>&1
echo "reload ok, всего постов: $(($(wc -l < data/blog-posts.csv) - 1))"
