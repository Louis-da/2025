#!/bin/bash

# 🚀 云收发系统 - 生产环境部署脚本
# 作者: 云收发开发团队
# 版本: 3.1.0
# 用途: 自动化部署到腾讯云服务器 175.178.33.180

set -e  # 遇到错误立即退出

echo "🚀 开始部署云收发系统到生产环境..."
echo "📅 部署时间: $(date)"
echo "🖥️  目标服务器: 175.178.33.180"
echo "📂 当前目录: $(pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_warning "建议使用root用户执行部署脚本"
        log_info "当前用户: $(whoami)"
    else
        log_success "Root用户权限确认"
    fi
}

# 检查并创建环境配置文件
setup_environment() {
    log_info "设置环境配置..."
    
    # 如果不存在.env文件，从模板创建
    if [ ! -f ".env" ]; then
        if [ -f "config/production.env.template" ]; then
            log_info "从模板创建.env文件..."
            cp config/production.env.template .env
            log_success ".env文件已创建，请检查配置是否正确"
        else
            log_warning ".env文件和模板都不存在，将使用环境变量"
        fi
    else
        log_success ".env文件已存在"
    fi
    
    # 检查关键环境变量
    source .env 2>/dev/null || true
    
    if [ -z "$DB_PASSWORD" ]; then
        log_error "DB_PASSWORD 环境变量未设置"
        exit 1
    fi
    
    if [ -z "$JWT_SECRET" ]; then
        log_error "JWT_SECRET 环境变量未设置"
        exit 1
    fi
    
    if [ ${#JWT_SECRET} -lt 32 ]; then
        log_warning "JWT_SECRET 长度不足32位，建议使用更强的密钥"
    fi
    
    log_success "环境变量检查通过"
}

# 检查Node.js版本
check_nodejs() {
    log_info "检查Node.js版本..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        log_info "正在安装Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="14.0.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        log_error "Node.js 版本过低，需要 >= $REQUIRED_VERSION，当前版本: $NODE_VERSION"
        exit 1
    fi
    
    log_success "Node.js 版本检查通过: $NODE_VERSION"
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."
    
    # 清理node_modules以确保干净安装
    if [ -d "node_modules" ]; then
        log_info "清理旧的依赖..."
        rm -rf node_modules
    fi
    
    if [ -f "package-lock.json" ]; then
        npm ci --production --silent
    else
        npm install --production --silent
    fi
    
    log_success "依赖安装完成"
}

# 数据库连接测试
test_database() {
    log_info "测试数据库连接..."
    
    # 使用Node.js脚本测试数据库连接
    timeout 30 node -e "
        require('dotenv').config();
        const db = require('./db');
        db.executeQuery('SELECT 1 as test, NOW() as current_time')
            .then((result) => {
                console.log('✅ 数据库连接成功');
                console.log('📊 数据库时间:', result[0].current_time);
                process.exit(0);
            })
            .catch((err) => {
                console.error('❌ 数据库连接失败:', err.message);
                process.exit(1);
            });
    " || {
        log_error "数据库连接测试超时或失败"
        exit 1
    }
    
    log_success "数据库连接测试通过"
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    
    # 创建日志目录
    mkdir -p logs temp
    
    # 创建上传目录
    UPLOAD_DIR=${UPLOAD_DIR:-"/var/www/aiyunsf.com/public/uploads"}
    mkdir -p "$UPLOAD_DIR"
    
    # 设置目录权限
    chmod 755 logs temp
    chmod 755 "$UPLOAD_DIR"
    
    # 如果是root用户，设置合适的所有者
    if [ "$EUID" -eq 0 ]; then
        chown -R www-data:www-data "$UPLOAD_DIR" 2>/dev/null || true
    fi
    
    log_success "目录创建完成"
    log_info "上传目录: $UPLOAD_DIR"
}

# 启动服务
start_service() {
    log_info "启动服务..."
    
    # 检查是否已安装PM2
    if ! command -v pm2 &> /dev/null; then
        log_info "安装PM2..."
        npm install -g pm2
    fi
    
    # 停止旧服务
    pm2 stop yunsf-server 2>/dev/null || true
    pm2 delete yunsf-server 2>/dev/null || true
    
    # 等待服务完全停止
    sleep 2
    
    # 启动新服务
    log_info "启动云收发服务..."
    NODE_ENV=production pm2 start ecosystem.config.js
    
    # 保存PM2配置
    pm2 save
    
    # 设置开机自启动
    pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup
    
    log_success "服务启动完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    # 等待服务启动
    sleep 8
    
    # 获取端口号
    PORT=${PORT:-4000}
    
    # 检查服务状态
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "健康检查尝试 $attempt/$max_attempts..."
        
        if curl -f -s "http://localhost:$PORT/health" > /dev/null; then
            log_success "健康检查通过"
            
            # 显示健康检查详情
            log_info "服务状态详情:"
            curl -s "http://localhost:$PORT/health" | python3 -m json.tool 2>/dev/null || curl -s "http://localhost:$PORT/health"
            return 0
        else
            log_warning "健康检查失败，等待重试..."
            sleep 5
            ((attempt++))
        fi
    done
    
    log_error "健康检查失败，查看服务日志:"
    pm2 logs yunsf-server --lines 20
    exit 1
}

# 显示部署后信息
show_deployment_info() {
    log_success "🎉 部署完成！"
    echo ""
    echo "📋 服务信息:"
    echo "  🌐 服务地址: http://175.178.33.180:${PORT:-4000}"
    echo "  🔍 健康检查: http://175.178.33.180:${PORT:-4000}/health"
    echo "  📊 API文档: http://175.178.33.180:${PORT:-4000}/api"
    echo ""
    echo "🔧 管理命令:"
    echo "  📊 查看状态: pm2 status"
    echo "  📋 查看日志: pm2 logs yunsf-server"
    echo "  🔄 重启服务: pm2 restart yunsf-server"
    echo "  ⏹️  停止服务: pm2 stop yunsf-server"
    echo ""
    echo "📁 重要路径:"
    echo "  📂 项目目录: $(pwd)"
    echo "  📂 上传目录: ${UPLOAD_DIR:-/var/www/aiyunsf.com/public/uploads}"
    echo "  📂 日志目录: $(pwd)/logs"
}

# 主部署流程
main() {
    log_info "开始执行部署流程..."
    
    check_root
    setup_environment
    check_nodejs
    install_dependencies
    create_directories
    test_database
    start_service
    health_check
    show_deployment_info
}

# 执行主流程
main "$@" 