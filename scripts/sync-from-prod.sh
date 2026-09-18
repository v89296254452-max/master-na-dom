#!/usr/bin/env bash
# Скачать актуальный код и данные с прод-сервера в локальный проект.
# Исключает node_modules, .next, .git — после синка: npm ci && npm run build
set -euo pipefail

SERVER="root@45.130.43.157"
HOSTKEY="SHA256:uhJYre3O4USq3t7xTOl5TAUqFiIYbMZdkJ1eo5mW3Ag"
REMOTE="/var/www/master-na-dom"
ARCHIVE="/root/sync-from-prod.tgz"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== [1/4] pack on server =="
ssh -o StrictHostKeyChecking=accept-new "$SERVER" \
  "cd $REMOTE && tar czf $ARCHIVE --exclude='./node_modules' --exclude='./.next' --exclude='./.git' . && ls -lh $ARCHIVE"

echo "== [2/4] download =="
scp "$SERVER:$ARCHIVE" "$PROJECT_DIR/sync-from-prod.tgz"

echo "== [3/4] extract into project =="
cd "$PROJECT_DIR"
tar xzf sync-from-prod.tgz
rm -f sync-from-prod.tgz

echo "== [4/4] done =="
echo "Next: npm ci && npm run build && npm run start"
echo "Synced from $SERVER:$REMOTE"
