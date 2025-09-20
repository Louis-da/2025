// 统一图片URL处理 - 纯云开发环境
// 不再使用外部服务器，所有图片都通过云存储访问

function getFullImageUrl(img) {
  // 显示处理前的图片路径
  console.log(`[getFullImageUrl] 输入图片路径: ${img}, 类型: ${typeof img}`);
  
  // 处理无效输入
  if (!img || img === 'undefined' || img === 'null') {
    console.warn('[getFullImageUrl] 图片路径为空或无效');
    return '';  // 返回空字符串而不是BASE_URL
  }
  
  // 如果是小程序临时文件路径，直接返回
  if (img.startsWith('wxfile://') || img.startsWith('http://tmp/')) {
    console.log(`[getFullImageUrl] 小程序临时文件路径: ${img}`);
    return img;
  }
  
  // 如果已经是完整的 http/https URL，直接返回
  if (/^https?:\/\//.test(img)) {
    console.log(`[getFullImageUrl] 完整HTTP(S)路径: ${img}`);
    return img;
  }
  
  // 规范化路径，去除可能的前导多余斜杠，并确保以单个 / 开头
  let localImg = String(img); // 确保是字符串类型
  while (localImg.startsWith('//')) {
    localImg = localImg.substring(1);
  }
  if (!localImg.startsWith('/')) {
    localImg = '/' + localImg;
  }

  // 检测无效或空图片路径
  if (localImg === '/' || localImg === '/uploads/' || localImg === '/images/') {
    console.warn('[getFullImageUrl] 检测到空或无效的图片路径');
    return '';
  }

  // 🔧 关键修复：不再处理default-product相关图片，避免无限循环
  if (localImg.includes('default-product')) {
    console.warn('[getFullImageUrl] 检测到default-product图片，返回空字符串避免无限循环');
    return ''; // 返回空字符串，让前端显示占位符
  }

  // 根据路径特征判断是 /uploads/ 还是 /images/ 或其他
  if (localImg.startsWith('/uploads/') || localImg.startsWith('/images/')) {
    // 如果已经是 /uploads/ 或 /images/ 开头，则直接使用
    console.log(`[getFullImageUrl] 路径已包含 /uploads/ 或 /images/: ${localImg}`);
  } else {
    // 默认行为：如果不是 /uploads/ 或 /images/ 开头，则假定它属于 uploads
    console.warn(`[getFullImageUrl] 路径 ${localImg} 不以 /uploads/ 或 /images/ 开头，默认添加到 /uploads/`);
    localImg = '/uploads' + localImg; 
  }
  
  // 🔧 修复：移除对不存在图片的特殊处理，避免产生无效请求
  if (localImg.startsWith('/images/')) {
    // 对于/images/路径的图片，直接构建URL，不做额外的错误处理
    console.log('[getFullImageUrl] 处理/images/路径的图片');
  }
  
  // 对于上传路径的图片，尝试从云存储获取临时链接
  if (localImg.startsWith('/uploads/')) {
    console.log(`[getFullImageUrl] 检测到上传图片路径，尝试获取云存储链接: ${localImg}`);
    
    // 构建云存储文件ID
    const cloudPath = localImg.substring(1); // 移除开头的 /
    const fileID = `cloud://cloud1-3gwlq66232d160ab.636c-cloud1-3gwlq66232d160ab-1327583269/${cloudPath}`;
    
    console.log(`[getFullImageUrl] 构建的云存储文件ID: ${fileID}`);
    
    // 返回云存储的HTTP访问链接
    const cloudUrl = `https://636c-cloud1-3gwlq66232d160ab-1327583269.tcb.qcloud.la/${cloudPath}`;
    console.log(`[getFullImageUrl] 使用云存储HTTP链接: ${cloudUrl}`);
    return cloudUrl;
  }
  
  // 对于本地静态图片（/images/），直接返回相对路径
  if (localImg.startsWith('/images/')) {
    console.log(`[getFullImageUrl] 本地静态图片，返回相对路径: ${localImg}`);
    return localImg;
  }
  
  // 其他情况返回空字符串，避免无效请求
  console.warn(`[getFullImageUrl] 未知图片路径类型: ${localImg}`);
  return '';
}

module.exports = {
  getFullImageUrl
};