// miniprogram/utils/datetime.js

// Helper function for formatting date and time to YYYY-MM-DD HH:mm
function formatDateTimeToMinute(dateStringOrObject) {
  const d = dateStringOrObject instanceof Date ? dateStringOrObject : new Date(dateStringOrObject);
  if (isNaN(d.getTime())) { // Handle invalid date, return empty string or a placeholder
    return '-'; // Or simply ''
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

// 修正iOS不兼容的日期格式
function fixIOSDateString(str) {
  if (typeof str === 'string' && str.includes('-') && str.includes(':') && !str.includes('T')) {
    // 处理MySQL datetime格式"2025-05-28 08:45:34"
    // 将空格替换为T，形成标准ISO格式
    return str.replace(' ', 'T');
  }
  return str;
}

module.exports = {
  formatDateTimeToMinute,
  fixIOSDateString
}; 