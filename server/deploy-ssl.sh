#!/bin/bash

# 🔐 SSL证书部署脚本 - 小学生友好版
# 作者: 云收发技术团队
# 用途: 帮助用户简单部署SSL证书

echo "🔐 欢迎使用SSL证书部署助手！"
echo "📝 这个脚本会帮你把新证书安装到服务器上"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

# 检查证书文件是否存在
echo -e "${BLUE}🔍 检查证书文件...${NC}"

if [ ! -f "/root/aiyunsf.com.crt" ]; then
    echo -e "${RED}❌ 找不到证书文件 aiyunsf.com.crt${NC}"
    echo -e "${YELLOW}📋 请先下载证书文件并上传到 /root/ 目录${NC}"
    echo ""
    echo "📝 操作步骤："
    echo "1. 登录腾讯云控制台"
    echo "2. 找到SSL证书服务"
    echo "3. 下载证书文件"
    echo "4. 用FileZilla上传到服务器"
    exit 1
fi

if [ ! -f "/root/aiyunsf.com.key" ]; then
    echo -e "${RED}❌ 找不到私钥文件 aiyunsf.com.key${NC}"
    echo -e "${YELLOW}📋 请先下载私钥文件并上传到 /root/ 目录${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 证书文件检查通过！${NC}"

# 备份旧证书
echo -e "${BLUE}📦 备份旧证书...${NC}"
mkdir -p /etc/nginx/ssl/backup
cp /etc/nginx/ssl/aiyunsf.com.crt /etc/nginx/ssl/backup/aiyunsf.com.crt.backup.$(date +%Y%m%d) 2>/dev/null || echo "没有旧证书需要备份"
cp /etc/nginx/ssl/aiyunsf.com.key /etc/nginx/ssl/backup/aiyunsf.com.key.backup.$(date +%Y%m%d) 2>/dev/null || echo "没有旧私钥需要备份"

# 复制新证书
echo -e "${BLUE}📋 安装新证书...${NC}"
cp /root/aiyunsf.com.crt /etc/nginx/ssl/
cp /root/aiyunsf.com.key /etc/nginx/ssl/

# 设置权限
chmod 644 /etc/nginx/ssl/aiyunsf.com.crt
chmod 600 /etc/nginx/ssl/aiyunsf.com.key

# 检查证书有效期
echo -e "${BLUE}🔍 检查证书有效期...${NC}"
openssl x509 -in /etc/nginx/ssl/aiyunsf.com.crt -noout -dates

# 测试Nginx配置
echo -e "${BLUE}🔧 测试Nginx配置...${NC}"
if nginx -t; then
    echo -e "${GREEN}✅ Nginx配置测试通过！${NC}"
else
    echo -e "${RED}❌ Nginx配置有错误，请检查配置文件${NC}"
    exit 1
fi

# 重启Nginx
echo -e "${BLUE}🔄 重启Nginx服务...${NC}"
systemctl reload nginx

# 检查服务状态
echo -e "${BLUE}📊 检查服务状态...${NC}"
systemctl status nginx --no-pager -l

# 测试HTTPS连接
echo -e "${BLUE}🌐 测试HTTPS连接...${NC}"
sleep 3
if curl -I https://aiyunsf.com 2>/dev/null | head -1 | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ HTTPS连接测试成功！${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS连接测试失败，可能需要等待几分钟${NC}"
fi

echo ""
echo -e "${GREEN}🎉 SSL证书部署完成！${NC}"
echo ""
echo "📋 部署信息："
echo "  🌐 网站地址: https://aiyunsf.com"
echo "  📁 证书位置: /etc/nginx/ssl/"
echo "  📦 备份位置: /etc/nginx/ssl/backup/"
echo ""
echo "🔧 常用命令："
echo "  📊 查看Nginx状态: systemctl status nginx"
echo "  🔄 重启Nginx: systemctl reload nginx"
echo "  📋 查看证书: openssl x509 -in /etc/nginx/ssl/aiyunsf.com.crt -noout -dates"
echo ""
echo "💡 如果还有问题，请检查："
echo "  1. 域名DNS解析是否正确"
echo "  2. 防火墙是否开放443端口"
echo "  3. 证书文件是否完整"



