#!/bin/bash

# 云收发服务器安全重启脚本
# 避免端口冲突，确保服务稳定运行

echo "========================================="
echo "云收发服务器安全重启脚本"
echo "时间: $(date)"
echo "========================================="

# 设置工作目录
WORK_DIR="/root/processing-app/server"
cd "$WORK_DIR" || {
    echo "❌ 错误: 无法进入工作目录 $WORK_DIR"
    exit 1
}

# 1. 停止所有可能的pm2进程
echo "📋 第1步: 停止所有pm2进程..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# 2. 强制杀死所有占用3000端口的进程
echo "🔧 第2步: 清理端口占用..."
PORT_PIDS=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$PORT_PIDS" ]; then
    echo "发现占用3000端口的进程: $PORT_PIDS"
    echo "$PORT_PIDS" | xargs -r kill -9
    echo "✅ 已清理端口占用"
else
    echo "✅ 端口3000未被占用"
fi

# 3. 等待端口完全释放
echo "⏳ 第3步: 等待端口释放..."
sleep 3

# 4. 验证端口确实已释放
PORT_CHECK=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$PORT_CHECK" ]; then
    echo "❌ 警告: 端口3000仍被占用: $PORT_CHECK"
    echo "强制杀死残留进程..."
    echo "$PORT_CHECK" | xargs -r kill -9
    sleep 2
fi

# 5. 检查数据库连接
echo "🗄️ 第4步: 检查数据库连接..."
if command -v mysql >/dev/null 2>&1; then
    if mysql -h localhost -u root -p"$DB_PASSWORD" -e "SELECT 1;" processing_app >/dev/null 2>&1; then
        echo "✅ 数据库连接正常"
    else
        echo "⚠️ 警告: 数据库连接测试失败，但继续启动服务..."
    fi
else
    echo "⚠️ 警告: 未找到mysql命令，跳过数据库检查"
fi

# 6. 检查必要文件
echo "📁 第5步: 检查必要文件..."
if [ ! -f "app.js" ]; then
    echo "❌ 错误: 找不到 app.js 文件"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "❌ 错误: 找不到 .env 文件"
    exit 1
fi

if [ ! -f "ecosystem.config.js" ]; then
    echo "❌ 错误: 找不到 ecosystem.config.js 文件"
    exit 1
fi

echo "✅ 所有必要文件检查通过"

# 7. 使用生态系统配置启动服务
echo "🚀 第6步: 启动服务..."
pm2 start ecosystem.config.js --env production

# 8. 等待服务启动
echo "⏳ 第7步: 等待服务启动..."
sleep 5

# 9. 验证服务状态
echo "🔍 第8步: 验证服务状态..."
pm2 list

# 检查端口监听
PORT_LISTEN=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$PORT_LISTEN" ]; then
    echo "✅ 服务成功启动，监听端口3000"
else
    echo "❌ 错误: 服务启动失败，端口3000未被监听"
    pm2 logs yunsf-app --lines 10
    exit 1
fi

# 10. 简单的健康检查
echo "🏥 第9步: 健康检查..."
sleep 3
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ 健康检查通过"
else
    echo "⚠️ 警告: 健康检查失败，但服务可能仍在启动中"
fi

echo "========================================="
echo "✅ 服务器重启完成！"
echo "访问地址: https://aiyunsf.com"
echo "日志查看: pm2 logs yunsf-app"
echo "=========================================" 