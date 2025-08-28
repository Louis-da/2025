/**
 * 滚动优化工具 - 修复Web端滑动闪烁问题
 * 通过优化滚动事件监听器减少重绘和重排
 */

class ScrollOptimizer {
    constructor() {
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.rafId = null;
        this.scrollCallbacks = new Map();
        this.lastScrollTop = 0;
        this.scrollDirection = 'down';
        
        // 初始化优化的滚动监听器
        this.initOptimizedScrollListener();
        
        console.log('[ScrollOptimizer] 滚动优化器已初始化');
    }
    
    /**
     * 初始化优化的滚动监听器
     */
    initOptimizedScrollListener() {
        // 使用被动事件监听器提高性能
        const passiveOptions = { passive: true, capture: false };
        
        // 主窗口滚动优化
        window.addEventListener('scroll', this.handleOptimizedScroll.bind(this), passiveOptions);
        
        // 页面可见性变化时暂停/恢复滚动监听
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseScrollListening();
            } else {
                this.resumeScrollListening();
            }
        });
        
        // 窗口失焦时暂停滚动监听
        window.addEventListener('blur', () => this.pauseScrollListening());
        window.addEventListener('focus', () => this.resumeScrollListening());
    }
    
    /**
     * 处理优化的滚动事件
     */
    handleOptimizedScroll() {
        // 如果已经在处理滚动，跳过
        if (this.isScrolling) return;
        
        this.isScrolling = true;
        
        // 使用 requestAnimationFrame 优化滚动处理
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        this.rafId = requestAnimationFrame(() => {
            try {
                // 计算滚动方向
                const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
                this.scrollDirection = currentScrollTop > this.lastScrollTop ? 'down' : 'up';
                this.lastScrollTop = currentScrollTop;
                
                // 执行注册的滚动回调（经过优化）
                this.executeScrollCallbacks();
                
                // 重置滚动状态
                this.isScrolling = false;
                
                // 设置滚动结束检测
                this.detectScrollEnd();
                
            } catch (error) {
                console.error('[ScrollOptimizer] 滚动处理错误:', error);
                this.isScrolling = false;
            }
        });
    }
    
    /**
     * 执行注册的滚动回调
     */
    executeScrollCallbacks() {
        this.scrollCallbacks.forEach((callback, id) => {
            try {
                if (typeof callback === 'function') {
                    callback({
                        scrollTop: this.lastScrollTop,
                        direction: this.scrollDirection,
                        timestamp: performance.now()
                    });
                }
            } catch (error) {
                console.error(`[ScrollOptimizer] 回调 ${id} 执行错误:`, error);
            }
        });
    }
    
    /**
     * 检测滚动结束
     */
    detectScrollEnd() {
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        this.scrollTimeout = setTimeout(() => {
            this.onScrollEnd();
        }, 150); // 150ms 后认为滚动结束
    }
    
    /**
     * 滚动结束处理
     */
    onScrollEnd() {
        // 通知所有监听器滚动已结束
        this.scrollCallbacks.forEach((callback, id) => {
            try {
                if (typeof callback.onScrollEnd === 'function') {
                    callback.onScrollEnd();
                }
            } catch (error) {
                console.error(`[ScrollOptimizer] 滚动结束回调 ${id} 错误:`, error);
            }
        });
        
        // 清理不必要的GPU合成层
        this.cleanupGPULayers();
    }
    
    /**
     * 注册滚动回调
     */
    registerScrollCallback(id, callback, options = {}) {
        if (!id || typeof callback !== 'function') {
            console.warn('[ScrollOptimizer] 无效的滚动回调注册');
            return false;
        }
        
        // 添加节流控制
        const throttleDelay = options.throttle || 16; // 默认16ms (60fps)
        let lastCallTime = 0;
        
        const throttledCallback = (scrollData) => {
            const now = performance.now();
            if (now - lastCallTime >= throttleDelay) {
                lastCallTime = now;
                callback(scrollData);
            }
        };
        
        // 添加滚动结束回调
        if (options.onScrollEnd) {
            throttledCallback.onScrollEnd = options.onScrollEnd;
        }
        
        this.scrollCallbacks.set(id, throttledCallback);
        console.log(`[ScrollOptimizer] 注册滚动回调: ${id}`);
        return true;
    }
    
    /**
     * 移除滚动回调
     */
    unregisterScrollCallback(id) {
        const removed = this.scrollCallbacks.delete(id);
        if (removed) {
            console.log(`[ScrollOptimizer] 移除滚动回调: ${id}`);
        }
        return removed;
    }
    
    /**
     * 智能无限滚动实现
     */
    setupInfiniteScroll(containerId, loadMoreCallback, options = {}) {
        const container = typeof containerId === 'string' 
            ? document.getElementById(containerId) 
            : containerId;
            
        if (!container) {
            console.warn('[ScrollOptimizer] 无效的容器ID:', containerId);
            return null;
        }
        
        const threshold = options.threshold || 1000; // 距离底部1000px时触发
        const throttle = options.throttle || 200; // 200ms节流
        
        let isLoading = false;
        let hasMoreData = true;
        
        const scrollCallback = (scrollData) => {
            if (isLoading || !hasMoreData) return;
            
            const { scrollTop } = scrollData;
            const scrollHeight = document.documentElement.scrollHeight;
            const windowHeight = window.innerHeight;
            
            // 检查是否接近底部
            if (scrollTop + windowHeight >= scrollHeight - threshold) {
                isLoading = true;
                
                // 添加加载状态的视觉反馈
                this.showInfiniteScrollLoading(container);
                
                // 调用加载更多回调
                Promise.resolve(loadMoreCallback()).then((result) => {
                    isLoading = false;
                    this.hideInfiniteScrollLoading(container);
                    
                    // 检查是否还有更多数据
                    if (result && result.hasMore === false) {
                        hasMoreData = false;
                        this.showNoMoreData(container);
                    }
                }).catch((error) => {
                    isLoading = false;
                    this.hideInfiniteScrollLoading(container);
                    console.error('[ScrollOptimizer] 无限滚动加载错误:', error);
                });
            }
        };
        
        const callbackId = `infinite-scroll-${containerId}-${Date.now()}`;
        this.registerScrollCallback(callbackId, scrollCallback, { throttle });
        
        return {
            id: callbackId,
            destroy: () => this.unregisterScrollCallback(callbackId),
            setHasMoreData: (value) => { hasMoreData = value; },
            setLoading: (value) => { isLoading = value; }
        };
    }
    
    /**
     * 显示无限滚动加载状态
     */
    showInfiniteScrollLoading(container) {
        let loadingEl = container.querySelector('.infinite-scroll-loading');
        if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.className = 'infinite-scroll-loading';
            loadingEl.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <div class="loading-spinner" style="margin: 0 auto 10px;"></div>
                    <div>正在加载更多...</div>
                </div>
            `;
            container.appendChild(loadingEl);
        }
        loadingEl.style.display = 'block';
    }
    
    /**
     * 隐藏无限滚动加载状态
     */
    hideInfiniteScrollLoading(container) {
        const loadingEl = container.querySelector('.infinite-scroll-loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }
    
    /**
     * 显示没有更多数据提示
     */
    showNoMoreData(container) {
        let noMoreEl = container.querySelector('.infinite-scroll-no-more');
        if (!noMoreEl) {
            noMoreEl = document.createElement('div');
            noMoreEl.className = 'infinite-scroll-no-more';
            noMoreEl.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #999; font-size: 14px;">
                    已加载全部数据
                </div>
            `;
            container.appendChild(noMoreEl);
        }
        noMoreEl.style.display = 'block';
    }
    
    /**
     * 暂停滚动监听
     */
    pauseScrollListening() {
        this.isScrolling = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
        console.log('[ScrollOptimizer] 滚动监听已暂停');
    }
    
    /**
     * 恢复滚动监听
     */
    resumeScrollListening() {
        // 重置状态
        this.isScrolling = false;
        console.log('[ScrollOptimizer] 滚动监听已恢复');
    }
    
    /**
     * 清理GPU合成层
     */
    cleanupGPULayers() {
        // 在滚动结束后，清理一些不必要的GPU合成层
        requestAnimationFrame(() => {
            const elements = document.querySelectorAll('.card, .btn, .modal-content');
            elements.forEach(el => {
                if (!el.matches(':hover') && !el.classList.contains('active')) {
                    // 暂时移除transform，让浏览器回收GPU内存
                    const originalTransform = el.style.transform;
                    el.style.transform = 'none';
                    
                    // 下一帧重新应用transform
                    requestAnimationFrame(() => {
                        el.style.transform = originalTransform || 'translateZ(0)';
                    });
                }
            });
        });
    }
    
    /**
     * 获取当前滚动信息
     */
    getScrollInfo() {
        return {
            scrollTop: this.lastScrollTop,
            direction: this.scrollDirection,
            isScrolling: this.isScrolling,
            callbackCount: this.scrollCallbacks.size
        };
    }
    
    /**
     * 销毁优化器
     */
    destroy() {
        // 清理所有定时器和动画帧
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        // 清理所有回调
        this.scrollCallbacks.clear();
        
        // 移除事件监听器
        window.removeEventListener('scroll', this.handleOptimizedScroll);
        
        console.log('[ScrollOptimizer] 滚动优化器已销毁');
    }
}

// 创建全局滚动优化器实例
window.ScrollOptimizer = window.ScrollOptimizer || new ScrollOptimizer();

// 导出优化器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollOptimizer;
} 