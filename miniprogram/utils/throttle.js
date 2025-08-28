// 节流函数：delay毫秒内最多只会触发一次
function throttle(fn, delay = 1000) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last > delay) {
      last = now;
      return fn.apply(this, args);
    }
  };
}

// 防抖函数：delay毫秒内只会触发最后一次
function debounce(fn, delay = 500) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

module.exports = {
  throttle,
  debounce
}; 