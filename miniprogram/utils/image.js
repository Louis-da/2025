// 统一图片URL处理
const BASE_URL = 'https://aiyunsf.com';

function getFullImageUrl(img) {
  if (!img) return '';
  if (/^https?:\/\//.test(img)) return img;
  if (!img.startsWith('/uploads/')) {
    img = '/uploads/' + img.replace(/^\/?/, '');
  }
  return BASE_URL + img;
}

module.exports = {
  getFullImageUrl
}; 