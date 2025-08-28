const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { authenticate } = require('../middleware/auth'); // 导入认证中间件

// 设置基础上传目录
const baseUploadDir = '/var/www/aiyunsf.com/public/uploads';
// 确保基础目录存在
if (!fs.existsSync(baseUploadDir)) {
  try {
    fs.mkdirSync(baseUploadDir, { recursive: true });
    console.log(`基础上传目录已创建: ${baseUploadDir}`);
  } catch (err) {
    console.error(`创建基础上传目录失败: ${baseUploadDir}`, err);
  }
}

// 安全配置
const SECURITY_CONFIG = {
  // 文件大小限制 (5MB)
  maxFileSize: 5 * 1024 * 1024,
  // 允许的文件类型
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ],
  // 允许的文件扩展名
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  // 最大文件名长度
  maxFilenameLength: 100
};

// 安全验证函数
function validateFile(file) {
  const errors = [];
  
  // 检查文件大小
  if (file.size > SECURITY_CONFIG.maxFileSize) {
    errors.push(`文件大小超过限制 (最大 ${SECURITY_CONFIG.maxFileSize / 1024 / 1024}MB)`);
  }
  
  // 检查MIME类型
  if (!SECURITY_CONFIG.allowedMimeTypes.includes(file.mimetype)) {
    errors.push(`不支持的文件类型: ${file.mimetype}`);
  }
  
  // 检查文件扩展名
  const ext = path.extname(file.originalname).toLowerCase();
  if (!SECURITY_CONFIG.allowedExtensions.includes(ext)) {
    errors.push(`不支持的文件扩展名: ${ext}`);
  }
  
  // 检查文件名长度
  if (file.originalname.length > SECURITY_CONFIG.maxFilenameLength) {
    errors.push(`文件名过长 (最大 ${SECURITY_CONFIG.maxFilenameLength} 字符)`);
  }
  
  // 检查文件名是否包含危险字符
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (dangerousChars.test(file.originalname)) {
    errors.push('文件名包含非法字符');
  }
  
  return errors;
}

