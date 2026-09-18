/** PM2 production config — 2 инстанса Next за nginx upstream (оба ядра).
 *  master-na-dom → :3000 (собирает контент-БД при старте), master-na-dom-2 → :3001. */
const base = {
  cwd: "/var/www/master-na-dom",
  script: "scripts/start-prod.sh",
  interpreter: "bash",
  max_memory_restart: "1G",
  autorestart: true,
  max_restarts: 20,
  min_uptime: "30s",
  restart_delay: 5000,
  exp_backoff_restart_delay: 200,
  kill_timeout: 15000,
  listen_timeout: 30000,
  merge_logs: true,
  time: true,
};

module.exports = {
  apps: [
    { ...base, name: "master-na-dom", env: { NODE_ENV: "production", PORT: "3000" } },
    { ...base, name: "master-na-dom-2", env: { NODE_ENV: "production", PORT: "3001" } },
  ],
};
