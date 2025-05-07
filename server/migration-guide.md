# 从云开发迁移到自建服务器的指南

本指南将帮助您完成从云开发到自建腾讯云服务器的迁移过程。

## 1. 配置数据库连接

首先，您需要创建一个`.env`文件来配置数据库连接：

```bash
# 在server目录下执行
cd server
cp .env.example .env  # 如果.env.example文件不存在，请手动创建.env文件
```

编辑`.env`文件并填写您的数据库连接信息：

```
# 数据库连接配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=processing_app

# 应用配置
PORT=3000
NODE_ENV=production

# JWT密钥（用于生成授权令牌）
JWT_SECRET=your_secret_key_here
```

## 2. 更新数据库结构

执行以下命令来更新数据库结构，确保`factories`表包含必要的字段：

```bash
# 登录到MySQL
mysql -u your_username -p

# 在MySQL命令行中执行
use your_database_name;
source update-factory-table.sql;
exit;
```

## 3. 安装依赖并启动服务器

```bash
# 在server目录下执行
npm install
npm start
```

## 4. 小程序端配置

确保小程序端的API基础URL设置正确：

1. 打开 `miniprogram/utils/api.js` 文件
2. 检查 `getBaseUrl` 函数返回的URL是否正确
3. 默认URL是 `https://aiyunsf.com/api`，您可以根据需要修改

## 5. 测试连接

1. 启动您的服务器
2. 在微信开发者工具中运行小程序
3. 测试工厂管理功能，确保数据正确加载和保存

## 6. 主要修改内容

在迁移过程中，我们主要做了以下修改：

1. 添加了字段名匹配的转换逻辑：
   - 前端使用 `orgId`，后端使用 `org_id`
   - 前端使用 `phone`，后端使用 `contact_phone`
   - 前端使用字符串状态 `active/inactive`，后端使用数值 `1/0`

2. 取消了手机号必填验证：
   - 修改了工厂管理页面，将手机号设为选填
   - 只在填写了手机号时才检查是否重复

3. 添加了缺失的数据库字段：
   - 添加了 `processes` 字段用于存储工序JSON数据
   - 添加了 `debt` 和 `balance` 字段用于财务管理
   - 添加了 `remark` 字段用于备注信息

4. 优化了API响应处理：
   - 添加了错误处理和日志记录
   - 统一了API响应格式

如果您遇到任何问题，请检查服务器日志和小程序控制台日志，以获取详细的错误信息。 