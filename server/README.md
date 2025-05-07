# 加工管理系统服务端

## 简介

这是微信小程序"加工管理系统"的后端服务器，使用Express.js和MySQL开发。

## 环境要求

- Node.js 12.0 或更高版本
- MySQL 5.7 或更高版本
- npm 或 yarn 包管理器

## 安装步骤

1. 克隆仓库
```bash
git clone <仓库地址>
cd processing-app/server
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
在server目录下创建`.env`文件，内容如下：
```
# 数据库配置
DB_HOST=localhost
DB_USER=你的MySQL用户名
DB_PASSWORD=你的MySQL密码
DB_NAME=processing_app

# 服务器配置
PORT=3000
NODE_ENV=development
```

4. 初始化数据库
```bash
node database-tools.js init
```

## 清除假数据

如果需要清除组织"org1"的假数据，可以使用以下方法：

1. 使用数据库工具
```bash
node database-tools.js clear
```

2. 使用专用脚本
```bash
node clearFakeData.js
```

3. 通过API端点
```
DELETE /api/products/org/org1
DELETE /api/processes/org/org1
```

4. 使用MySQL客户端执行SQL
```sql
DELETE FROM products WHERE orgId = 'org1';
DELETE FROM processes WHERE orgId = 'org1';
```

5. 使用小程序前端的"数据清理工具"页面

## 服务器启动

```bash
npm start
```

或者开发模式：
```bash
npm run dev
```

服务器默认在 http://localhost:3000 运行

## API文档

### 产品管理
- `GET /api/products` - 获取产品列表
- `DELETE /api/products/:id` - 删除产品
- `DELETE /api/products/org/:orgId` - 清空指定组织的所有产品

### 工序管理
- `GET /api/processes` - 获取工序列表
- `DELETE /api/processes/:id` - 删除工序
- `DELETE /api/processes/org/:orgId` - 清空指定组织的所有工序

### 订单管理
- `GET /api/orders` - 获取订单列表
- `POST /api/orders` - 创建新订单
- `GET /api/orders/:id` - 获取订单详情
- `PUT /api/orders/:id/status` - 更新订单状态

### 统计数据
- `GET /api/stats` - 获取统计数据

## 备注

- 默认管理员账号: admin, 密码: password (请在生产环境中修改) 