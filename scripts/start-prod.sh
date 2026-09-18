#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_ENV=production
export PORT="${PORT:-3000}"
# Слушаем только localhost — наружу сайт отдаёт nginx (SSL). Прямой доступ к
# :3000 в обход nginx закрыт (иначе данные/API доступны без TLS и авторизации).
export HOST="${HOST:-127.0.0.1}"
node scripts/guard-public-images.mjs

# Контент-БД (data/ai-content.db) — источник ИИ-текста в рантайме. Если её нет
# или она старше JSON-источников, пересобираем ДО старта. Иначе lib/ai-content.ts
# ушёл бы в JSON-fallback (риск OOM на 228МБ / отсутствие бренд-контента).
# Собирает только основной инстанс (:3000) — чтобы 2-й (:3001) не гонялся за БД.
if [ "$PORT" = "3000" ]; then
  DB=data/ai-content.db
  NEEDS_BUILD=0
  if [ ! -f "$DB" ]; then
    NEEDS_BUILD=1
  else
    for src in data/ai-content.json data/ai-content.brand.json data/ai-content.problems.json; do
      [ -f "$src" ] && [ "$src" -nt "$DB" ] && NEEDS_BUILD=1
    done
  fi
  if [ "$NEEDS_BUILD" = "1" ]; then
    echo "[start-prod] Пересборка ai-content.db..."
    node scripts/build-ai-content-db.mjs || { echo "[start-prod] СБОЙ сборки БД"; exit 1; }
  fi
fi

exec node node_modules/next/dist/bin/next start -H "$HOST" -p "$PORT"
