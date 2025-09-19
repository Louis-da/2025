# 云上食府 - 微信小程序后端系统

## 项目概述

云上食府是一个基于微信云开发的餐饮管理系统，提供完整的餐饮业务管理功能，包括用户管理、组织管理、产品管理、订单管理等核心功能。

## 技术架构

### 后端技术栈
- **云平台**: 微信云开发 (WeChat Cloud Development)
- **运行环境**: Node.js
- **数据库**: 微信云数据库 (基于 MongoDB)
- **认证**: JWT + 微信 OpenID
- **日志**: 结构化日志系统
- **监控**: 自定义监控和告警系统

### 系统架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   微信小程序     │    │   云函数层       │    │   数据库层       │
│                │    │                │    │                │
│  - 用户界面     │◄──►│  - auth         │◄──►│  - users        │
│  - 业务逻辑     │    │  - api          │    │  - organizations│
│  - 状态管理     │    │  - database-setup│   │  - products     │
│                │    │  - common       │    │  - orders       │
└─────────────────┘    └─────────────────┘    │  - logs         │
                                              │  - metrics      │
                                              └─────────────────┘
```

## 项目结构

```
yunsf3/
├── cloudfunctions/          # 云函数目录
│   ├── auth/                # 认证相关云函数
│   │   ├── index.js        # 认证主函数
│   │   └── package.json    # 依赖配置
│   ├── api/                # API 云函数
│   │   ├── index.js        # API 主函数
│   │   ├── utils/          # API 工具类
│   │   │   ├── dbIndexes.js # 数据库索引配置
│   │   │   └── ...
│   │   └── package.json
│   ├── database-setup/     # 数据库初始化
│   │   ├── index.js
│   │   └── package.json
│   ├── debug-user/         # 用户调试工具
│   │   ├── index.js        # 查询用户详细信息
│   │   └── package.json
│   ├── debug-org/          # 组织调试工具
│   │   ├── index.js        # 查询组织信息
│   │   └── package.json
│   ├── list-orgs/          # 组织列表工具
│   │   ├── index.js        # 列出所有组织
│   │   └── package.json
│   ├── create-org/         # 组织创建工具
│   │   ├── index.js        # 创建新组织
│   │   └── package.json
│   ├── fix-user-status/    # 用户状态修复工具
│   │   ├── index.js        # 修复用户状态字段
│   │   └── package.json
│   ├── reset-user-password/ # 密码重置工具
│   │   ├── index.js        # 重置用户密码格式
│   │   └── package.json
│   └── common/             # 公共工具库
│       ├── utils.js        # 通用工具类
│       ├── logger.js       # 日志系统
│       ├── monitoring.js   # 监控系统
│       └── ...
├── miniprogram/            # 小程序前端代码
│   ├── pages/             # 页面文件
│   ├── components/        # 组件文件
│   ├── utils/            # 工具函数
│   └── ...
├── project.config.json    # 项目配置
└── README.md             # 项目说明
```

## 🚀 快速开始

### 环境要求
- Node.js >= 14.0.0
- 微信开发者工具
- 微信云开发环境

### 部署步骤

#### 1. 环境准备
```bash
# 克隆项目
git clone <repository-url>
cd yunsf3

# 安装依赖
npm install
```

#### 2. 云开发环境配置
1. 在微信公众平台创建小程序
2. 开通云开发服务
3. 创建云开发环境（建议创建开发、测试、生产三个环境）

#### 3. 云函数部署
```bash
# 使用微信开发者工具部署云函数
# 或使用命令行工具

# 部署认证云函数
cd cloudfunctions/auth
npm install
# 在微信开发者工具中右键部署

# 部署API云函数
cd ../api
npm install
# 在微信开发者工具中右键部署

