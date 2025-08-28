#!/bin/bash

# 🔍 云收发系统 - 服务器状态监控脚本
# 用途: 快速检查服务器和应用状态

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🔍 云收发系统状态监控"
echo "📅 检查时间: $(date)"
echo "🖥️  服务器: 175.178.33.180"
echo "=================================="

# 1. 系统基本信息
echo -e "\n${BLUE}📊 系统信息${NC}"
echo "操作系统: $(uname -s) $(uname -r)"
echo "主机名: $(hostname)"
echo "运行时间: $(uptime -p 2>/dev/null || uptime)"

# 2. 资源使用情况
echo -e "\n${BLUE}💾 资源使用${NC}"
echo "内存使用:"
free -h | grep -E "Mem|Swap"

echo -e "\n磁盘使用:"
df -h | grep -E "/$|/var|/tmp"

echo -e "\n负载情况:"
uptime | awk '{print "1分钟: " $(NF-2) ", 5分钟: " $(NF-1) ", 15分钟: " $NF}'

# 3. 网络状态
echo -e "\n${BLUE}🌐 网络状态${NC}"
PORT=${PORT:-4000}
if netstat -tlnp 2>/dev/null | grep ":$PORT " > /dev/null; then
    echo -e "端口 $PORT: ${GREEN}✅ 监听中${NC}"
else
    echo -e "端口 $PORT: ${RED}❌ 未监听${NC}"
fi

# 4. PM2 服务状态
echo -e "\n${BLUE}🚀 PM2 服务状态${NC}"
if command -v pm2 &> /dev/null; then
    pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if not data:
        print('❌ 没有运行的PM2进程')
    else:
        for app in data:
            name = app.get('name', 'unknown')
            status = app.get('pm2_env', {}).get('status', 'unknown')
            cpu = app.get('monit', {}).get('cpu', 0)
            memory = app.get('monit', {}).get('memory', 0)
            memory_mb = round(memory / 1024 / 1024, 1) if memory else 0
            
            status_icon = '✅' if status == 'online' else '❌'
            print(f'{status_icon} {name}: {status} (CPU: {cpu}%, 内存: {memory_mb}MB)')
except:
    print('❌ 无法解析PM2状态')
" 2>/dev/null || echo "❌ PM2 未安装或无法获取状态"
else
    echo "❌ PM2 未安装"
fi

# 5. 数据库连接测试
echo -e "\n${BLUE}🗄️  数据库状态${NC}"
if [ -f ".env" ]; then
    source .env 2>/dev/null
fi

if command -v mysql &> /dev/null && [ -n "$DB_PASSWORD" ]; then
    if mysql -h "${DB_HOST:-localhost}" -u "${DB_USER:-yunsf}" -p"$DB_PASSWORD" -e "SELECT 1;" "${DB_NAME:-processing_app}" &>/dev/null; then
        echo -e "数据库连接: ${GREEN}✅ 正常${NC}"
        
        # 获取数据库基本信息
        mysql -h "${DB_HOST:-localhost}" -u "${DB_USER:-yunsf}" -p"$DB_PASSWORD" "${DB_NAME:-processing_app}" -e "
            SELECT 
                CONCAT('用户数量: ', COUNT(*)) as info
            FROM users
            UNION ALL
            SELECT 
                CONCAT('组织数量: ', COUNT(*))
            FROM organizations
            UNION ALL
            SELECT 
                CONCAT('今日订单: ', COUNT(*))
            FROM send_orders 
            WHERE DATE(created_at) = CURDATE()
        " 2>/dev/null | tail -n +2
    else
        echo -e "数据库连接: ${RED}❌ 失败${NC}"
    fi
else
    echo "❌ MySQL客户端未安装或缺少数据库配置"
fi

# 6. 应用健康检查
echo -e "\n${BLUE}🏥 应用健康检查${NC}"
PORT=${PORT:-4000}
if curl -f -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
    echo -e "应用状态: ${GREEN}✅ 健康${NC}"
    
    # 获取详细健康信息
    health_info=$(curl -s "http://localhost:$PORT/health" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "$health_info" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'运行时间: {data.get(\"uptime\", \"未知\")}秒')
    print(f'环境: {data.get(\"environment\", \"未知\")}')
    if 'memory' in data:
        print(f'内存使用: {data[\"memory\"].get(\"used\", \"未知\")} / {data[\"memory\"].get(\"total\", \"未知\")}')
    if 'database' in data:
        db_status = data['database'].get('status', '未知')
        db_time = data['database'].get('responseTime', '未知')
        print(f'数据库响应: {db_status} ({db_time})')
except:
    pass
" 2>/dev/null
    fi
else
    echo -e "应用状态: ${RED}❌ 不健康${NC}"
    echo "尝试检查PM2日志: pm2 logs yunsf-server --lines 5"
fi

# 7. 日志文件状态
echo -e "\n${BLUE}📋 日志文件${NC}"
if [ -d "logs" ]; then
    echo "日志目录: $(ls -la logs/ 2>/dev/null | wc -l) 个文件"
    
    # 检查最新的错误日志
    if [ -f "logs/error.log" ]; then
        error_count=$(tail -n 100 logs/error.log 2>/dev/null | grep -c "ERROR" || echo "0")
        if [ "$error_count" -gt 0 ]; then
            echo -e "最近错误: ${YELLOW}⚠️  $error_count 条错误${NC}"
        else
            echo -e "最近错误: ${GREEN}✅ 无错误${NC}"
        fi
    fi
else
    echo "❌ 日志目录不存在"
fi

# 8. 磁盘空间警告
echo -e "\n${BLUE}💿 磁盘空间检查${NC}"
disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 80 ]; then
    echo -e "磁盘使用率: ${RED}⚠️  ${disk_usage}% (警告: 超过80%)${NC}"
elif [ "$disk_usage" -gt 90 ]; then
    echo -e "磁盘使用率: ${RED}🚨 ${disk_usage}% (危险: 超过90%)${NC}"
else
    echo -e "磁盘使用率: ${GREEN}✅ ${disk_usage}%${NC}"
fi

echo -e "\n=================================="
echo "🔍 监控完成"

# 如果有参数 --watch，则持续监控
if [ "$1" = "--watch" ]; then
    echo "👀 持续监控模式 (按 Ctrl+C 退出)"
    while true; do
        sleep 30
        clear
        bash "$0"
    done
fi 