// 安全的路径验证
function validateOrgId(orgId) {
  // 组织ID只能包含字母、数字、下划线和连字符
  const validOrgIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validOrgIdPattern.test(orgId)) {
    return false;
  }
  
  // 长度限制
  if (orgId.length > 50) {
    return false;
  }
  
  // 防止路径遍历
  if (orgId.includes('..') || orgId.includes('/') || orgId.includes('\\')) {
    return false;
  }
  
  return true;
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 强制使用当前登录用户的组织ID作为子目录名
    const orgId = req.user.orgId;
    if (!orgId) {
      // 如果没有组织ID，返回错误
      return cb(new Error('无法获取组织ID，无法确定上传目录'), null);
    }

    // 验证组织ID的安全性
    if (!validateOrgId(orgId)) {
      return cb(new Error('组织ID格式不安全'), null);
    }

    const orgUploadDir = path.join(baseUploadDir, String(orgId));

    // 检查并创建组织特定的上传目录
    if (!fs.existsSync(orgUploadDir)) {
      try {
        fs.mkdirSync(orgUploadDir, { recursive: true });
        console.log(`组织上传目录已创建: ${orgUploadDir}`);
      } catch (err) {
        console.error(`创建组织上传目录失败: ${orgUploadDir}`, err);
        return cb(new Error(`创建组织上传目录失败: ${err.message}`), null);
      }
    }

    cb(null, orgUploadDir);
  },
  filename: function (req, file, cb) {
    // 安全的文件名生成
    const originalExt = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}_${randomSuffix}${originalExt}`;
    cb(null, filename);
  }
});

// 配置multer，添加文件过滤和大小限制
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: SECURITY_CONFIG.maxFileSize,
    files: 1 // 一次只能上传一个文件
  },
  fileFilter: function (req, file, cb) {
    // 预先验证文件
    const errors = validateFile(file);
    if (errors.length > 0) {
      return cb(new Error(errors.join('; ')), false);
    }
    cb(null, true);
  }
});

// 对上传接口应用认证中间件，确保 req.user 可用
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  // 确保有组织ID
  const orgId = req.user.orgId;
  if (!orgId) {
     console.error('upload POST / 接口：req.user.orgId 为空');
     // 注意：理论上destination函数已经处理了，这里是双重检查
     return res.status(400).json({ success: false, message: '无法获取组织ID' });
  }

  // 验证组织ID安全性
  if (!validateOrgId(orgId)) {
    console.error('upload POST / 接口：组织ID格式不安全:', orgId);
    return res.status(400).json({ success: false, message: '组织ID格式不安全' });
  }

  if (!req.file) {
    console.warn('[Upload] 未上传文件');
    return res.status(400).json({ success: false, message: '未上传文件' });
  }

  // 二次验证上传的文件
  const validationErrors = validateFile(req.file);
  if (validationErrors.length > 0) {
    // 删除已上传的文件
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.error('[Upload] 清理无效文件失败:', cleanupError);
    }
    
    return res.status(400).json({ 
      success: false, 
      message: '文件验证失败: ' + validationErrors.join('; ')
    });
  }

  const originalFilePath = req.file.path; // 文件已被保存到 orgId 子目录中
  const originalFilename = req.file.filename;

  console.log(`[Upload] 开始处理上传文件: ${originalFilename}`);
  console.log(`[Upload] 原始文件完整路径: ${originalFilePath}`);

  // 构建缩略图的保存路径和文件名
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  const thumbnailFilename = `${basename}_thumb${ext}`;
  // 缩略图也保存在 orgId 子目录中
  const thumbnailSavePath = path.join(path.dirname(originalFilePath), thumbnailFilename);

  try {
    // 检查原始文件是否存在（multer已保存）
    if (!fs.existsSync(originalFilePath)) {
      throw new Error('原始文件不存在');
    }

    // 验证文件确实是图片（通过sharp）
    const metadata = await sharp(originalFilePath).metadata();
    if (!metadata.format) {
      throw new Error('文件不是有效的图片格式');
    }

    console.log(`[Upload] 开始生成缩略图: ${thumbnailFilename}`);
    await sharp(originalFilePath)
      .resize(150, 150, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 }) // 统一输出为JPEG格式，减少文件大小
      .toFile(thumbnailSavePath);
    
    console.log(`[Upload] 缩略图生成成功: ${thumbnailSavePath}`);

    // 验证缩略图是否成功生成
    if (!fs.existsSync(thumbnailSavePath)) {
      throw new Error('缩略图生成失败：文件未创建');
    }

    // 返回相对 URL，包含组织ID子目录
    const relativeUrl = `/uploads/${orgId}/${originalFilename}`; // URL包含 orgId
    const thumbnailUrl = `/uploads/${orgId}/${thumbnailFilename}`; // URL包含 orgId

    console.log(`[Upload] 上传成功，返回URL: ${relativeUrl}`);
    console.log(`[Upload] 缩略图URL: ${thumbnailUrl}`);

    res.json({
      success: true,
      url: relativeUrl,
      data: {
        filePath: relativeUrl, // 前端期望的字段
        url: relativeUrl,
        thumbnailUrl: thumbnailUrl
      },
      message: '文件上传成功',
      thumbnailUrl: thumbnailUrl,
      fileInfo: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('[Upload] 处理上传文件时出错:', error);
    
    // 清理可能的残留文件 (原始文件和缩略图)
    try {
      if (fs.existsSync(originalFilePath)) {
        fs.unlinkSync(originalFilePath);
        console.log(`[Upload] 已清理残留的原始文件: ${originalFilePath}`);
      }
      if (fs.existsSync(thumbnailSavePath)) {
        fs.unlinkSync(thumbnailSavePath);
        console.log(`[Upload] 已清理残留的缩略图: ${thumbnailSavePath}`);
      }
    } catch (cleanupError) {
      console.error('[Upload] 清理残留文件失败:', cleanupError);
    }

    res.status(500).json({
      success: false,
      message: '处理上传文件时出错：' + error.message
    });
  }
});

// 专门的备注图片上传接口
router.post('/remark-image', authenticate, upload.single('file'), async (req, res) => {
  // 确保有组织ID
  const orgId = req.user.orgId;
  if (!orgId) {
     console.error('upload POST /remark-image 接口：req.user.orgId 为空');
     return res.status(400).json({ success: false, message: '无法获取组织ID' });
  }

  // 验证组织ID安全性
  if (!validateOrgId(orgId)) {
    console.error('upload POST /remark-image 接口：组织ID格式不安全:', orgId);
    return res.status(400).json({ success: false, message: '组织ID格式不安全' });
  }

  if (!req.file) {
    console.warn('[Upload Remark Image] 未上传文件');
    return res.status(400).json({ success: false, message: '未上传文件' });
  }

  // 二次验证上传的文件
  const validationErrors = validateFile(req.file);
  if (validationErrors.length > 0) {
    // 删除已上传的文件
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.error('[Upload Remark Image] 清理无效文件失败:', cleanupError);
    }
    
    return res.status(400).json({ 
      success: false, 
      message: '文件验证失败: ' + validationErrors.join('; ')
    });
  }

  const originalFilePath = req.file.path;
  const originalFilename = req.file.filename;

  console.log(`[Upload Remark Image] 开始处理备注图片: ${originalFilename}`);
  console.log(`[Upload Remark Image] 原始文件完整路径: ${originalFilePath}`);

  try {
    // 构建文件访问URL
    const fileUrl = `https://aiyunsf.com/uploads/${orgId}/${originalFilename}`;
    
    console.log(`[Upload Remark Image] 备注图片上传成功:`, {
      originalName: req.file.originalname,
      filename: originalFilename,
      size: req.file.size,
      url: fileUrl
    });

    res.json({
      success: true,
      message: '备注图片上传成功',
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (err) {
    console.error('[Upload Remark Image] 处理备注图片失败:', err);
    
    // 清理已上传的文件
    try {
      if (fs.existsSync(originalFilePath)) {
        fs.unlinkSync(originalFilePath);
      }
    } catch (cleanupError) {
      console.error('[Upload Remark Image] 清理文件失败:', cleanupError);
    }
    
    res.status(500).json({
      success: false,
      message: '备注图片上传失败',
      error: err.message
    });
  }
});

// 错误处理中间件
router.use((err, req, res, next) => {
  console.error("[Upload_Router_Error]:", err.message);
  
  // 如果是 Multer 相关的错误
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: `文件大小超过限制 (最大 ${SECURITY_CONFIG.maxFileSize / 1024 / 1024}MB)` 
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  
  // 如果是自定义的安全错误
  if (err instanceof Error && (
    err.message.includes('无法获取组织ID') || 
    err.message.includes('组织ID格式不安全') ||
    err.message.includes('文件验证失败')
  )) {
    return res.status(400).json({ success: false, message: err.message });
  }

  res.status(500).json({ success: false, message: "服务器内部错误，上传失败" });
});

module.exports = router;