# 部署数据库初始化云函数
cd ../database-setup
npm install
# 在微信开发者工具中右键部署
```

#### 4. 数据库初始化
```bash
# 在微信开发者工具的云开发控制台中
# 调用 database-setup 云函数进行数据库初始化
```

#### 5. 环境变量配置
在云开发控制台设置以下环境变量：
```
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_TIME=900000
```

## 核心功能模块

### 1. 认证系统 (auth)
- **用户登录**: 支持组织ID + 用户名 + 密码登录
- **令牌管理**: JWT访问令牌 + 刷新令牌机制
- **会话管理**: 用户会话跟踪和管理
- **安全特性**: 
  - 密码强度验证
  - 登录失败锁定
  - 令牌黑名单
  - 密码加密存储

### 2. API系统 (api)
- **用户管理**: 用户CRUD操作
- **组织管理**: 组织信息管理
- **产品管理**: 产品信息维护
- **订单管理**: 订单处理流程
- **权限控制**: 基于角色的访问控制

### 3. 数据库系统
- **索引优化**: 针对查询性能优化的索引设计
- **查询优化**: 智能查询分析和优化建议
- **数据验证**: 完整的数据验证机制

### 4. 监控系统
- **性能监控**: API响应时间、数据库查询性能
- **错误监控**: 错误率统计和告警
- **业务监控**: 登录失败、并发用户等业务指标
- **日志系统**: 结构化日志记录和查询

### 5. 调试和维护工具
- **用户调试**: `debug-user` - 查询用户详细信息，包括密码格式、状态等
- **组织调试**: `debug-org` - 查询特定组织信息
- **组织管理**: `list-orgs` - 列出所有组织，`create-org` - 创建新组织
- **数据修复**: `fix-user-status` - 修复用户状态字段，`reset-user-password` - 重置密码格式
- **故障排查**: 提供完整的数据诊断和修复功能

## API 文档

### 认证 API

#### 用户登录
```
POST /auth
Action: login

Request:
{
  "action": "login",
  "data": {
    "orgId": "组织ID",
    "username": "用户名",
    "password": "密码"
  }
}

Response:
{
  "success": true,
  "message": "登录成功",
  "data": {
    "accessToken": "访问令牌",
    "refreshToken": "刷新令牌",
    "expiresIn": 86400,
    "user": {
      "id": "用户ID",
      "username": "用户名",
      "role": "角色",
      "orgId": "组织ID",
      "permissions": ["权限列表"]
    }
  }
}
```

#### 令牌验证
```
POST /auth
Action: verify

Request:
{
  "action": "verify",
  "data": {
    "token": "访问令牌"
  }
}

Response:
{
  "success": true,
  "message": "令牌有效",
  "data": {
    "userId": "用户ID",
    "username": "用户名",
    "role": "角色",
    "permissions": ["权限列表"]
  }
}
```

#### 令牌刷新
```
POST /auth
Action: refresh

Request:
{
  "action": "refresh",
  "data": {
    "refreshToken": "刷新令牌"
  }
}

Response:
{
  "success": true,
  "message": "令牌刷新成功",
  "data": {
    "accessToken": "新访问令牌",
    "refreshToken": "新刷新令牌",
    "expiresIn": 86400
  }
}
```

#### 用户登出
```
POST /auth
Action: logout

Request:
{
  "action": "logout",
  "data": {
    "token": "访问令牌"
  }
}

