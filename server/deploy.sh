#!/bin/bash
# 服务器部署脚本

# 安装必要的软件包
echo "========== 安装必要的软件包 =========="
yum update -y
yum install -y mysql mysql-server nodejs npm git

# 启动MySQL服务
echo "========== 启动MySQL服务 =========="
systemctl start mysqld
systemctl enable mysqld
systemctl status mysqld

# 设置MySQL root密码
echo "========== 设置MySQL root密码 =========="
# 注意：请将下面的YOUR_PASSWORD更改为您想要的实际密码
MYSQL_PASSWORD="YOUR_PASSWORD"
mysqladmin -u root password "$MYSQL_PASSWORD"

# 创建应用数据库
echo "========== 创建数据库 =========="
mysql -u root -p"$MYSQL_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS processing_app DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 运行初始化SQL
echo "========== 初始化数据库 =========="
mysql -u root -p"$MYSQL_PASSWORD" processing_app < init-database.sql

# 创建.env文件
echo "========== 创建环境配置文件 =========="
cat > .env << EOL
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=$MYSQL_PASSWORD
DB_NAME=processing_app

# 服务器配置
PORT=3000
NODE_ENV=production
EOL

# 安装Node.js依赖
echo "========== 安装Node.js依赖 =========="
npm install

# 安装PM2进程管理器
echo "========== 安装PM2 =========="
npm install -g pm2

# 使用PM2启动应用
echo "========== 启动应用 =========="
pm2 start app.js --name "processing-app"
pm2 save
pm2 startup

# 清除假数据（可选）
echo "========== 清除假数据 =========="
node database-tools.js clear

echo "========== 部署完成 =========="
echo "应用已在端口3000启动"
echo "请确保防火墙已开放该端口" 