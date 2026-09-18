# Деплой через GitHub

Источник правды — GitHub (`main`). Прод получает код только через конвейер ниже; правки прямо на сервере (`scp`, редактирование в Cursor по SSH) больше не деплой — их перетрёт следующий релиз.

```
git push origin main
      │
      ▼
GitHub Actions ── verify (npm ci + tsc) ── deploy ── ssh root@VPS "deploy <sha>"
                                                              │  (ключ умеет ТОЛЬКО это)
                                                              ▼
                                            /usr/local/sbin/mnd-ci-deploy  (scripts/ci-deploy.sh)
                                                              │  fetch origin/main, проверка что sha на main
                                                              ▼
                                            scripts/deploy.sh (из того же коммита)
                                              1. git worktree → releases/<время>/
                                              2. shared/* (БД, .env.local, картинки) → симлинки
                                              3. npm ci (кэш по хешу lock-файла в shared/node_modules-*)
                                              4. next build В НОВОЙ папке (боевой процесс не затронут)
                                              5. tsc + запуск на временном порту 3005 + healthcheck
                                              6. атомарная смена симлинка current → pm2 restart
                                              7. healthcheck на :3000, при провале — автооткат
```

## Структура на сервере (`/var/www/master-na-dom`)

| Путь | Что это |
|---|---|
| `current` → `releases/<ts>` | то, что сейчас обслуживает PM2 (cwd процесса) |
| `releases/` | последние 3 релиза (`.release-sha` внутри — какой коммит) |
| `shared/` | всё, чего нет в git: `.env.local`, `data/*.db`, VK-состояние, `public/vk-assets`, `public/dzen-images`, `node_modules-<hash>` |
| `.git` | «контрольный» репозиторий, только `fetch` и `worktree` |
| остальное в корне | старое боевое дерево (до переезда). Пока `shared/*` — симлинки на него, **не удалять** |

Что живёт только на сервере и никогда не коммитится (`.gitignore`): SQLite-базы (`ai-content.db`, `leads.db`, `vk-automation.db`), `data/vk-*.json`, `.env*`, рабочие папки ZennoPoster (`ДМ1`), `public/vk-assets`, `public/dzen-images`.

## Разовая настройка GitHub (делает владелец репозитория)

Репозиторий → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Значение |
|---|---|
| `DEPLOY_HOST` | `45.130.43.157` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | содержимое приватного ключа `mnd_github_deploy` (файл лежит на машине, где настраивали деплой; после копирования — удалить) |
| `DEPLOY_KNOWN_HOSTS` | строка(и) `known_hosts` сервера (`ssh-keyscan -t ed25519 45.130.43.157`) |

Публичная часть ключа уже стоит на сервере в `/root/.ssh/authorized_keys` с ограничением `command="/usr/local/sbin/mnd-ci-deploy"` — этим ключом нельзя получить shell, только запустить деплой коммита, который уже лежит в `origin/main`.

Если репозиторий станет **приватным**, серверу нужен доступ на чтение: сгенерировать `ssh-keygen -t ed25519 -f /root/.ssh/github_ro`, добавить `.pub` в Settings → Deploy keys (read-only), затем `git -C /var/www/master-na-dom remote set-url origin git@github.com:<owner>/<repo>.git` и запись в `/root/.ssh/config` (`Host github.com` / `IdentityFile /root/.ssh/github_ro`).

## Повседневная работа

* Выкатить: смержить в `main` (или `git push origin main`). Прогресс — вкладка Actions. Лог на сервере: `/var/log/mnd-deploy.log`.
* Проверка без выкатки: `ssh … "dry-run <sha>"` или локально на сервере `scripts/deploy.sh --dry-run` (собирает и проверяет релиз на порту 3005, `current` и PM2 не трогает).
* Откат: `bash /var/www/master-na-dom/current/scripts/rollback.sh` (предыдущий релиз) или `… rollback.sh <ts>`; `--list` — список. Автоматически откатывается сам, если после смены не прошёл healthcheck.
* Деплой занимает ~3–5 минут; сайт перезапускается один раз (несколько секунд, nginx-микрокэш отдаёт горячие страницы).

## Что важно помнить

* Изменения контента БД (например, импорт AI-текстов в `ai-content.db`) — это данные, а не код: они не проходят через git и не откатываются `rollback.sh`. Перед записью делать бэкап (скрипты импорта это делают).
* Cron-задачи (`indexnow-cron.sh`, `yandex-recrawl.mjs`, `blog-daily-cron.sh`) по-прежнему запускаются из старого дерева в корне. `healthcheck.sh` переведён на `current`.
* `scripts/start-prod.sh` больше не пересобирает `ai-content.db` при старте (только при `AI_DB_AUTOBUILD=1`): в свежем релизе исходные JSON новее БД, и прежняя логика затирала бы БД.