Response:
{
  "success": true,
  "message": "登出成功"
}
```

## 数据库设计

### 核心数据表

#### users (用户表)
```javascript
{
  _id: ObjectId,
  username: String,        // 用户名
  password: String,        // 加密密码
  salt: String,           // 密码盐值
  org_id: String,         // 组织ID
  role: String,           // 角色
  permissions: Array,     // 权限列表
  status: String,         // 状态: active/inactive
  loginAttempts: Number,  // 登录尝试次数
  lastFailedLogin: Date,  // 最后失败登录时间
  lastLoginTime: Date,    // 最后登录时间
  createdAt: Date,        // 创建时间
  updatedAt: Date         // 更新时间
}
```

#### organizations (组织表)
```javascript
{
  _id: ObjectId,
  orgId: String,          // 组织编码
  name: String,           // 组织名称
  type: String,           // 组织类型
  status: Number,         // 状态: 1-启用, 0-禁用
  settings: Object,       // 组织设置
  createdAt: Date,
  updatedAt: Date
}
```

#### user_sessions (用户会话表)
```javascript
{
  _id: ObjectId,
  userId: String,         // 用户ID
  accessToken: String,    // 访问令牌
  refreshToken: String,   // 刷新令牌
  isActive: Boolean,      // 是否活跃
  expiresAt: Date,        // 过期时间
  lastActivity: Date,     // 最后活动时间
  deviceInfo: Object,     // 设备信息
  createdAt: Date
}
```

#### logs (日志表)
```javascript
{
  _id: ObjectId,
  timestamp: String,      // 时间戳
  level: String,          // 日志级别
  context: String,        // 上下文
  message: String,        // 日志消息
  metadata: Object,       // 元数据
  userId: String,         // 用户ID（可选）
  requestId: String,      // 请求ID（可选）
  error: Object,          // 错误信息（可选）
  createdAt: Date
}
```

### 索引设计

系统采用了优化的索引设计来提高查询性能：

- **用户表索引**: `org_id + username`, `org_id + status`
- **会话表索引**: `userId + isActive`, `accessToken`, `refreshToken`
- **日志表索引**: `level + timestamp`, `userId + timestamp`
- **组织表索引**: `orgId`, `status`

## 监控和日志

### 日志系统
- **结构化日志**: 使用JSON格式记录日志
- **日志级别**: ERROR, WARN, INFO, DEBUG, TRACE
- **性能追踪**: 自动记录API响应时间和数据库查询时间
- **请求追踪**: 每个请求分配唯一ID进行全链路追踪

### 监控指标
- **性能指标**: API响应时间、数据库查询时间、内存使用
- **错误指标**: API错误率、数据库错误率、认证失败率
- **业务指标**: 登录失败次数、并发用户数、数据同步延迟

### 告警系统
- **告警级别**: INFO, WARNING, CRITICAL
- **告警阈值**: 可配置的性能和错误率阈值
- **告警通知**: 支持多种通知渠道（可扩展）

## 安全特性

### 认证安全
- **密码加密**: 使用bcrypt进行密码哈希
- **JWT安全**: 访问令牌 + 刷新令牌双令牌机制
- **令牌黑名单**: 支持令牌撤销和黑名单管理
- **会话管理**: 完整的用户会话生命周期管理

### 访问控制
- **登录限制**: 失败次数限制和账户锁定
- **密码策略**: 密码强度验证和定期更换
- **权限控制**: 基于角色的访问控制(RBAC)
- **数据验证**: 完整的输入数据验证和清理

### 数据安全
- **敏感数据**: 自动清理日志中的敏感信息
- **数据加密**: 敏感数据加密存储
- **访问日志**: 完整的数据访问审计日志

## 性能优化

### 数据库优化
- **索引优化**: 针对常用查询的复合索引
- **查询优化**: 智能查询分析和优化建议
- **连接池**: 数据库连接复用和管理

### 缓存策略
- **查询缓存**: 高频查询结果缓存
- **会话缓存**: 用户会话信息缓存
- **配置缓存**: 系统配置信息缓存

### 代码优化
- **异步处理**: 全面使用异步编程模式
- **错误处理**: 完善的错误处理和恢复机制
- **资源管理**: 自动资源清理和内存管理

## 常见问题

### Q: 如何重置用户密码？
A: 调用认证API的resetPassword操作，系统会生成临时密码并要求用户首次登录时修改。

### Q: 如何处理令牌过期？
A: 客户端应监听401错误，自动使用refreshToken刷新访问令牌。

### Q: 如何查看系统监控数据？
A: 可以通过云开发控制台查看日志，或调用监控API获取实时指标。

### Q: 如何扩展权限系统？
A: 在用户表的permissions字段中添加新权限，并在API中进行相应的权限检查。

### Q: 用户登录失败"组织编码、工号或密码错误"怎么办？
A: 按以下步骤排查：
1. 使用 `debug-org` 云函数检查组织是否存在
2. 使用 `debug-user` 云函数检查用户信息和状态
3. 如果组织不存在，使用 `create-org` 云函数创建
4. 如果用户状态不正确，使用 `fix-user-status` 云函数修复
5. 如果密码格式不匹配，使用 `reset-user-password` 云函数重置

### Q: 如何诊断用户登录问题？
A: 使用调试工具进行系统性排查：
```bash
# 1. 检查用户详细信息
tcb fn invoke debug-user --params '{"username":"用户名","orgId":"组织ID"}'

