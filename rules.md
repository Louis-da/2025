# 云收发微信小程序开发规范与架构指南

本文档定义了云收发微信小程序的完整开发规范、架构设计、安全要求和最佳实践，确保项目代码的稳健性、可维护性和安全性。

---

## 📋 项目基本信息

**项目名称**: 云收发微信小程序  
**合法域名**: aiyunsf.com  
**服务器**: 腾讯云服务器 (ssh root@175.178.33.180)  
**数据库**: MySQL 8.0 (数据库名: processing_app)  
**技术栈**: 微信小程序 + Node.js + Express + MySQL  
**部署路径**: /root/processing-app/server/

---

## 🎯 开发原则与理念

### 1. 代码生成原则（按优先级）
1. **First Principles（第一性原理）**: 梳理最核心需求与边界
2. **YAGNI**: 只实现当前真正需要的功能
3. **KISS**: 保持设计和实现的简单性
4. **SOLID**: 面向对象/模块化设计时，遵循单一职责、开放封闭等
5. **DRY**: 消除重复，提炼公用逻辑

### 2. 代码实现原则
1. 始终遵循"先思路，后代码"的顺序解决技术问题
2. 先全局性解释目的和原理，实现路径，先做什么用于什么，然后如何，列出关键开发点
3. 提供任何人都看得懂的todolist确保与用户对齐开发思路，才提供代码实现
4. **优先考虑已经经过市场验证的可靠成熟技术实现路径**

### 3. 修复问题原则
- **第一原则**: 代码健壮简洁，项目运行稳定可靠
- **数据隔离**: 每个组织之间数据是独立隔离分开的
- **功能保持**: 只修改问题，其它功能保持不变
- **安全优先**: 定位问题前，先阅读项目文件

---

## 🏗️ 项目架构设计

### 1. 整体架构
```
云收发系统架构
├── 前端层 (微信小程序)
│   ├── 用户界面层
│   ├── 业务逻辑层
│   └── 数据访问层
├── 网关层 (Nginx)
│   ├── 反向代理
│   ├── SSL终端
│   └── 负载均衡
├── 应用层 (Node.js + Express)
│   ├── 认证中间件
│   ├── 业务路由
│   ├── 数据验证
│   └── 错误处理
├── 数据层 (MySQL)
│   ├── 业务数据
│   ├── 用户数据
│   └── 日志数据
└── 存储层 (文件系统)
    ├── 图片存储
    └── 日志文件
```

### 2. 微信小程序架构
```
miniprogram/
├── pages/                  # 页面目录
│   ├── login/             # 登录页面
│   ├── home/              # 首页
│   ├── products/          # 货品管理
│   ├── orders/            # 订单管理
│   ├── factories/         # 工厂管理
│   ├── statement/         # 对账单
│   ├── flow-table/        # AI流水表
│   └── settings/          # 设置页面
├── components/            # 通用组件
│   ├── order-card/        # 订单卡片
│   ├── product-item/      # 货品项
│   └── loading/           # 加载组件
├── utils/                 # 工具函数
│   ├── request.js         # 网络请求
│   ├── auth.js           # 认证工具
│   └── common.js         # 通用工具
├── images/               # 图片资源
├── styles/               # 样式文件
└── app.js               # 应用入口
```

### 3. 服务端架构
```
server/
├── routes/               # 路由模块
│   ├── auth.js          # 认证路由
│   ├── products.js      # 货品管理
│   ├── orders.js        # 订单管理
│   ├── factories.js     # 工厂管理
│   ├── processes.js     # 工序管理
│   ├── colors.js        # 颜色管理
│   ├── sizes.js         # 尺码管理
│   ├── send-orders.js   # 发出单
│   ├── receive-orders.js# 收回单
│   ├── statement.js     # 对账单
│   ├── flow-table-ai.js # AI流水表
│   └── ai-reports.js    # AI报表
├── middleware/          # 中间件
│   └── auth.js         # 认证中间件
├── config/             # 配置文件
├── logs/               # 日志目录
├── db.js              # 数据库连接
├── logger.js          # 日志系统
├── schema.sql         # 数据库结构
└── app.js            # 应用入口
```

---

## 🔐 数据安全与隔离

### 1. 数据隔离架构
```javascript
// 四层安全防护
1. 认证层: JWT Token验证用户身份
2. 授权层: 中间件提取用户组织ID
3. 数据层: 所有数据库操作强制组织过滤
4. 验证层: 双重ID验证（记录ID + 组织ID）
```

### 2. 数据库字段规范
```sql
-- 所有业务表必须包含orgId字段
-- 实际数据库字段结构（驼峰命名）
processes.orgId     -- 工序表组织ID
products.orgId      -- 货品表组织ID
factories.orgId     -- 工厂表组织ID
colors.orgId        -- 颜色表组织ID
sizes.orgId         -- 尺码表组织ID
users.orgId         -- 用户表组织ID

-- 排序字段
processes.order     -- 工序排序
colors.order        -- 颜色排序
sizes.orderNum      -- 尺码排序
```

