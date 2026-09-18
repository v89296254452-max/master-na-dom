/**
 * PM2 production config.
 *
 * cwd is the `current` symlink of the release layout (see scripts/deploy.sh):
 * every restart resolves it to the release that is live at that moment.
 * Single instance on :3000 behind nginx (nginx upstream has only 127.0.0.1:3000).
 */
module.exports = {
  apps: [
    {
      name: "master-na-dom",
      cwd: "/var/www/master-na-dom/current",
      script: "scripts/start-prod.sh",
      interpreter: "bash",
      env: { NODE_ENV: "production", PORT: "3000" },
      max_memory_restart: "900M",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "30s",
      restart_delay: 5000,
      exp_backoff_restart_delay: 200,
      kill_timeout: 15000,
      listen_timeout: 30000,
      merge_logs: true,
      time: true,
    },
  ],
};
