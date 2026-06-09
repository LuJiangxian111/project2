module.exports = {
  apps: [
    {
      name: 'ai-position-backend',
      script: 'dist/main.js',
      cwd: '/www/ai-position/server',
      env: {
        NODE_ENV: 'production',
        DB_TYPE: 'mysql',
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_USERNAME: 'ai_position',
        DB_PASSWORD: 'CHANGE_ME_STRONG_PASSWORD',
        DB_DATABASE: 'ai_position_square',
        JWT_SECRET: 'CHANGE_ME_TO_RANDOM_32_CHARS_STRING',
        CORS_ORIGIN: '*',
        HOST: '0.0.0.0',
        PORT: '3000',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/www/ai-position/logs/backend-error.log',
      out_file: '/www/ai-position/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};