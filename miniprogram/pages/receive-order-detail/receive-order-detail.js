const app = getApp()
const api = require('../../utils/api');
const { formatDateTimeToMinute } = require('../../utils/datetime'); // 引入日期格式化
const { getFullImageUrl } = require('../../utils/image'); // 引入图片处理

Page({
  data: {
    orderId: '',
    order: null,
    loading: true,
    canEdit: false,  // 是否可以编辑，取决于订单状态
    orderStatus: '' // <<< 添加 orderStatus
  },

  // +++ 添加 getFullImageUrl 到 Page，供 WXML 使用 +++
  getFullImageUrl: getFullImageUrl,

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: options.id });
      this.fetchOrderDetail(options.id);
    }
  },

  onShow() {
    // 刷新订单数据，确保状态最新
    if (this.data.orderId) {
      this.fetchOrderDetail(this.data.orderId);
    }
  },

  // 获取订单详情
  fetchOrderDetail: function (id) {
    this.setData({ loading: true })
    // 调用自建后端API获取订单详情
    api.getOrderDetail(id).then(res => {
      if (res && res.data) {
        // 确保证书状态可以编辑产品行项目
        const canEdit = res.data.status === 'pending' || res.data.status === 'normal'; // pending 或 normal 可编辑
        
        // 准备要设置的数据，确保基础信息字段存在
        const orderData = {
          ...res.data,
          orderNo: res.data.orderNo || res.data.id,
          factoryName: res.data.factoryName || '-', // <<< 确保证书字段
          processName: res.data.processName || '-', // <<< 确保证书字段
          // 格式化时间用于显示
          createTime: res.data.createTime ? formatDateTimeToMinute(res.data.createTime) : '-',
          // 确保 items 数组存在，并处理可能的 null 值
          items: (res.data.items || []).map(item => ({
              ...item,
              // 在这里可以预处理 item 数据，例如计算 totalPrice
              totalPrice: ((parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0)).toFixed(2),
              // 移除重量格式化，直接使用后端返回的原始值
              // weight: (parseFloat(item.weight) || 0).toFixed(1) 
          })),
          // 计算总计 - 移到这里处理更合适
          totalQuantity: (res.data.items || []).reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0),
          totalWeight: (res.data.items || []).reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0).toFixed(1),
          totalAmount: (res.data.items || []).reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0)), 0).toFixed(2)
        };
        this.setData({
          order: orderData,
          loading: false,
          canEdit: canEdit,
          orderStatus: orderData.status // <<< 设置 orderStatus
        });
      } else {
        this.setData({
          order: null,
          loading: false,
          orderStatus: '' // 清空状态
        });
        wx.showToast({
          title: '未找到订单数据',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('[fetchOrderDetail] API call failed:', err);
      this.setData({
        loading: false,
        order: null
      });
      wx.showToast({
        title: '获取订单失败',
        icon: 'none'
      });
    });
  },

  // 导航返回
  onNavBack: function () {
    wx.navigateBack()
  },

  // 显示操作菜单
  showOptions: function () {
    const itemList = ['打印订单', '导出Excel', '删除订单']
    
    // 根据订单状态可能需要增加/减少选项
    if (this.data.order && this.data.order.status === 'pending') {
      itemList.push('编辑订单')
    }
    
    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        if (res.tapIndex === 0) {
          this.printOrder()
        } else if (res.tapIndex === 1) {
          this.exportExcel()
        } else if (res.tapIndex === 2) {
          this.confirmDelete()
        } else if (res.tapIndex === 3 && this.data.order.status === 'pending') {
          this.editOrder()
        }
      }
    })
  },

  // 打印订单
  printOrder: function () {
    wx.showToast({
      title: '暂不支持打印',
      icon: 'none'
    })
  },

  // 导出Excel
  exportExcel: function () {
    wx.showToast({
      title: '正在导出...',
      icon: 'loading',
      duration: 2000
    })
    // 实际导出逻辑
    // TODO: 实现导出Excel功能
  },

  // 🔒 编辑整个订单 - 已禁用以保证数据一致性
  editOrder: function() {
    wx.showModal({
      title: '功能提示',
      content: '为保证数据一致性，收回单不允许编辑。如需修改，请先作废当前单据，然后重新创建。',
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#007aff'
    });
  },

  // 确认删除
  confirmDelete: function () {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          this.deleteOrder()
        }
      }
    })
  },

  // 删除订单
  deleteOrder: function () {
    wx.showLoading({
      title: '正在删除...',
      mask: true
    });
    // 调用自建后端API删除订单
    api.deleteOrder(this.data.orderId, 'receive').then(res => {
      wx.hideLoading();
      if (res && res.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        setTimeout(() => {
          const pages = getCurrentPages();
          const prevPage = pages[pages.length - 2];
          if (prevPage && prevPage.refreshOrderList) {
            prevPage.refreshOrderList();
          }
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: (res && res.message) || '删除失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('删除订单失败', err);
      wx.hideLoading();
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    });
  },

  // 预览备注照片
  previewRemarkImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const imageUrls = this.data.order.remarkImages || [];
    if (imageUrls.length > 0) {
      wx.previewImage({
        current: imageUrls[index],
        urls: imageUrls
      });
    }
  },

  // 编辑产品
  editProduct: function (e) {
    const productId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/edit-product/edit-product?orderId=${this.data.orderId}&productId=${productId}&orderType=receive`
    })
  },

  // 取消订单 (作废逻辑)
  cancelOrder: function () {
    // 增加状态检查，理论上按钮的wx:if会阻止，但多一层保险
    if (this.data.orderStatus === 'cancelled') {
        wx.showToast({title: '订单已作废', icon: 'none'});
        return;
    }
    wx.showModal({
      title: '确认作废', // 改为作废
      content: '确定要作废此订单吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          
          // === 使用 HTTP API 而不是云函数 ===
          api.request(`/orders/${this.data.orderId}/cancel`, 'POST', { type: 'receive' }) // 添加type参数指定为收回单
            .then(apiRes => {
              wx.hideLoading();
              if (apiRes && apiRes.success) {
                // 更新本地状态
                const updatedOrder = { ...this.data.order, status: 'cancelled' };
                this.setData({
                  order: updatedOrder,
                  orderStatus: 'cancelled', 
                  canEdit: false
                });
                wx.showToast({ title: '订单已作废', icon: 'success' });
                this.notifyPrevPageRefresh();
              } else {
                wx.showToast({ title: (apiRes && apiRes.message) || '操作失败', icon: 'none' });
              }
            })
            .catch(apiErr => {
              console.error('作废订单 API 调用失败', apiErr);
              wx.hideLoading();
              wx.showToast({ title: '操作失败', icon: 'none' });
            });
        }
      }
    });
  },

  // 完成订单 (这里可能不需要了，因为没有完成按钮了？如果需要，逻辑保留)
  completeOrder: function () {
    wx.showModal({
      title: '确认完成',
      content: '确认此订单已完成？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '处理中...',
            mask: true
          })
          
          wx.cloud.callFunction({
            name: 'updateOrderStatus',
            data: {
              orderId: this.data.orderId,
              status: 'completed',
              orderType: 'receive'
            }
          }).then(res => {
            wx.hideLoading()
            
            if (res.result && res.result.success) {
              const order = this.data.order
              order.status = 'completed'
              
              this.setData({
                order: order,
                canEdit: false
              })
              
              wx.showToast({
                title: '订单已完成',
                icon: 'success'
              })
              
              // 通知上一页刷新
              this.notifyPrevPageRefresh()
            } else {
              wx.showToast({
                title: res.result.message || '操作失败',
                icon: 'none'
              })
            }
          }).catch(err => {
            console.error('完成订单失败', err)
            wx.hideLoading()
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  // 支付订单 (保留，因为 normal 状态也要支付)
  payOrder: function () {
     // 增加状态检查
    if (this.data.orderStatus !== 'completed' && this.data.orderStatus !== 'normal') {
        wx.showToast({title: '当前状态无法支付', icon: 'none'});
        return;
    }
    wx.navigateTo({
      url: `/pages/payment/payment?orderId=${this.data.orderId}&amount=${this.data.order.totalAmount}&orderType=receive`
    })
  },

  // 通知上一页刷新
  notifyPrevPageRefresh: function() {
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    if (prevPage && prevPage.refreshOrderList) {
      prevPage.refreshOrderList()
    }
  },

  // 转发分享
  onShareAppMessage: function () {
    return {
      title: `收回单详情 - ${this.data.order ? this.data.order.factoryName : ''}`,
      path: `/pages/receive-order-detail/receive-order-detail?id=${this.data.orderId}`
    }
  }
}) 