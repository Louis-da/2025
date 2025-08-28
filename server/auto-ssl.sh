#!/bin/bash

# 🔐 自动SSL证书申请脚本 - 一键获得免费证书
# 作者: 云收发技术团队
# 用途: 自动申请Let's Encrypt免费SSL证书

echo "🔐 欢迎使用自动SSL证书申请助手！"
echo "📝 这个脚本会自动为你申请免费的SSL证书"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ 请使用root用户运行此脚本${NC}"
    echo "使用方法: sudo bash auto-ssl.sh"
    exit 1
fi

# 检查域名
DOMAIN="aiyunsf.com"
echo -e "${BLUE}🌐 目标域名: $DOMAIN${NC}"

# 检查certbot是否安装
echo -e "${BLUE}🔍 检查certbot工具...${NC}"
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}📦 正在安装certbot...${NC}"
    
    # 检测系统类型
    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian系统
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif command -v yum &> /dev/null; then
        # CentOS/RHEL系统
        yum install -y epel-release
        yum install -y certbot python3-certbot-nginx
    else
        echo -e "${RED}❌ 不支持的操作系统，请手动安装certbot${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ certbot安装完成！${NC}"

# 检查Nginx是否运行
echo -e "${BLUE}🔍 检查Nginx服务...${NC}"
if ! systemctl is-active --quiet nginx; then
    echo -e "${RED}❌ Nginx服务未运行，请先启动Nginx${NC}"
    echo "启动命令: systemctl start nginx"
    exit 1
fi

echo -e "${GREEN}✅ Nginx服务运行正常！${NC}"

# 备份Nginx配置
echo -e "${BLUE}📦 备份Nginx配置...${NC}"
cp /etc/nginx/sites-available/aiyunsf.com /etc/nginx/sites-available/aiyunsf.com.backup.$(date +%Y%m%d) 2>/dev/null || echo "没有找到现有配置"

# 申请证书
echo -e "${BLUE}🔐 开始申请SSL证书...${NC}"
echo -e "${YELLOW}📝 这可能需要几分钟时间，请耐心等待...${NC}"

# 使用certbot申请证书
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@aiyunsf.com

# 检查申请结果
if [ $? -eq 0 ]; then
    echo -e "${GREEN}🎉 SSL证书申请成功！${NC}"
    
    # 检查证书有效期
    echo -e "${BLUE}📅 证书有效期:${NC}"
    openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -noout -dates
    
    # 测试HTTPS连接
    echo -e "${BLUE}🌐 测试HTTPS连接...${NC}"
    sleep 5
    if curl -I https://$DOMAIN 2>/dev/null | head -1 | grep -q "200\|301\|302"; then
        echo -e "${GREEN}✅ HTTPS连接测试成功！${NC}"
    else
        echo -e "${YELLOW}⚠️  HTTPS连接可能需要等待几分钟生效${NC}"
    fi
    
    # 设置自动续期
    echo -e "${BLUE}🔄 设置自动续期...${NC}"
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    echo -e "${GREEN}✅ 自动续期已设置（每天中午12点检查）${NC}"
    
else
    echo -e "${RED}❌ SSL证书申请失败${NC}"
    echo -e "${YELLOW}💡 可能的原因：${NC}"
    echo "  1. 域名DNS解析不正确"
    echo "  2. 80端口被占用"
    echo "  3. 防火墙阻止了连接"
    echo "  4. 域名验证失败"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 SSL证书部署完成！${NC}"
echo ""
echo "📋 部署信息："
echo "  🌐 网站地址: https://$DOMAIN"
echo "  📁 证书位置: /etc/letsencrypt/live/$DOMAIN/"
echo "  📦 备份位置: /etc/nginx/sites-available/aiyunsf.com.backup.*"
echo ""
echo "🔧 常用命令："
echo "  📊 查看证书状态: certbot certificates"
echo "  🔄 手动续期: certbot renew"
echo "  📋 查看Nginx状态: systemctl status nginx"
echo "  🔄 重启Nginx: systemctl reload nginx"
echo ""
echo "💡 注意事项："
echo "  ✅ 证书会自动续期"
echo "  ✅ 证书有效期为90天"
echo "  ✅ 续期失败会收到邮件通知"
echo ""
echo "🎯 现在你的网站已经支持HTTPS了！"



