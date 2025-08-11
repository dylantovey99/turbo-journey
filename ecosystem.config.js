module.exports = {
  apps: [
    {
      name: 'email-generator-api',
      script: 'dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      // Logging
      log_file: 'logs/pm2-combined.log',
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Process management
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      max_memory_restart: '1G',
      
      // Auto restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Health monitoring
      health_check_grace_period: 3000,
      
      // Environment variables
      source_map_support: true,
      
      // Node.js specific
      node_args: ['--max-old-space-size=2048']
    },
    {
      name: 'email-queue-worker',
      script: 'dist/workers/emailWorker.js',
      instances: 2,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'email'
      },
      env_production: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'email'
      },
      
      // Logging
      log_file: 'logs/pm2-email-worker-combined.log',
      out_file: 'logs/pm2-email-worker-out.log',
      error_file: 'logs/pm2-email-worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Process management
      watch: false,
      max_memory_restart: '800M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Graceful shutdown
      kill_timeout: 10000,
      
      // Node.js specific
      node_args: ['--max-old-space-size=1024']
    },
    {
      name: 'scraping-worker',
      script: 'dist/workers/scrapingWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'scraping'
      },
      env_production: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'scraping'
      },
      
      // Logging
      log_file: 'logs/pm2-scraping-worker-combined.log',
      out_file: 'logs/pm2-scraping-worker-out.log',
      error_file: 'logs/pm2-scraping-worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Process management
      watch: false,
      max_memory_restart: '1.5G', // Higher memory for Puppeteer
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      
      // Graceful shutdown (longer for browser cleanup)
      kill_timeout: 15000,
      
      // Node.js specific
      node_args: ['--max-old-space-size=2048']
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['production-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/email-generator.git',
      path: '/var/www/email-generator',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'ForwardAgent=yes'
    },
    staging: {
      user: 'deploy',
      host: ['staging-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-repo/email-generator.git',
      path: '/var/www/email-generator-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env development',
      env: {
        NODE_ENV: 'development'
      }
    }
  }
};