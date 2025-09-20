// pages/process-manage/process-manage.js
const app = getApp();
const api = require('../../utils/api')

// 定义一些工具函数 - 防止报错
const toast = (title, icon = 'none') => {
  wx.showToast({
    title: title,
    icon: icon
  });
};

const loading = (title = '加载中') => {
  wx.showLoading({
    title: title,
    mask: true
  });
};

const hideLoad = () => {
  wx.hideLoading();
};

const modal = (title, content, showCancel = true) => {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: title,
      content: content,
      showCancel: showCancel,
      success(res) {
        if (res.confirm) {
          resolve(true);
        } else if (res.cancel) {
          resolve(false);
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
};

Page({

  /**
   * 页面的初始数据
   */
  data: {
    processes: null,
    filteredProcesses: [],
    loading: false,
    keyword: '',
    showModal: false,
    currentProcess: null,
    enabledCount: 0,
    disabledCount: 0,
    formData: {
      processName: '',
      order: '',
      status: '1' // 默认为启用状态
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.fetchProcesses();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 防止滑动穿透
   */
  preventTouchMove: function() {
    return false;
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation: function() {
    return false;
  },

  /**
   * 更新统计数据
   */
  updateStatistics(processes) {
    const enabledCount = processes.filter(item => item.status === 1).length;
    const disabledCount = processes.filter(item => item.status === 0).length;
    
    this.setData({
      filteredProcesses: processes,
      enabledCount: enabledCount,
      disabledCount: disabledCount
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.fetchProcesses();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 获取工序列表
   */
  fetchProcesses() {
    const { keyword } = this.data;
    this.setData({ loading: true });
    
    // api.js 会自动添加 orgId 参数，但为了确保数据隔离，显式添加
    const orgId = wx.getStorageSync('orgId');
    api.cloudFunctionRequest('/processes', 'GET', { keyword, orgId })
      .then(res => {
        console.log('收到工序列表数据:', res);
        
        // 修改这里，正确处理 {success: true, data: [...]} 格式
        if (res.success && Array.isArray(res.data)) {
          // 映射字段，确保兼容
          const mappedData = res.data.map(item => ({
            ...item,
            _id: item._id || item.id,  // 保持原有的_id字段，兼容可能的id字段
            processName: item.name,    // 添加processName字段供前端使用
            order: item.order || 1,    // 保持order字段
            status: typeof item.status === 'number' ? item.status : (item.status ? 1 : 0)  // 确保status是数字类型
          }));
          
          // 排序
          const sortedData = mappedData.sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 999;
            const orderB = b.order !== undefined ? b.order : 999;
            return orderA - orderB;
          });
          
          console.log('处理后的数据:', sortedData);
          this.setData({ processes: sortedData, loading: false });
          this.updateStatistics(sortedData);
        } else if (Array.isArray(res)) {
          // 兼容旧格式：直接是数组的情况
          const sortedData = res.sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 999;
            const orderB = b.order !== undefined ? b.order : 999;
            return orderA - orderB;
          });
          this.setData({ processes: sortedData, loading: false });
          this.updateStatistics(sortedData);
        } else {
          console.warn('返回数据格式不符合预期', res);
          this.setData({ processes: [], loading: false });
          this.updateStatistics([]);
          toast('暂无工序数据');
        }
        wx.stopPullDownRefresh();
      })
      .catch(err => {
        console.error('获取工序数据失败:', err);
        this.setData({ processes: [], loading: false });
        this.updateStatistics([]);
        toast('获取工序数据失败，请稍后再试');
        wx.stopPullDownRefresh();
      });
  },

  /**
   * 关键词搜索
   */
  onKeywordInput(e) {
    this.setData({
      keyword: e.detail.value
    });
  },

  /**
   * 搜索工序
   */
  searchProcesses() {
    this.fetchProcesses();
  },

  /**
   * 添加工序
   */
  showAddModal() {
    // 设置初始顺序为最大序号+1
    const newOrder = this.data.processes && this.data.processes.length > 0 
      ? Math.max(...this.data.processes.map(p => p.order || 0)) + 1 
      : 1;
    
    this.setData({
      showModal: true,
      currentProcess: null,
      formData: {
        processName: '',
        order: newOrder,
        status: '1'
      }
    });
  },

  /**
   * 显示编辑工序弹窗
   */
  showEditModal(e) {
    const { process } = e.currentTarget.dataset;
    this.setData({
      showModal: true,
      currentProcess: process,
      formData: {
        processName: process.processName,
        order: process.order || 1, // 如果没有order，默认为1
        status: process.status ? '1' : '0'
      }
    });
  },

  /**
   * 关闭弹窗
   */
  closeModal() {
    this.setData({
      showModal: false
    });
  },

  /**
   * 输入工序名称
   */
  onProcessNameInput(e) {
    this.setData({
      'formData.processName': e.detail.value
    });
  },

  /**
   * 输入显示顺序
   */
  onOrderInput(e) {
    this.setData({
      'formData.order': e.detail.value
    });
  },

  /**
   * 切换状态
   */
  onStatusChange(e) {
    this.setData({
      'formData.status': e.detail.value
    });
  },

  /**
   * 保存工序（新增或编辑）
   */
  saveProcess() {
    const { formData, currentProcess } = this.data;
    
    // 验证工序名称
    if (!formData.processName || !formData.processName.trim()) {
      toast('请输入工序名称');
      return;
    }
    
    // 排序值处理：如果为空或无效，使用默认值
    let finalOrder = formData.order;
    if (!formData.order || isNaN(Number(formData.order)) || Number(formData.order) < 0) {
      if (!currentProcess) {
        // 新增时，如果没有填写排序，自动计算
        finalOrder = this.data.processes && this.data.processes.length > 0 
          ? Math.max(...this.data.processes.map(p => p.order || 0)) + 1 
          : 1;
        toast('显示顺序已自动设置为 ' + finalOrder);
      } else {
        // 编辑时，如果没有填写排序，保持原有排序
        finalOrder = currentProcess.order || 1;
      }
    }
    
    // 更新表单数据中的排序值
    this.setData({
      'formData.order': finalOrder
    });
    
    loading('保存中');
    
    // 1. 编辑工序
    if (currentProcess) {
      // 构建API请求参数
      const params = {
        processName: formData.processName.trim(),
        order: Number(finalOrder),
        status: formData.status === '1' ? 1 : 0,
        orgId: wx.getStorageSync('orgId')
      };
      
      // 使用云函数更新工序
      wx.cloud.callFunction({
        name: 'updateProcess',
        data: {
          processId: currentProcess._id,
          ...params
        }
      })
        .then(res => {
          hideLoad();
          
          if (res.result && res.result.success) {
            toast('更新成功', 'success');
            this.closeModal();
            this.fetchProcesses(); // 刷新列表
          } else {
            toast(res.result?.message || '更新失败');
          }
        })
        .catch(err => {
          hideLoad();
          console.error('更新工序失败:', err);
          toast('保存失败');
        });
    } 
    // 2. 新增工序
    else {
      // 构建API请求参数
      const params = {
        processName: formData.processName.trim(),
        order: Number(finalOrder),
        status: formData.status === '1' ? 1 : 0,
        orgId: wx.getStorageSync('orgId')
      };
      
      // 调用工序新增API
      api.cloudFunctionRequest('/processes', 'POST', params)
      .then(res => {
          hideLoad();
          
          if (res.success) {
            // 处理返回的工序编码
            if (res.code) {
              console.log('新增工序成功，工序编码:', res.code);
              wx.setStorageSync('lastProcessCode', res.code); // 可选：保存最后创建的工序编码
            }
            
            toast('添加成功', 'success');
            this.closeModal();
            this.fetchProcesses(); // 刷新列表
          } else {
            toast(res.message || '添加失败');
          }
      })
      .catch(err => {
        hideLoad();
          console.error('新增工序失败:', err);
          toast(err.error || '保存失败');
      });
    }
  },

  /**
   * 切换工序状态（启用/禁用）
   */
  toggleProcessStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    const newStatus = status == 1 ? 0 : 1;  // 切换状态：1变0（停用），0变1（启用）
    const statusText = newStatus ? '启用' : '停用';
    
    modal('确认操作', `确定要${statusText}此工序吗？`)
      .then(confirmed => {
        if (!confirmed) return;
        
        loading(`${statusText}中`);
        
        wx.cloud.callFunction({
          name: 'updateProcessStatus',
          data: {
            processId: id,
            status: newStatus,
            orgId: wx.getStorageSync('orgId')
          }
        })
          .then(res => {
            if (res.result && res.result.success) {
              this.fetchProcesses();
              toast(`${statusText}成功`, 'success');
            } else {
              throw new Error(res.result?.message || '操作失败');
            }
          })
          .catch(err => {
            console.error('更新工序状态请求失败:', err);
            toast('网络错误，请稍后再试');
          })
          .finally(() => {
            hideLoad();
          });
      });
  },

  /**
   * 弹窗内停用工序
   */
  disableProcessFromEdit: function() {
    const { currentProcess } = this.data;
    if (!currentProcess) return;
    const process = currentProcess;
    const newStatus = false;
    const statusText = '停用';
    modal('确认操作', `确定要${statusText}此工序吗？`).then(confirmed => {
      if (!confirmed) return;
      loading(`${statusText}中`);
      wx.cloud.callFunction({
        name: 'updateProcessStatus',
        data: {
          processId: process._id,
          status: newStatus ? 1 : 0,
          orgId: wx.getStorageSync('orgId')
        }
      })
        .then(res => {
          if (res.result && res.result.success) {
            this.setData({ showModal: false });
            this.fetchProcesses();
            toast(`${statusText}成功`, 'success');
          } else {
            throw new Error(res.result?.message || '操作失败');
          }
        })
        .catch(err => {
          console.error('停用工序请求失败:', err);
          toast('网络错误，请稍后再试');
        })
        .finally(() => {
          hideLoad();
        });
    });
  },

  /**
   * 启用工序
   */
  enableProcess(e) {
    const { id } = e.currentTarget.dataset;
    const statusText = '启用';
    
    modal('确认操作', `确定要${statusText}此工序吗？`)
      .then(confirmed => {
        if (!confirmed) return;
        
        loading(`${statusText}中`);
        
        wx.cloud.callFunction({
          name: 'updateProcessStatus',
          data: {
            processId: id,
            status: 1,
            orgId: wx.getStorageSync('orgId')
          }
        })
          .then(res => {
            if (res.result && res.result.success) {
              this.fetchProcesses();
              toast(`${statusText}成功`, 'success');
            } else {
              throw new Error(res.result?.message || '操作失败');
            }
          })
          .catch(err => {
            console.error('启用工序请求失败:', err);
            toast('网络错误，请稍后再试');
          })
          .finally(() => {
            hideLoad();
          });
      });
  }
})