### 3. 安全编码规范
```javascript
// ✅ 正确的数据隔离模式
router.use(authenticate); // 所有路由使用认证中间件

// 强制使用当前用户的组织ID
const orgId = req.user.orgId;
if (!orgId) {
  return res.status(400).json({
    success: false,
    message: '无法获取组织ID'
  });
}

// 查询模式 - 强制组织过滤
const condition = { orgId };
const result = await db.products.find(condition);

// 更新模式 - 双重验证
const result = await db.updateOne(
  { id: parseInt(id), orgId }, // 强制按ID和组织ID过滤
  updateData
);

// 删除模式 - 严格限制
const result = await db.deleteOne({ 
  id: parseInt(id), 
  orgId // 强制按组织ID过滤
});
```

---

## 💾 数据库设计规范

### 1. 表结构设计
```sql
-- 核心业务表
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  orgId VARCHAR(50) NOT NULL,  -- 组织隔离字段
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orgId (orgId),     -- 组织ID索引
  INDEX idx_orgId_name (orgId, name)  -- 复合索引
);
```

### 2. 索引优化规范
- **主键索引**: 所有表必须有自增主键
- **组织索引**: orgId字段必须建立索引
- **复合索引**: orgId + 业务字段复合索引
- **查询优化**: 避免全表扫描，合理使用LIMIT

### 3. 数据完整性
- **外键约束**: 确保数据关联完整性
- **非空约束**: 关键字段不允许为空
- **唯一约束**: 业务唯一性约束
- **检查约束**: 数据有效性检查

---

## 📝 代码规范

### 1. 命名规范
- **变量名**: 小驼峰命名法（camelCase），如 `orderList`、`factoryName`
- **常量**: 全大写，下划线分隔，如 `MAX_ORDER_COUNT`、`API_BASE_URL`
- **类名**: 大驼峰命名法（PascalCase），如 `OrderManager`、`FactoryService`
- **文件名**: 小写字母和连字符，如 `order-detail.js`、`factory-list.js`
- **数据库表名**: 小写复数形式，如 `orders`、`factories`
- **数据库字段**: 驼峰命名法，如 `orgId`、`createTime`

### 2. 代码格式化
- **缩进**: 使用2个空格
- **最大行长**: 80个字符
- **文件末尾**: 保留一个空行
- **字符串**: 优先使用单引号（''）
- **分号**: 每条语句结束添加分号

### 3. 注释规范
```javascript
/**
 * 获取工厂列表
 * @param {string} orgId - 组织ID
 * @param {number} page - 页码
 * @param {number} pageSize - 每页数量
 * @returns {Promise<Object>} 工厂列表数据
 */
async function getFactoryList(orgId, page = 1, pageSize = 10) {
  // 验证参数
  if (!orgId) {
    throw new Error('组织ID不能为空');
  }
  
  // 构建查询条件
  const condition = { orgId };
  
  // TODO: 添加分页功能
  const result = await db.factories.find(condition);
  
  return result;
}
```

### 4. 错误处理规范
```javascript
// 统一错误处理格式
try {
  const result = await someAsyncOperation();
  res.json({
    success: true,
    data: result,
    message: '操作成功'
  });
} catch (error) {
  logger.error('操作失败:', error);
  res.status(500).json({
    success: false,
    message: '操作失败',
    error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : error.message
  });
}
```

---

## 🎨 微信小程序开发规范

### 1. 目录结构规范
- **pages/**: 按功能模块组织页面
- **components/**: 通用组件，可复用
- **utils/**: 工具函数，纯函数优先
- **images/**: 图片资源，支持webp格式
- **styles/**: 全局样式文件

### 2. WXML规范
```xml
<!-- ✅ 正确的WXML写法 -->
<view class="container">
  <view class="header" wx:if="{{showHeader}}">
    <text class="title">{{title}}</text>
  </view>
  <scroll-view class="content" scroll-y="{{true}}">
    <view class="item" wx:for="{{list}}" wx:key="id" bindtap="onItemTap" data-id="{{item.id}}">
      <text class="item-name">{{item.name}}</text>
    </view>
  </scroll-view>
</view>
```

### 3. WXSS规范
```css
/* ✅ 正确的WXSS写法 */
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

