// 统一图片URL处理
const BASE_URL = 'https://aiyunsf.com';

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
  
  // 如果已经是完整的 http/https URL，检查是否有域名重复问题
  if (/^https?:\/\//.test(img)) {
    // 检查是否存在域名重复问题
    if (img.includes('aiyunsf.com/https://aiyunsf.com/') || 
        img.includes('aiyunsf.com/http://aiyunsf.com/') ||
        img.includes('aiyunsf.com//aiyunsf.com/')) {
      // 修复重复域名问题
      console.warn('[getFullImageUrl] 检测到重复域名，修正URL');
      const fixedUrl = img.replace(/https?:\/\/aiyunsf\.com\/[\/]?https?:\/\/aiyunsf\.com\//, 'https://aiyunsf.com/');
      console.log(`[getFullImageUrl] 修复后的URL: ${fixedUrl}`);
      return fixedUrl;
    }
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
  
  let fullUrl = BASE_URL + localImg;
  
  // 对于上传路径的图片，添加时间戳防止缓存问题
  if (localImg.startsWith('/uploads/')) {
    // 直接使用完整路径，不要截取文件名，因为路径可能包含orgId目录
    const timestamp = new Date().getTime();
    fullUrl = `${BASE_URL}${localImg}?_t=${timestamp}`;
    console.log(`[getFullImageUrl] 为上传图片添加时间戳: ${fullUrl}`);
  }
  
  console.log(`[getFullImageUrl] 转换后的完整URL: ${fullUrl}`);
  return fullUrl;
}

module.exports = {
  getFullImageUrl
}; 