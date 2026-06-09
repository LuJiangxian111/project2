#!/bin/bash
# ============================================
# 腾讯云服务器环境初始化脚本
# 适用系统：Ubuntu 20.04 / 22.04 / 24.04
# 使用方法：sudo bash init-server.sh
# ============================================

set -e

echo "========================================="
echo "  AI岗位需求广场 - 服务器环境初始化"
echo "========================================="

# 1. 更新系统
echo "[1/6] 更新系统软件包..."
apt update && apt upgrade -y

# 2. 安装 Node.js 18
echo "[2/6] 安装 Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
node -v
npm -v

# 3. 安装 PM2
echo "[3/6] 安装 PM2 进程管理器..."
npm install -g pm2
pm2 startup
pm2 save

# 4. 安装 MySQL 8.0
echo "[4/6] 安装 MySQL 8.0..."
apt install -y mysql-server

# 启动 MySQL
systemctl start mysql
systemctl enable mysql

# 创建数据库和用户
echo "请设置数据库密码（建议使用强密码）："
read -s DB_PASSWORD
echo

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ai_position_square CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'ai_position'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ai_position_square.* TO 'ai_position'@'localhost';
FLUSH PRIVILEGES;
EOF

echo "数据库创建成功！"

# 5. 安装 Nginx
echo "[5/6] 安装 Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# 6. 创建项目目录
echo "[6/6] 创建项目目录..."
mkdir -p /www/ai-position/server
mkdir -p /www/ai-position/frontend
mkdir -p /www/ai-position/logs

echo ""
echo "========================================="
echo "  环境初始化完成！"
echo "========================================="
echo ""
echo "已安装组件："
echo "  - Node.js: $(node -v)"
echo "  - npm: $(npm -v)"
echo "  - PM2: $(pm2 -v)"
echo "  - MySQL: $(mysql --version)"
echo "  - Nginx: $(nginx -v 2>&1)"
echo ""
echo "数据库信息："
echo "  - 数据库名: ai_position_square"
echo "  - 用户名: ai_position"
echo "  - 密码: 你设置的密码"
echo ""
echo "下一步：运行 bash deploy.sh 部署应用"