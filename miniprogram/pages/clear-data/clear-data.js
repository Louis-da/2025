// 数据清理工具页面
const api = require('../../utils/api')

Page({
  data: {
    orgId: 'org1', // 默认组织ID
    logs: []
  },
  
  onLoad() {
    // 从本地存储加载组织ID，如果有的话
    const storedOrgId = wx.getStorageSync('orgId');
    if (storedOrgId) {
      this.setData({ orgId: storedOrgId });
    }
  },
  
  // 输入组织ID
  inputOrgId(e) {
    this.setData({ orgId: e.detail.value });
  },
  
  // 添加日志
  addLog(message) {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    const logs = [...this.data.logs];
    logs.unshift({
      time: timeStr,
      message: message
    });
    
    this.setData({ logs });
  },
  
  // 清除货品数据
  clearProducts() {
    const { orgId } = this.data;
    
    if (!orgId) {
      wx.showToast({
        title: '请输入组织ID',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认清除',
      content: `确定要清除组织 ${orgId} 的所有货品数据吗？此操作不可恢复！`,
      confirmText: '确定清除',
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在清除数据...' });
          
          this.addLog(`开始清除组织 ${orgId} 的货品数据`);
          
          api.clearProducts(orgId)
            .then(res => {
              wx.hideLoading();
              
              if (res.success) {
                const message = `成功清除 ${res.count} 条货品数据`;
                this.addLog(message);
                wx.showToast({
                  title: message,
                  icon: 'success'
                });
              } else {
                const message = `清除失败: ${res.message || '未知错误'}`;
                this.addLog(message);
                wx.showToast({
                  title: message,
                  icon: 'none'
                });
              }
            })
            .catch(err => {
              wx.hideLoading();
              const message = `清除失败: ${err.error || '网络错误'}`;
              this.addLog(message);
              wx.showToast({
                title: message,
                icon: 'none'
              });
            });
        }
      }
    });
  },
  
  // 清除工序数据
  clearProcesses() {
    const { orgId } = this.data;
    
    if (!orgId) {
      wx.showToast({
        title: '请输入组织ID',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认清除',
      content: `确定要清除组织 ${orgId} 的所有工序数据吗？此操作不可恢复！`,
      confirmText: '确定清除',
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在清除数据...' });
          
          this.addLog(`开始清除组织 ${orgId} 的工序数据`);
          
          api.clearProcesses(orgId)
            .then(res => {
              wx.hideLoading();
              
              if (res.success) {
                const message = `成功清除 ${res.count} 条工序数据`;
                this.addLog(message);
                wx.showToast({
                  title: message,
                  icon: 'success'
                });
              } else {
                const message = `清除失败: ${res.message || '未知错误'}`;
                this.addLog(message);
                wx.showToast({
                  title: message,
                  icon: 'none'
                });
              }
            })
            .catch(err => {
              wx.hideLoading();
              const message = `清除失败: ${err.error || '网络错误'}`;
              this.addLog(message);
              wx.showToast({
                title: message,
                icon: 'none'
              });
            });
        }
      }
    });
  },
  
  // 清除所有数据
  clearAll() {
    const { orgId } = this.data;
    
    if (!orgId) {
      wx.showToast({
        title: '请输入组织ID',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认清除所有数据',
      content: `确定要清除组织 ${orgId} 的所有数据（货品和工序）吗？此操作不可恢复！`,
      confirmText: '确定清除',
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在清除数据...' });
          
          this.addLog(`开始清除组织 ${orgId} 的所有数据`);
          
          // 同时清除货品和工序数据
          Promise.all([
            api.clearProducts(orgId),
            api.clearProcesses(orgId)
          ])
            .then(([productsRes, processesRes]) => {
              wx.hideLoading();
              
              let message = '';
              
              if (productsRes.success && processesRes.success) {
                message = `成功清除 ${productsRes.count} 条货品数据和 ${processesRes.count} 条工序数据`;
                this.addLog(message);
                wx.showToast({
                  title: '清除成功',
                  icon: 'success'
                });
              } else {
                if (!productsRes.success) {
                  message += `清除货品失败: ${productsRes.message || '未知错误'}; `;
                }
                if (!processesRes.success) {
                  message += `清除工序失败: ${processesRes.message || '未知错误'}`;
                }
                this.addLog(message);
                wx.showToast({
                  title: '部分清除失败',
                  icon: 'none'
                });
              }
            })
            .catch(err => {
              wx.hideLoading();
              const message = `清除失败: ${err.error || '网络错误'}`;
              this.addLog(message);
              wx.showToast({
                title: message,
                icon: 'none'
              });
            });
        }
      }
    });
  }
}); 