# 2. 检查组织是否存在
tcb fn invoke debug-org --params '{"orgId":"组织ID"}'

# 3. 列出所有组织
tcb fn invoke list-orgs

# 4. 修复用户状态（如需要）
tcb fn invoke fix-user-status --params '{"username":"用户名","orgId":"组织ID"}'

# 5. 重置密码格式（如需要）
tcb fn invoke reset-user-password --params '{"username":"用户名","orgId":"组织ID","newPassword":"新密码"}'
```

## 更新日志

### v1.2.0 (2024-01-21)
- 🐛 修复登录后自动退出问题
  - 解决token参数传递不匹配问题（小程序端data.token vs 云函数端event.token）
  - 修正数据库查询字段不一致问题（sessionToken vs accessToken）
  - 完善token验证逻辑，增加兼容性处理
- 🧹 移除调试界面和数据初始化界面
  - 删除debug-storage调试页面
  - 移除startup页面（紫色数据初始化界面）
  - 删除database-init数据库初始化页面
  - 清理app.js中的数据库初始化检查逻辑
  - 移除未使用的databaseInit.js工具文件
  - 优化登录错误处理，移除跳转到初始化页面的逻辑
  - 清理app.json中的相关页面配置
  - 优化小程序页面结构
- 📝 更新项目文档和问题解决记录

### v1.1.0 (2024-01-20)
- 新增调试和维护工具集
- 添加用户登录问题诊断功能
- 实现数据修复工具（用户状态、密码格式）
- 完善组织管理功能
- 优化登录错误处理和故障排查流程
- 更新项目文档和常见问题解答

### v1.0.0 (2024-01-XX)
- 初始版本发布
- 完整的认证系统
- 基础业务API
- 监控和日志系统
- 数据库优化

## 联系方式

如有问题或建议，请联系开发团队。

## 许可证

本项目采用 MIT 许可证。LOGIN_LOCKOUT_TIME=900000
```

5. **在微信开发者工具中打开小程序**
   - 导入项目，选择 `miniprogram` 目录
   - 配置AppID和云开发环境

## 📁 项目结构

```
yunsf3/
├── miniprogram/          # 小程序源码
│   ├── pages/           # 页面文件
│   ├── utils/           # 工具函数
│   └── app.js           # 小程序入口
├── cloudfunctions/      # 云函数
│   ├── api/            # 主要API函数
│   ├── auth/           # 认证函数
│   └── login/          # 登录函数
├── web/                # Web管理端
├── admin/              # Admin后台
├── 项目文档.md          # 完整项目文档
└── README.md           # 项目说明
```

## 🔧 部署说明

### 云函数部署
```bash
tcb functions deploy --all -e cloud1-3gwlq66232d160ab
```

### 静态托管部署
```bash
# Web端
tcb hosting deploy web -e cloud1-3gwlq66232d160ab

# Admin端
tcb hosting deploy admin -e cloud1-3gwlq66232d160ab
```

### HTTP访问服务
```bash
# 创建并开启HTTP访问服务
tcb service create -p /web -f api
tcb service switch
```

## 📚 文档

- **完整文档**：查看 `项目文档.md` 获取详细的配置、部署和使用说明
- **快速开始**：查看 `QUICK_START.md` 了解一键启动流程
- **数据库配置**：查看 `CLOUD_DATABASE_SETUP.md` 了解数据库初始化
- **静态托管**：查看 `CLOUDBASE_HOSTING_SETUP_GUIDE.md` 了解托管配置

## 🐛 常见问题

1. **HTTPSERVICE_NONACTIVATED 错误**：运行 `tcb service switch` 开启HTTP服务
2. **数据库未初始化**：在小程序中点击"初始化数据库"按钮
3. **云函数部署失败**：检查网络连接和环境ID配置
4. **小程序无法登录**：确认数据库已初始化且云函数部署成功

详细解决方案请查看 `项目文档.md` 中的常见问题部分。

## 🤝 贡献

欢迎提交Issue和Pull Request来改进项目。

## 📄 许可证

MIT License
