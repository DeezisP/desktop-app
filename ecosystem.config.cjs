module.exports = {
  apps: [
    {
      name: 'desktop-warehouse',
      script: 'npm',
      args: 'run dev',
      cwd: '/var/www/desktop-warehouse',
      env: {
        ELECTRON_SKIP_LAUNCH: '1',
      },
      restart_delay: 3000,
      max_restarts: 5,
    },
  ],
}
