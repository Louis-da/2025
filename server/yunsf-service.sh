#!/bin/bash

# 云收发系统服务管理脚本
# 使用方式: ./yunsf-service.sh {start|stop|restart|status|logs}

WORK_DIR="/root/processing-app/server"
SERVICE_NAME="yunsf-app"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 检查工作目录
check_work_dir() {
    if [ ! -d "$WORK_DIR" ]; then
        log_error "工作目录不存在: $WORK_DIR"
        exit 1
    fi
    cd "$WORK_DIR" || {
        log_error "无法进入工作目录: $WORK_DIR"
        exit 1
    }
}

# 检查端口占用
check_port_usage() {
    local port_pids
    port_pids=$(lsof -ti :3000 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
        log_debug "端口3000被进程占用: $port_pids"
        return 0
    else
        log_debug "端口3000未被占用"
        return 1
    fi
}

# 强制清理端口
force_clean_port() {
    log_info "清理端口3000占用..."
    local port_pids
    port_pids=$(lsof -ti :3000 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
        log_warn "强制杀死进程: $port_pids"
        echo "$port_pids" | xargs -r kill -9
        sleep 2
        
        # 再次检查
        port_pids=$(lsof -ti :3000 2>/dev/null || true)
        if [ -n "$port_pids" ]; then
            log_error "无法清理端口占用，请手动处理"
            return 1
        fi
    fi
    log_info "端口清理完成"
    return 0
}

# 启动服务
start_service() {
    log_info "启动云收发服务..."
    
    check_work_dir
    
    # 检查服务是否已经运行
    if pm2 list | grep -q "$SERVICE_NAME.*online"; then
        log_warn "服务已在运行"
        return 0
    fi
    
    # 清理可能的端口占用
    force_clean_port || exit 1
    
    # 检查必要文件
    if [ ! -f "ecosystem.config.js" ]; then
        log_error "ecosystem.config.js 配置文件不存在"
        exit 1
    fi
    
    # 启动服务
    log_info "使用生态系统配置启动服务..."
    pm2 start ecosystem.config.js --env production
    
    # 等待启动
    sleep 5
    
    # 验证启动状态
    if pm2 list | grep -q "$SERVICE_NAME.*online"; then
        log_info "✅ 服务启动成功"
        pm2 list
    else
        log_error "❌ 服务启动失败"
        pm2 logs "$SERVICE_NAME" --lines 10
        exit 1
    fi
}

# 停止服务
stop_service() {
    log_info "停止云收发服务..."
    
    check_work_dir
    
    # 停止pm2服务
    pm2 stop "$SERVICE_NAME" 2>/dev/null || true
    pm2 delete "$SERVICE_NAME" 2>/dev/null || true
    
    # 强制清理端口
    force_clean_port
    
    log_info "✅ 服务停止完成"
}

# 重启服务
restart_service() {
    log_info "重启云收发服务..."
    stop_service
    sleep 3
    start_service
}

# 查看服务状态
show_status() {
    check_work_dir
    
    echo "===== PM2 服务状态 ====="
    pm2 list
    
    echo ""
    echo "===== 端口监听状态 ====="
    if check_port_usage; then
        lsof -i :3000
    else
        log_warn "端口3000未被监听"
    fi
    
    echo ""
    echo "===== 服务健康检查 ====="
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        log_info "✅ 健康检查通过"
    else
        log_warn "⚠️ 健康检查失败"
    fi
}

# 查看日志
show_logs() {
    check_work_dir
    
    echo "===== 最近的日志 ====="
    pm2 logs "$SERVICE_NAME" --lines 20
}

# 主函数
main() {
    case "$1" in
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        *)
            echo "使用方式: $0 {start|stop|restart|status|logs}"
            echo ""
            echo "命令说明:"
            echo "  start   - 启动服务"
            echo "  stop    - 停止服务" 
            echo "  restart - 重启服务"
            echo "  status  - 查看状态"
            echo "  logs    - 查看日志"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@" 