#!/bin/bash
# 上传脚本 - 将文件上传到云服务器

# 请替换为您的实际服务器信息
SERVER_IP="175.178.33.180"
SERVER_USER="root"
SERVER_PATH="/root/processing-app"

# 创建目标目录
echo "创建服务器上的目标目录..."
ssh $SERVER_USER@$SERVER_IP "mkdir -p $SERVER_PATH"

# 上传服务器代码
echo "上传服务器代码到云服务器..."
scp -r ./* $SERVER_USER@$SERVER_IP:$SERVER_PATH/

# 设置脚本可执行权限
echo "设置脚本可执行权限..."
ssh $SERVER_USER@$SERVER_IP "chmod +x $SERVER_PATH/deploy.sh"

echo "文件上传完成!"
echo "请在云服务器中执行以下命令完成部署:"
echo "1. cd $SERVER_PATH"
echo "2. 修改deploy.sh中的MySQL密码"
echo "3. ./deploy.sh" 