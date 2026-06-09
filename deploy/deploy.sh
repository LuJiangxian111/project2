#!/bin/bash
# ============================================
# AI岗位需求广场 - 一键部署脚本
# 在本地电脑运行，自动上传代码到服务器并部署
#
# 使用方法：
#   1. 修改下方服务器配置
#   2. bash deploy.sh
# ============================================

# ========== 服务器配置（请修改） ==========
SERVER_IP="你的服务器IP"          # 腾讯云服务器公网IP
SERVER_USER="root"                # SSH 用户名
SERVER_DIR="/www/ai-position"     # 项目部署目录
DB_PASSWORD="你的数据库密码"       # 数据库密码（与初始化时一致）
JWT_SECRET="你的JWT密钥至少32位"   # JWT 密钥
# ==========================================

set -e

echo "========================================="
echo "  AI岗位需求广场 - 开始部署"
echo "========================================="

# 1. 本地构建前端
echo "[1/4] 构建前端..."
cd "$(dirname "$0")/../client"
npm ci
npm run build
echo "前端构建完成！"

# 2. 本地构建后端
echo "[2/4] 构建后端..."
cd "$(dirname "$0")/../server"
npm ci
npm run build
echo "后端构建完成！"

# 3. 上传文件到服务器
echo "[3/4] 上传文件到服务器..."

# 上传前端
scp -r ../client/dist/* ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/frontend/

# 上传后端
scp -r ./dist ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/server/
scp ./package.json ./package-lock.json ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/server/

# 上传配置文件
scp ../deploy/nginx.conf ${SERVER_USER}@${SERVER_IP}:/etc/nginx/sites-available/ai-position
scp ../deploy/ecosystem.config.js ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/

echo "文件上传完成！"

# 4. 在服务器上执行部署
echo "[4/4] 远程部署..."
ssh ${SERVER_USER}@${SERVER_IP} <<REMOTE_SCRIPT
set -e

# 安装后端依赖
cd ${SERVER_DIR}/server
npm ci --only=production

# 配置 Nginx
ln -sf /etc/nginx/sites-available/ai-position /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 更新 PM2 配置中的环境变量
cd ${SERVER_DIR}
sed -i "s/CHANGE_ME_STRONG_PASSWORD/${DB_PASSWORD}/g" ecosystem.config.js
sed -i "s/CHANGE_ME_TO_RANDOM_32_CHARS_STRING/${JWT_SECRET}/g" ecosystem.config.js

# 启动/重启后端服务
pm2 delete ai-position-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "========================================="
echo "  部署完成！"
echo "========================================="
echo ""
echo "访问地址: http://${SERVER_IP}"
echo "默认管理员: admin / admin123"
echo ""
echo "常用命令："
echo "  查看日志: pm2 logs"
echo "  重启服务: pm2 restart ai-position-backend"
echo "  查看状态: pm2 status"
REMOTE_SCRIPT

echo ""
echo "部署完成！打开浏览器访问 http://${SERVER_IP}"