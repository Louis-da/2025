module.exports = {
  apps: [{
    name: 'yunsf-app',
    script: 'app.js',
    cwd: '/root/processing-app/server',
    instances: 1, // 强制只运行一个实例
    exec_mode: 'fork', // 使用fork模式而不是cluster
    autorestart: true,
    watch: false, // 生产环境不监听文件变化
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    // 重启策略 - 防止无限重启
    max_restarts: 5, // 最多重启5次
    min_uptime: '10s', // 最少运行10秒才算成功启动
    restart_delay: 5000, // 重启延迟5秒
    // 停止策略
    kill_timeout: 5000,
    shutdown_with_message: true,
    wait_ready: true,
    listen_timeout: 10000,
    // 健康检查
    health_check_grace_period: 3000
  }],

  deploy: {
    production: {
      user: 'root',
      host: '175.178.33.180',
      ref: 'origin/main',
      repo: 'git@github.com:username/yunsf.git',
      path: '/root/processing-app',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
}; 