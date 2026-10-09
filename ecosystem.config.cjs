// PM2: roda o Next direto (sem o wrapper do npm) para que o processo filho
// morra junto com o PM2 e não fique segurando a porta 3008 (EADDRINUSE).
module.exports = {
  apps: [
    {
      name: "quadrante",
      cwd: "/home/true/quadrante/app",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3008",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
      min_uptime: "15s",
      restart_delay: 3000,
      kill_timeout: 8000,
    },
  ],
};
