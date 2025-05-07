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
    loading: false,
    keyword: '',
    showModal: false,
    currentProcess: null,
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
    
    // api.js 会自动添加 orgId 参数
    api.request('/processes', 'GET', { keyword })
      .then(res => {
        console.log('收到工序列表数据:', res);
        
        // 修改这里，正确处理 {success: true, data: [...]} 格式
        if (res.success && Array.isArray(res.data)) {
          // 映射字段，确保兼容
          const mappedData = res.data.map(item => ({
            ...item,
            _id: item.id,           // 兼容旧版使用_id的地方
            processName: item.name,  // 添加processName字段供前端使用
            order: item.order || 1,  // 保持order字段
            status: item.status !== false  // 保持status字段
          }));
          
          // 排序
          const sortedData = mappedData.sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 999;
            const orderB = b.order !== undefined ? b.order : 999;
            return orderA - orderB;
          });
          
          console.log('处理后的数据:', sortedData);
          this.setData({ processes: sortedData, loading: false });
        } else if (Array.isArray(res)) {
          // 兼容旧格式：直接是数组的情况
          const sortedData = res.sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 999;
            const orderB = b.order !== undefined ? b.order : 999;
            return orderA - orderB;
          });
          this.setData({ processes: sortedData, loading: false });
        } else {
          console.warn('返回数据格式不符合预期', res);
          this.setData({ processes: [], loading: false });
          toast('暂无工序数据');
        }
        wx.stopPullDownRefresh();
      })
      .catch(err => {
        console.error('获取工序数据失败:', err);
        this.setData({ processes: [], loading: false });
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
   * 保存工序
   */
  saveProcess() {
    const { formData, currentProcess } = this.data;
    
    // 验证表单
    if (!formData.processName.trim()) {
      toast('请输入工序名称');
      return;
    }
    
    if (!formData.order || isNaN(parseInt(formData.order))) {
      toast('请输入有效的显示顺序');
      return;
    }
    
    // 添加工序名唯一性验证
    if (!currentProcess) { // 新增工序时才检查
      const existingProcess = this.data.processes && this.data.processes.find(
        p => p.processName.toLowerCase() === formData.processName.trim().toLowerCase()
      );
      
      if (existingProcess) {
        toast('已存在同名工序，请更换名称');
        return;
      }
    } else if (currentProcess.processName !== formData.processName.trim()) {
      // 编辑模式且修改了名称，也需要检查
      const existingProcess = this.data.processes && this.data.processes.find(
        p => p._id !== currentProcess._id && 
             p.processName.toLowerCase() === formData.processName.trim().toLowerCase()
      );
      
      if (existingProcess) {
        toast('已存在同名工序，请更换名称');
        return;
      }
    }
    
    loading('保存中');
    
    const url = currentProcess 
      ? `/processes/${currentProcess._id}`  // 更新接口
      : '/processes';  // 创建接口
      
    const method = currentProcess ? 'PUT' : 'POST';
    
    console.log('提交保存工序:', {
      processName: formData.processName.trim(),
      order: parseInt(formData.order),
      status: formData.status === '1'
    });
    
    api.request(url, method, {
      processName: formData.processName.trim(),
      order: parseInt(formData.order),
      status: formData.status === '1'
    })
      .then(res => {
        console.log('保存工序成功:', res);
        this.setData({ showModal: false });
        
        // 延迟一小段时间再刷新，确保后端数据已更新
        setTimeout(() => {
          this.fetchProcesses();
        }, 200);
        
        toast(currentProcess ? '更新成功' : '添加成功', 'success');
      })
      .catch(err => {
        console.error('保存工序请求失败:', err);
        toast('网络错误，请稍后再试');
      })
      .finally(() => {
        hideLoad();
      });
  },

  /**
   * 切换工序状态（启用/禁用）
   */
  toggleProcessStatus(e) {
    const { process } = e.currentTarget.dataset;
    const newStatus = !process.status;
    const statusText = newStatus ? '启用' : '禁用';
    
    modal('确认操作', `确定要${statusText}此工序吗？`)
      .then(confirmed => {
        if (!confirmed) return;
        
        loading(`${statusText}中`);
        
        api.request(`/processes/${process._id}/status`, 'PUT', { status: newStatus })
          .then(res => {
            this.fetchProcesses();
            toast(`${statusText}成功`, 'success');
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
      api.request(`/processes/${process._id}/status`, 'PUT', { status: newStatus })
        .then(res => {
          this.setData({ showModal: false });
          this.fetchProcesses();
          toast(`${statusText}成功`, 'success');
        })
        .catch(err => {
          console.error('停用工序请求失败:', err);
          toast('网络错误，请稍后再试');
        })
        .finally(() => {
          hideLoad();
        });
    });
  }
})