# 🚀 云收发系统 - 生产环境部署指南

## 📋 部署概览

本指南将帮助您在腾讯云服务器 `175.178.33.180` 上部署云收发系统。

### 🎯 部署目标
- **服务器**: 腾讯云 175.178.33.180
- **端口**: 4000
- **数据库**: MySQL (processing_app)
- **运行环境**: Node.js + PM2

---

## 🔧 部署前准备

### 1. 服务器环境要求
- **操作系统**: Ubuntu 18.04+ / CentOS 7+
- **Node.js**: >= 14.0.0
- **MySQL**: >= 5.7
- **内存**: >= 2GB
- **磁盘**: >= 10GB

### 2. 必要的环境变量
确保以下环境变量已正确配置：

```bash
# 数据库配置
DB_HOST=localhost
DB_USER=yunsf
DB_PASSWORD=521qwertyuioP@
DB_NAME=processing_app

# 服务器配置
PORT=4000
NODE_ENV=production

# 上传文件配置
UPLOAD_DIR=/var/www/aiyunsf.com/public/uploads

# JWT密钥
JWT_SECRET=aiyunsf-2025$9527$-very-secret-key
```

---

## 🚀 快速部署

### 方法一：自动化部署（推荐）

1. **登录服务器**
   ```bash
   ssh root@175.178.33.180
   ```

2. **进入项目目录**
   ```bash
   cd /root/processing-app/server
   ```

3. **执行部署脚本**
   ```bash
   chmod +x deploy-production.sh
   ./deploy-production.sh
   ```

### 方法二：手动部署

1. **安装依赖**
   ```bash
   npm ci --production
   ```

2. **创建环境配置**
   ```bash
   cp config/production.env.template .env
   # 编辑 .env 文件，确保配置正确
   ```

3. **测试数据库连接**
   ```bash
   node -e "require('dotenv').config(); const db = require('./db'); db.executeQuery('SELECT 1').then(() => console.log('✅ 数据库连接成功')).catch(err => console.error('❌ 数据库连接失败:', err.message));"
   ```

4. **启动服务**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

---

## 🔍 部署验证

### 1. 健康检查
```bash
curl http://localhost:4000/health
```

预期返回：
```json
{
  "status": "ok",
  "timestamp": "2025-01-06T...",
  "uptime": 123.456,
  "environment": "production",
  "version": "1.0.0",
  "memory": {
    "used": "45MB",
    "total": "67MB"
  },
  "database": {
    "status": "connected",
    "responseTime": "12ms"
  }
}
```

### 2. 服务状态检查
```bash
pm2 status
```

### 3. 日志检查
```bash
pm2 logs yunsf-server --lines 50
```

---

## 🛠️ 常用管理命令

### PM2 服务管理
```bash
# 查看服务状态
pm2 status

# 重启服务
pm2 restart yunsf-server

# 停止服务
pm2 stop yunsf-server

# 查看日志
pm2 logs yunsf-server

# 查看实时日志
pm2 logs yunsf-server -f

# 清空日志
pm2 flush yunsf-server
```

### 系统监控
```bash
# 查看系统资源使用
pm2 monit

# 查看详细信息
pm2 show yunsf-server

# 查看进程列表
pm2 list
```

---

## 🔧 配置文件说明

### ecosystem.config.js
PM2 进程管理配置文件，包含：
- 应用名称和启动脚本
- 环境变量配置
- 日志文件路径
- 重启策略

### .env
环境变量配置文件，包含：
- 数据库连接信息
- JWT密钥
- 文件上传路径
- CORS配置

---

## 🚨 故障排查

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   netstat -tlnp | grep :4000
   
   # 杀死占用进程
   kill -9 <PID>
   ```

2. **数据库连接失败**
   ```bash
   # 检查MySQL服务状态
   systemctl status mysql
   
   # 测试数据库连接
   mysql -h localhost -u yunsf -p processing_app
   ```

3. **文件权限问题**
   ```bash
   # 设置上传目录权限
   chmod 755 /var/www/aiyunsf.com/public/uploads
   chown -R www-data:www-data /var/www/aiyunsf.com/public/uploads
   ```

4. **内存不足**
   ```bash
   # 查看内存使用
   free -h
   
   # 查看进程内存使用
   ps aux --sort=-%mem | head
   ```

### 日志分析
```bash
# 查看错误日志
tail -f logs/error.log

# 查看访问日志
tail -f logs/combined.log

# 查看PM2日志
pm2 logs yunsf-server --err
```

---

## 📊 性能优化

### 1. 数据库优化
```sql
-- 查看慢查询
SHOW VARIABLES LIKE 'slow_query_log';

-- 优化表
OPTIMIZE TABLE users, organizations, send_orders, receive_orders;

-- 查看索引使用情况
SHOW INDEX FROM users;
```

### 2. 应用优化
- 启用 gzip 压缩
- 配置静态文件缓存
- 使用连接池优化数据库连接
- 监控内存使用情况

### 3. 系统优化
```bash
# 调整文件描述符限制
ulimit -n 65536

# 优化TCP参数
echo 'net.core.somaxconn = 65535' >> /etc/sysctl.conf
sysctl -p
```

---

## 🔄 更新部署

### 代码更新流程
1. **备份当前版本**
   ```bash
   pm2 save
   cp -r /root/processing-app /root/processing-app-backup-$(date +%Y%m%d)
   ```

2. **拉取最新代码**
   ```bash
   git pull origin main
   ```

3. **重新部署**
   ```bash
   ./deploy-production.sh
   ```

### 回滚操作
```bash
# 停止当前服务
pm2 stop yunsf-server

# 恢复备份
rm -rf /root/processing-app
mv /root/processing-app-backup-YYYYMMDD /root/processing-app

# 重启服务
cd /root/processing-app/server
pm2 start ecosystem.config.js
```

---

## 📞 技术支持

如遇到部署问题，请提供以下信息：
1. 错误日志 (`pm2 logs yunsf-server`)
2. 系统信息 (`uname -a`, `node -v`, `npm -v`)
3. 配置文件内容（隐藏敏感信息）
4. 健康检查结果

---

## 📝 更新日志

### v3.1.0 (2025-01-06)
- ✅ 优化数据库连接池配置
- ✅ 增强JWT安全配置
- ✅ 添加性能监控系统
- ✅ 完善健康检查功能
- ✅ 创建自动化部署脚本 