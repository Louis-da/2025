const app = getApp()
const api = require('../../utils/api');

Page({
  data: {
    orderId: '',
    order: null,
    loading: true,
    canEdit: false  // 是否可以编辑，取决于订单状态
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({
        orderId: options.id
      })
      this.fetchOrderDetail(options.id)
    } else {
      wx.showToast({
        title: '订单参数错误',
        icon: 'error'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  onShow: function () {
    // 页面显示时可能需要刷新数据（如从编辑页返回）
    if (this.data.orderId && !this.data.loading) {
      this.fetchOrderDetail(this.data.orderId)
    }
  },

  // 获取订单详情
  fetchOrderDetail: function (id) {
    this.setData({ loading: true })
    // 调用自建后端API获取订单详情
    api.getOrderDetail(id).then(res => {
      if (res && res.data) {
        const canEdit = res.data.status === 'pending';
        const orderData = {
          ...res.data,
          orderNo: res.data.orderNo || res.data.id
        };
        this.setData({
          order: orderData,
          loading: false,
          canEdit: canEdit
        });
      } else {
        this.setData({
          order: null,
          loading: false
        });
        wx.showToast({
          title: '未找到订单数据',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('获取订单详情失败', err);
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

  // 编辑整个订单
  editOrder: function() {
    wx.navigateTo({
      url: `/pages/receive-order/receive-order?id=${this.data.orderId}&mode=edit`
    })
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

  // 编辑产品
  editProduct: function (e) {
    const productId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/edit-product/edit-product?orderId=${this.data.orderId}&productId=${productId}&orderType=receive`
    })
  },

  // 取消订单
  cancelOrder: function () {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消此订单吗？',
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
              status: 'cancelled',
              orderType: 'receive'
            }
          }).then(res => {
            wx.hideLoading()
            
            if (res.result && res.result.success) {
              const order = this.data.order
              order.status = 'cancelled'
              
              this.setData({
                order: order,
                canEdit: false
              })
              
              wx.showToast({
                title: '订单已取消',
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
            console.error('取消订单失败', err)
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

  // 完成订单
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

  // 支付订单
  payOrder: function () {
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