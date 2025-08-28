// 产品相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path'); // <--- 确保引入 path
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

/**
 * 获取产品列表
 * GET /api/products
 * 可选查询参数: orgId, productNo (货号)
 */
router.get('/', async (req, res) => {
  try {
    const { productNo } = req.query; // 移除orgId从这里获取
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('products / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    const condition = {};
    condition.orgId = orgId; // 强制使用当前用户orgId
    
    if (productNo) {
      condition.code = productNo;
    }
    const products = await db.products.find(condition);

    const safeProducts = await Promise.all(products.map(async item => {
      let originalDbPath = item.image || ''; 
      let thumbnailUrl = '';
      let originalImageUrl = '';

      if (originalDbPath) {
        if (!originalDbPath.startsWith('/uploads/')) {
            originalDbPath = ('/uploads/' + originalDbPath.replace(/^\/?uploads\/?/, '')).replace(/^\/\//, '/');
        }
        originalImageUrl = originalDbPath;

        // 构造缩略图URL
        const parts = originalDbPath.split('/');
        const filenameWithExt = parts.pop();
        const pathToDir = parts.join('/');
        
        // 检查文件名是否已经包含_thumb后缀，避免重复添加
        const ext = path.extname(filenameWithExt);
        const basename = path.basename(filenameWithExt, ext);
        
        if (basename.endsWith('_thumb')) {
          // 如果文件名已经包含_thumb后缀，则直接使用
          thumbnailUrl = `${pathToDir}/${basename}${ext}`;
          console.log('[Products] 文件名已包含_thumb后缀，保持原样:', thumbnailUrl);
        } else {
          // 如果文件名不包含_thumb后缀，则添加
          thumbnailUrl = `${pathToDir}/${basename}_thumb${ext}`;
          console.log('[Products] 添加_thumb后缀到文件名:', thumbnailUrl);
        }
      } else {
        thumbnailUrl = '/images/default-product.png';
        originalImageUrl = '/images/default-product.png';
      }

      // 查询产品的颜色关联 - 强制按当前用户组织ID过滤颜色表
      const productColors = await db.executeQuery(`
        SELECT c.name 
        FROM product_colors pc 
        JOIN colors c ON pc.color_id = c.id 
        WHERE pc.product_id = ? AND c.orgId = ?
      `, [item.id, orgId]);
      
      // 查询产品的尺码关联 - 强制按当前用户组织ID过滤尺码表
      const productSizes = await db.executeQuery(`
        SELECT s.name 
        FROM product_sizes ps 
        JOIN sizes s ON ps.size_id = s.id 
        WHERE ps.product_id = ? AND s.orgId = ?
      `, [item.id, orgId]);
      
      // 获取颜色和尺码名称数组
      const colorOptions = productColors.map(c => c.name);
      const sizeOptions = productSizes.map(s => s.name);
      
      // 设置 colors 和 sizes 字段为逗号分隔的字符串，用于前端显示
      const colors = colorOptions.join(',');
      const sizes = sizeOptions.join(',');

      console.log(`[fetchProducts] Product ID: ${item.id}, Colors: '${colors}', Sizes: '${sizes}'`);
      console.log(`[fetchProducts] 使用的图片路径: originalImageUrl=${originalImageUrl}, thumbnailUrl=${thumbnailUrl}`);

      return {
        ...item,
        image: thumbnailUrl, 
        imageUrl: thumbnailUrl, 
        originalImageUrl: originalImageUrl, 
        productNo: item.productNo || item.code || '',
        colors,  // 设置颜色为逗号分隔的字符串
        sizes,   // 设置尺码为逗号分隔的字符串
        colorOptions,  // 保留颜色选项数组，供前端使用
        sizeOptions    // 保留尺码选项数组，供前端使用
      };
    }));

    res.json({
      success: true,
      data: safeProducts
    });
  } catch (err) {
    console.error('获取产品列表失败:', err);
    res.status(500).json({
      success: false,
      message: '获取产品列表失败',
      error: err.message
    });
  }
});

/**
 * 获取产品统计信息
 * GET /api/products/stats
 */
router.get('/stats', async (req, res) => {
  try {
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('products /stats 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    // 查询产品总数 - 强制按组织ID过滤
    const totalCountQuery = 'SELECT COUNT(*) as count FROM products WHERE orgId = ?';
    const [totalCountResult] = await db.executeQuery(totalCountQuery, [orgId]);
    
    // 查询启用状态的产品数 - 强制按组织ID过滤
    const activeCountQuery = 'SELECT COUNT(*) as count FROM products WHERE orgId = ? AND status = 1';
    const [activeCountResult] = await db.executeQuery(activeCountQuery, [orgId]);
    
    // 查询停用状态的产品数 - 强制按组织ID过滤
    const inactiveCountQuery = 'SELECT COUNT(*) as count FROM products WHERE orgId = ? AND status = 0';
    const [inactiveCountResult] = await db.executeQuery(inactiveCountQuery, [orgId]);
    
    // 组装统计数据
    const stats = {
      totalCount: totalCountResult ? totalCountResult.count : 0,
      activeCount: activeCountResult ? activeCountResult.count : 0,
      inactiveCount: inactiveCountResult ? inactiveCountResult.count : 0
    };
    
    console.log('[Product Stats API] Returning stats:', stats); // 调试日志
    
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('获取产品统计信息失败:', err);
    res.status(500).json({
      success: false,
      message: '获取产品统计信息失败',
      error: err.message
    });
  }
});

/*
 * 删除产品 (已停用)
 * DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.products.deleteOne({ id: parseInt(id) });
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到要删除的产品'
      });
    }
    res.json({
      success: true,
      message: '产品删除成功'
    });
  } catch (err) {
    console.error('删除产品失败:', err);
    res.status(500).json({
      success: false,
      message: '删除产品失败',
      error: err.message
    });
  }
});
*/

/*
 * 清空指定组织的所有产品 (已停用)
 * DELETE /api/products/org/:orgId
router.delete('/org/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    const result = await db.products.deleteMany({ orgId });
    res.json({
      success: true,
      message: `已删除${result.affectedRows}条产品记录`,
      count: result.affectedRows
    });
  } catch (err) {
    console.error('清空产品失败:', err);
    res.status(500).json({
      success: false,
      message: '清空产品失败',
      error: err.message
    });
  }
});
*/

/**
 * 获取产品详情
 * GET /api/products/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('products /:id 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 强制按产品ID和组织ID过滤
    const product = await db.products.findOne({ id: parseInt(id), orgId: orgId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '未找到该产品'
      });
    }

    // 自动补全图片路径
    let imageUrl = product.imageUrl || product.image || '';
    if (imageUrl && !imageUrl.startsWith('/uploads/')) {
      imageUrl = '/uploads/' + imageUrl.replace(/^\/?/, '');
    }
    if (!imageUrl) {
      imageUrl = '/images/default-product.png';
    }
    product.imageUrl = imageUrl;
    product.productNo = product.productNo || product.code || '';

    // 查询产品的颜色关联 - 强制按当前用户组织ID过滤颜色表
    const productColors = await db.executeQuery(`
      SELECT c.name 
      FROM product_colors pc 
      JOIN colors c ON pc.color_id = c.id 
      WHERE pc.product_id = ? AND c.orgId = ?
    `, [product.id, orgId]);
    
    // 查询产品的尺码关联 - 强制按当前用户组织ID过滤尺码表
    const productSizes = await db.executeQuery(`
      SELECT s.name 
      FROM product_sizes ps 
      JOIN sizes s ON ps.size_id = s.id 
      WHERE ps.product_id = ? AND s.orgId = ?
    `, [product.id, orgId]);
    
    // 获取颜色和尺码名称数组
    const colorOptions = productColors.map(c => c.name);
    const sizeOptions = productSizes.map(s => s.name);
    
    // 设置 colors 和 sizes 字段为逗号分隔的字符串，用于前端显示
    product.colors = colorOptions.join(',');
    product.sizes = sizeOptions.join(',');
    
    // 处理工序字段 - 如果数据库中已有processes字段，则直接使用
    // 注意：与colors/sizes不同，processes目前是直接存储在产品表中，而非关联表
    console.log('[getProductDetail] 原始工序信息:', product.processes);
    
    // 如果processes为null或undefined，设置为空字符串防止前端解析错误
    if (product.processes === null || product.processes === undefined) {
      product.processes = '';
      console.log('[getProductDetail] 工序为空，设置为空字符串');
    } else {
      console.log('[getProductDetail] 使用数据库中的工序信息:', product.processes);
    }
    
    // 还需要保留以前的 colorOptions 和 sizeOptions 字段，因为前端可能还在使用
    product.colorOptions = colorOptions;
    product.sizeOptions = sizeOptions;
    // 为工序也添加processOptions数组，保持与颜色和尺码一致的处理方式
    product.processOptions = product.processes ? product.processes.split(',').map(p => p.trim()).filter(Boolean) : [];

    console.log(`[getProductDetail] Product ID: ${product.id}, Colors: '${product.colors}', Sizes: '${product.sizes}', Processes: '${product.processes}'`);

    res.json({
      success: true,
      data: product
    });
  } catch (err) {
    console.error('获取产品详情失败:', err);
    res.status(500).json({
      success: false,
      message: '获取产品详情失败',
      error: err.message
    });
  }
});

/**
 * 新增产品
 * POST /api/products
 */
router.post('/', async (req, res) => {
  try {
    const productData = req.body;
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('products POST / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    // 字段校验
    if (!productData.name || !productData.code) {
      return res.status(400).json({
        success: false,
        message: '缺少必要字段 (name, code)'
      });
    }
    // 只保留数据库有的字段 - 强制设置orgId
    const insertData = {
      name: productData.name,
      code: productData.code,
      description: productData.description || '',
      orgId: orgId, // 强制使用当前用户orgId
      status: productData.status === undefined ? 1 : productData.status, // 确保有默认状态
      image: productData.image || '',
      colors: productData.colors || '',
      sizes: productData.sizes || '',
      processes: productData.processes || '' // 添加processes字段
    };
    const result = await db.products.insertOne(insertData);
    const productId = result.insertId;
    // 自动同步SKU
    if (productId) {
      // 颜色
      if (productData.colors) {
        const colorNames = productData.colors.split(',').map(s => s.trim()).filter(Boolean);
        for (const colorName of colorNames) {
          // 查找颜色ID - 强制按当前用户组织ID过滤颜色表
          const colorRows = await db.executeQuery('SELECT id FROM colors WHERE name = ? AND orgId = ?', [colorName, orgId]); // 强制使用当前用户orgId过滤
          if (colorRows.length > 0) {
            const colorId = colorRows[0].id;
            // 避免重复插入
            await db.executeQuery('INSERT IGNORE INTO product_colors (product_id, color_id) VALUES (?, ?)', [productId, colorId]);
          }
        }
      }
      // 尺码
      if (productData.sizes) {
        const sizeNames = productData.sizes.split(',').map(s => s.trim()).filter(Boolean);
        for (const sizeName of sizeNames) {
          const sizeRows = await db.executeQuery('SELECT id FROM sizes WHERE name = ? AND orgId = ?', [sizeName, orgId]); // 强制使用当前用户orgId过滤
          if (sizeRows.length > 0) {
            const sizeId = sizeRows[0].id;
            await db.executeQuery('INSERT IGNORE INTO product_sizes (product_id, size_id) VALUES (?, ?)', [productId, sizeId]);
          }
        }
      }
    }
    res.status(201).json({
      success: true,
      message: '产品添加成功',
      data: { id: productId }
    });
  } catch (err) {
    console.error('添加产品失败:', err);
    // 检查是否为唯一约束冲突 (例如货号code已存在)
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: '货号已存在，请使用不同的货号' });
    }
    res.status(500).json({
      success: false,
      message: '添加产品失败',
      error: err.message
    });
  }
});

/**
 * 编辑产品
 * PUT /api/products/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const productData = req.body;
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('products PUT /:id 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    console.log('[ProductUpdateAPI] 收到更新请求，ID:', id);
    console.log('[ProductUpdateAPI] 收到更新数据:', JSON.stringify(productData));
    console.log('[ProductUpdateAPI] 工序信息:', productData.processes);

    // 字段校验 - 移除orgId的校验
    if (!productData.name || !productData.code) {
      return res.status(400).json({
        success: false,
        message: '缺少必要字段 (name, code)'
      });
    }
    // 构建更新数据，不包括 id, orgId, createTime, updateTime - 确保不会更新orgId
    const updateData = {
      name: productData.name,
      code: productData.code,
      description: productData.description || null, // 允许清空
      image: productData.image || null,          // 允许清空
      colors: productData.colors || null,        // 允许清空
      sizes: productData.sizes || null,          // 允许清空
      processes: productData.processes || null   // 允许清空，添加processes字段
    };

    // 如果传入了_forceUpdateImage标记，强制更新图片字段，即使为空
    if (productData._forceUpdateImage && productData.image !== undefined) {
      console.log('[ProductUpdateAPI] 强制更新图片字段:', productData.image);
      updateData.image = productData.image; // 这可以是空字符串，表示移除图片
    }

    // 如果传入了_forceUpdateProcesses标记，强制更新工序字段
    if (productData._forceUpdateProcesses && productData.processes !== undefined) {
      console.log('[ProductUpdateAPI] 强制更新工序字段:', productData.processes);
      updateData.processes = productData.processes; // 这可以是空字符串
    }

    // 如果请求中包含 status，则也更新 status (尽管有专门的 /status 接口，但编辑接口也可能需要更新它)
    if (productData.status !== undefined && (productData.status === 0 || productData.status === 1)) {
        updateData.status = productData.status;
    }

    // 过滤掉 undefined 的字段，避免将它们更新为 null (除非显式传入 null)
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    console.log('[ProductUpdateAPI] 最终更新数据:', JSON.stringify(updateData));
    console.log('[ProductUpdateAPI] 最终工序数据:', updateData.processes);

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: '没有提供可更新的字段' });
    }
    
    updateData.updateTime = new Date(); // 手动更新 updateTime

    // 在更新前先获取原产品信息，用于对比变化 - 强制按产品ID和组织ID过滤
    const originalProduct = await db.products.findOne({ id: parseInt(id), orgId: orgId }); // 强制按产品ID和组织ID过滤
    if (originalProduct) {
        console.log('[ProductUpdateAPI] 原产品工序信息:', originalProduct.processes || '无');
    } else {
        // 如果找不到产品，可能是ID错误或跨组织访问
        return res.status(404).json({ success: false, message: '找不到要更新的产品' });
    }

    // 更新数据库 - 强制按产品ID和组织ID过滤
    const result = await db.products.updateOne({ id: parseInt(id), orgId: orgId }, { $set: updateData }); // 强制按产品ID和组织ID过滤
    console.log('[ProductUpdateAPI] 数据库更新结果:', JSON.stringify(result));

    // 更新后立即获取产品信息，确认是否成功保存 - 强制按产品ID和组织ID过滤
    const updatedProduct = await db.products.findOne({ id: parseInt(id), orgId: orgId }); // 强制按产品ID和组织ID过滤
    if (updatedProduct) {
        console.log('[ProductUpdateAPI] 更新后产品工序信息:', updatedProduct.processes || '无');
    }

    if (result.affectedRows === 0 && result.matchedCount === 0) {
        // 如果没有行受影响，可能是因为产品不存在，或者提供的数据与现有数据相同
        // 检查产品是否存在以给出更明确的错误
        const productExists = await db.products.findOne({ id: parseInt(id) });
        if (!productExists) {
            return res.status(404).json({ success: false, message: '找不到要更新的产品' });
        }
        // 如果产品存在但没有行受影响，可能表示提供的数据与现有数据一致，这通常不视为错误
    }

    // 自动同步SKU
    // 先删除原有SKU关联 - 只需要按产品ID过滤，因为产品表已经有orgId隔离
    await db.executeQuery('DELETE FROM product_colors WHERE product_id = ?', [id]);
    await db.executeQuery('DELETE FROM product_sizes WHERE product_id = ?', [id]);
    // 重新插入SKU - 强制按当前用户组织ID过滤颜色/尺码表
    if (productData.colors) {
      const colorNames = productData.colors.split(',').map(s => s.trim()).filter(Boolean);
      for (const colorName of colorNames) {
        const colorRows = await db.executeQuery('SELECT id FROM colors WHERE name = ? AND orgId = ?', [colorName, orgId]); // 强制使用当前用户orgId过滤
        if (colorRows.length > 0) {
          const colorId = colorRows[0].id;
          await db.executeQuery('INSERT IGNORE INTO product_colors (product_id, color_id) VALUES (?, ?)', [id, colorId]);
        }
      }
    }
    if (productData.sizes) {
      const sizeNames = productData.sizes.split(',').map(s => s.trim()).filter(Boolean);
      for (const sizeName of sizeNames) {
        const sizeRows = await db.executeQuery('SELECT id FROM sizes WHERE name = ? AND orgId = ?', [sizeName, orgId]); // 强制使用当前用户orgId过滤
        if (sizeRows.length > 0) {
          const sizeId = sizeRows[0].id;
          await db.executeQuery('INSERT IGNORE INTO product_sizes (product_id, size_id) VALUES (?, ?)', [id, sizeId]);
        }
      }
    }
    res.json({
      success: true,
      message: '产品更新成功'
    });
  } catch (err) {
    console.error('更新产品失败:', err);
     // 检查是否为唯一约束冲突 (例如货号code已存在)
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: '货号已存在，请使用不同的货号' });
    }
    res.status(500).json({
      success: false,
      message: '更新产品失败',
      error: err.message
    });
  }
});

/**
 * 更新产品状态 (启用/停用)
 * PUT /api/products/:id/status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('products PUT /:id/status 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    if (status === undefined || (status !== 0 && status !== 1)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值，必须是 0 (停用) 或 1 (启用)'
      });
    }

    // 使用与您文件中其他更新类似的 db.products.updateOne，如果它支持部分更新
    // 否则，db.query 也可以
    // const [result] = await db.query(
    //   'UPDATE products SET status = ?, updateTime = NOW() WHERE id = ?',
    //   [status, parseInt(id)]
    // );

    const result = await db.products.updateOne(
        { id: parseInt(id), orgId: orgId }, // 强制按产品ID和组织ID过滤
        { $set: { status: status, updateTime: new Date() } }
    );

    if (result.affectedRows === 0 && result.matchedCount === 0 ) { // matchedCount 表示找到了记录
      return res.status(404).json({
        success: false,
        message: '找不到要更新状态的产品'
      });
    }
     // 如果 affectedRows 是 0 但 matchedCount 是 1, 表示产品状态已经是目标状态，这通常不视为错误
    if (result.affectedRows === 0 && result.matchedCount === 1) {
        return res.json({
          success: true,
          message: `产品状态已经是 ${status === 1 ? '启用' : '停用'}，未作更改`
        });
    }


    res.json({
      success: true,
      message: `产品状态已更新为 ${status === 1 ? '启用' : '停用'}`
    });
  } catch (err) {
    console.error('更新产品状态失败:', err);
    res.status(500).json({
      success: false,
      message: '更新产品状态失败',
      error: err.message
    });
  }
});

module.exports = router;