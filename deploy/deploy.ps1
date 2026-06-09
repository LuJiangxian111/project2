# ============================================
# AI岗位需求广场 - 一键部署脚本 (Windows版)
# 在本地 PowerShell 中运行
#
# 使用方法：
#   1. 修改下方服务器配置
#   2. .\deploy.ps1
# ============================================

# ========== 服务器配置（请修改） ==========
$SERVER_IP = "你的服务器IP"          # 腾讯云服务器公网IP
$SERVER_USER = "root"                # SSH 用户名
$SERVER_DIR = "/www/ai-position"     # 项目部署目录
$DB_PASSWORD = "你的数据库密码"       # 数据库密码
$JWT_SECRET = "你的JWT密钥至少32位"   # JWT 密钥
# ==========================================

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  AI岗位需求广场 - 开始部署" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot

# 1. 构建前端
Write-Host "[1/4] 构建前端..." -ForegroundColor Yellow
Set-Location "$projectRoot\client"
npm ci
npm run build
Write-Host "前端构建完成！" -ForegroundColor Green

# 2. 构建后端
Write-Host "[2/4] 构建后端..." -ForegroundColor Yellow
Set-Location "$projectRoot\server"
npm ci
npm run build
Write-Host "后端构建完成！" -ForegroundColor Green

# 3. 上传文件到服务器
Write-Host "[3/4] 上传文件到服务器..." -ForegroundColor Yellow

# 确保服务器目录存在
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p $SERVER_DIR/frontend $SERVER_DIR/server/dist $SERVER_DIR/logs"

# 上传前端构建产物
scp -r "$projectRoot\client\dist\*" "${SERVER_USER}@${SERVER_IP}:$SERVER_DIR/frontend/"

# 上传后端构建产物
scp -r "$projectRoot\server\dist\*" "${SERVER_USER}@${SERVER_IP}:$SERVER_DIR/server/dist/"
scp "$projectRoot\server\package.json" "${SERVER_USER}@${SERVER_IP}:$SERVER_DIR/server/"
scp "$projectRoot\server\package-lock.json" "${SERVER_USER}@${SERVER_IP}:$SERVER_DIR/server/"

# 上传配置文件
scp "$projectRoot\deploy\nginx.conf" "${SERVER_USER}@${SERVER_IP}:/etc/nginx/sites-available/ai-position"
scp "$projectRoot\deploy\ecosystem.config.js" "${SERVER_USER}@${SERVER_IP}:$SERVER_DIR/"

Write-Host "文件上传完成！" -ForegroundColor Green

# 4. 在服务器上执行部署
Write-Host "[4/4] 远程部署..." -ForegroundColor Yellow

ssh ${SERVER_USER}@${SERVER_IP} @"
set -e

# 安装后端依赖
cd $SERVER_DIR/server
npm ci --only=production

# 配置 Nginx
ln -sf /etc/nginx/sites-available/ai-position /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 更新 PM2 配置中的环境变量
cd $SERVER_DIR
sed -i 's/CHANGE_ME_STRONG_PASSWORD/$DB_PASSWORD/g' ecosystem.config.js
sed -i 's/CHANGE_ME_TO_RANDOM_32_CHARS_STRING/$JWT_SECRET/g' ecosystem.config.js

# 启动/重启后端服务
pm2 delete ai-position-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ''
echo '========================================='
echo '  部署完成！'
echo '========================================='
echo ''
echo '访问地址: http://$SERVER_IP'
echo '默认管理员: admin / admin123'
"@

Write-Host ""
Write-Host "部署完成！打开浏览器访问 http://$SERVER_IP" -ForegroundColor Green