.header {
  padding: 20rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.title {
  font-size: 32rpx;
  font-weight: bold;
  color: #ffffff;
}

/* 响应式设计 */
@media (max-width: 750rpx) {
  .title {
    font-size: 28rpx;
  }
}
```

### 4. JavaScript规范
```javascript
// ✅ 正确的JS写法
Page({
  data: {
    list: [],
    loading: false,
    orgId: ''
  },

  onLoad(options) {
    this.initData();
  },

  async initData() {
    try {
      this.setData({ loading: true });
      
      const orgId = wx.getStorageSync('orgId');
      if (!orgId) {
        wx.showToast({ title: '请先登录', icon: 'error' });
        return;
      }

      const result = await this.fetchData(orgId);
      this.setData({ 
        list: result.data,
        orgId: orgId,
        loading: false 
      });
    } catch (error) {
      console.error('初始化数据失败:', error);
      wx.showToast({ title: '加载失败', icon: 'error' });
      this.setData({ loading: false });
    }
  },

  async fetchData(orgId) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBase}/api/products`,
        method: 'GET',
        data: { orgId },
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        success: (res) => {
          if (res.data.success) {
            resolve(res.data);
          } else {
            reject(new Error(res.data.message));
          }
        },
        fail: reject
      });
    });
  }
});
```

---

## 🚀 服务端开发规范

### 1. 路由设计规范
```javascript
// ✅ 正确的路由设计
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// 所有路由使用认证中间件
router.use(authenticate);

/**
 * 获取货品列表
 * GET /api/products
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword = '' } = req.query;
    const orgId = req.user.orgId; // 从认证中间件获取

    // 构建查询条件
    const condition = { orgId };
    if (keyword) {
      condition.name = { $regex: keyword, $options: 'i' };
    }

    // 分页查询
    const offset = (page - 1) * pageSize;
    const products = await db.products.find(condition)
      .limit(parseInt(pageSize))
      .offset(offset);

    const total = await db.products.count(condition);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    logger.error('获取货品列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取货品列表失败',
      error: error.message
    });
  }
});

module.exports = router;
```

### 2. 数据库操作规范
```javascript
// ✅ 正确的数据库操作
class ProductService {
  // 查询操作 - 必须包含orgId过滤
  static async findByOrgId(orgId, conditions = {}) {
    const finalConditions = { orgId, ...conditions };
    return await db.products.find(finalConditions);
  }

  // 创建操作 - 自动添加orgId
  static async create(orgId, productData) {
    const data = { ...productData, orgId };
    return await db.products.create(data);
  }

  // 更新操作 - 双重验证
  static async updateById(id, orgId, updateData) {
    const conditions = { id: parseInt(id), orgId };
    return await db.products.updateOne(conditions, updateData);
  }

  // 删除操作 - 严格限制
  static async deleteById(id, orgId) {
    const conditions = { id: parseInt(id), orgId };
    return await db.products.deleteOne(conditions);
  }
}
```

### 3. 认证中间件规范
```javascript
// ✅ 认证中间件实现
const jwt = require('jsonwebtoken');
const logger = require('../logger');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '缺少认证令牌'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 验证必要字段
    if (!decoded.userId || !decoded.orgId) {
      return res.status(401).json({
        success: false,
        message: '无效的认证令牌'
      });
    }

    // 将用户信息添加到请求对象
    req.user = {
      userId: decoded.userId,
      orgId: decoded.orgId,
      username: decoded.username
    };

    logger.info(`用户认证成功: ${decoded.username} (${decoded.orgId})`);
    next();
  } catch (error) {
    logger.error('认证失败:', error);
    res.status(401).json({
      success: false,
      message: '认证失败',
      error: error.message
    });
  }
};

module.exports = { authenticate };
```

---

## 📊 性能优化规范

### 1. 数据库性能优化
```sql
-- ✅ 查询优化示例
-- 使用索引优化查询
SELECT * FROM products 
WHERE orgId = ? AND status = 1 
ORDER BY created_at DESC 
LIMIT 20;

-- 避免N+1查询问题
SELECT p.*, c.name as color_name, s.name as size_name
FROM products p
LEFT JOIN colors c ON p.color_id = c.id AND c.orgId = p.orgId
LEFT JOIN sizes s ON p.size_id = s.id AND s.orgId = p.orgId
WHERE p.orgId = ?;
```

### 2. 小程序性能优化
```javascript
// ✅ 性能优化技巧
Page({
  data: {
    list: [],
    hasMore: true
  },

  // 使用防抖优化搜索
  onSearchInput: debounce(function(e) {
    const keyword = e.detail.value;
    this.searchProducts(keyword);
  }, 300),

  // 分页加载优化
  async loadMore() {
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({ loading: true });
    
    try {
      const result = await this.fetchProducts(this.data.page + 1);
      
      this.setData({
        list: [...this.data.list, ...result.data],
        page: this.data.page + 1,
        hasMore: result.data.length === this.data.pageSize,
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  // 图片懒加载
  onImageLoad(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      [`list[${index}].imageLoaded`]: true
    });
  }
});

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

---

## 🧪 测试规范

### 1. 单元测试
```javascript
// ✅ 单元测试示例
const { expect } = require('chai');
const ProductService = require('../services/ProductService');

describe('ProductService', () => {
  describe('findByOrgId', () => {
    it('应该只返回指定组织的货品', async () => {
      const orgId = 'test-org-001';
      const products = await ProductService.findByOrgId(orgId);
      
      expect(products).to.be.an('array');
      products.forEach(product => {
        expect(product.orgId).to.equal(orgId);
      });
    });

    it('应该正确处理空结果', async () => {
      const orgId = 'non-existent-org';
      const products = await ProductService.findByOrgId(orgId);
      
      expect(products).to.be.an('array');
      expect(products).to.have.length(0);
    });
  });
});
```

### 2. 集成测试
```javascript
// ✅ API集成测试
const request = require('supertest');
const app = require('../app');

describe('Products API', () => {
  let authToken;
  
  before(async () => {
    // 获取测试用户的认证令牌
    const loginRes = await request(app)
      .post('/login')
      .send({
        orgId: 'test-org',
        username: 'testuser',
        password: 'testpass'
      });
    
    authToken = loginRes.body.token;
  });

  describe('GET /api/products', () => {
    it('应该返回当前组织的货品列表', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.data).to.be.an('array');
    });

    it('应该拒绝未认证的请求', async () => {
      await request(app)
        .get('/api/products')
        .expect(401);
    });
  });
});
```

---

## 🚀 部署与运维规范

### 1. 环境配置
```bash
# ✅ 生产环境配置
# .env.production
NODE_ENV=production
PORT=4000

# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_secure_password
DB_NAME=processing_app
DB_POOL_MIN=5
DB_POOL_MAX=20

# JWT配置
JWT_SECRET=your_very_secure_jwt_secret
JWT_EXPIRES_IN=7d

# 文件上传配置
UPLOAD_PATH=/var/www/aiyunsf.com/public/uploads
MAX_FILE_SIZE=10485760

# 日志配置
LOG_LEVEL=info
LOG_FILE=/var/log/yunsf/app.log
```

### 2. PM2配置
```json
{
  "apps": [{
    "name": "yunsf-api",
    "script": "app.js",
    "cwd": "/root/processing-app/server",
    "instances": "max",
    "exec_mode": "cluster",
    "env": {
      "NODE_ENV": "production",
      "PORT": 4000
    },
    "error_file": "/var/log/yunsf/err.log",
    "out_file": "/var/log/yunsf/out.log",
    "log_file": "/var/log/yunsf/combined.log",
    "time": true,
    "max_memory_restart": "1G",
    "node_args": "--max_old_space_size=1024"
  }]
}
```

### 3. Nginx配置
```nginx
# ✅ Nginx配置示例
server {
    listen 443 ssl http2;
    server_name aiyunsf.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静态文件
    location /uploads/ {
        alias /var/www/aiyunsf.com/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 📋 代码审查清单

### 1. 安全检查
- [ ] 所有API路由都使用认证中间件
- [ ] 数据库操作都包含orgId过滤
- [ ] 输入数据都经过验证和清理
- [ ] 敏感信息不在日志中暴露
- [ ] SQL查询使用参数化防止注入

### 2. 性能检查
- [ ] 数据库查询使用了适当的索引
- [ ] 避免了N+1查询问题
- [ ] 大数据量操作使用了分页
- [ ] 图片等资源进行了压缩优化
- [ ] 缓存策略合理有效

### 3. 代码质量检查
- [ ] 代码符合命名规范
- [ ] 函数职责单一，复杂度合理
- [ ] 错误处理完整有效
- [ ] 注释清晰准确
- [ ] 测试覆盖率达标

### 4. 功能检查
- [ ] 功能实现符合需求
- [ ] 边界条件处理正确
- [ ] 用户体验良好
- [ ] 兼容性测试通过
- [ ] 性能指标达标

---

## 📚 参考资源

### 1. 官方文档
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Node.js官方文档](https://nodejs.org/docs/)
- [Express.js文档](https://expressjs.com/)
- [MySQL文档](https://dev.mysql.com/doc/)

### 2. 最佳实践
- [JavaScript代码规范](https://github.com/airbnb/javascript)
- [Node.js最佳实践](https://github.com/goldbergyoni/nodebestpractices)
- [微信小程序性能优化](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/)

---

## 📞 技术支持

**项目维护**: 云上针纺技术团队  
**技术咨询**: 通过项目内部沟通渠道  
**紧急联系**: 项目负责人  

---

*本规范由开发团队共同维护，适用于云收发微信小程序的开发过程中，确保项目代码质量稳健。最终解释权归技术负责人所有。*

*最后更新时间: 2025年5月26日*