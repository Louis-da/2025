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
    // 调用云函数获取订单详情
    wx.cloud.callFunction({
      name: 'api',
      data: {
        action: 'getOrderDetail',
        orderId: id
      }
    }).then(result => {
      const res = result.result;
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
    const order = this.data.order;
    if (!order) {
      wx.showToast({ title: '订单数据缺失', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在准备分享...' });

    try {
      // 构建导出所需数据结构（与 /export/excel 路由匹配）
      const items = Array.isArray(order.items) ? order.items : [];
      const totalQuantity = parseInt(order.totalQuantity || 0);
      const totalWeight = parseFloat(order.totalWeight || 0);
      const totalAmount = parseFloat(order.totalAmount || 0);
      const paidAmount = parseFloat(order.paymentAmount || 0);

      const orderDetails = (items.length > 0 ? items : [null]).map((it, idx) => {
        const quantity = it ? parseInt(it.quantity || 0) : totalQuantity;
        const weight = it ? parseFloat(it.weight || 0) : totalWeight;
        const unitPrice = it ? parseFloat(it.fee || it.price || 0) : parseFloat(order.unitPrice || 0);
        const rowAmount = it ? (parseFloat(it.fee || it.price || 0) * parseFloat(it.quantity || 0)) : totalAmount;
        return {
          type: '收回',
          orderNo: order.orderNo || order.id || '',
          date: (order.createTime || '').split(' ')[0] || order.createTime || '',
          process: order.processName || '',
          quantity: isNaN(quantity) ? 0 : quantity,
          weight: isNaN(weight) ? 0 : parseFloat(weight.toFixed(2)),
          unitPrice: isNaN(unitPrice) ? 0 : parseFloat(unitPrice.toFixed(2)),
          totalAmount: isNaN(rowAmount) ? 0 : parseFloat(rowAmount.toFixed(2)),
          paymentAmount: idx === 0 ? (isNaN(paidAmount) ? 0 : parseFloat(paidAmount.toFixed(2))) : '',
          paymentMethod: order.paymentMethod || '',
          remark: order.remark || ''
        };
      });

      const excelData = {
        basicInfo: {
          companyName: wx.getStorageSync('companyName') || '公司',
          factoryName: order.factoryName || '',
          dateRange: (order.createTime || '').split(' ')[0] || order.createTime || '',
          generateTime: new Date().toLocaleString(),
          totalRecords: orderDetails.length
        },
        summary: {
          sendSummary: {
            title: '发出单摘要',
            orderCount: 0,
            quantity: 0,
            weight: '0.00'
          },
          receiveSummary: {
            title: '收回单摘要',
            orderCount: 1,
            quantity: totalQuantity,
            weight: totalWeight.toFixed(2)
          },
          lossSummary: {
            title: '损耗情况',
            productTypes: items.length || 0,
            lossWeight: '0.00',
            lossRate: '0.00%'
          },
          financialSummary: {
            title: '财务汇总',
            totalPayment: paidAmount.toFixed(2),
            finalBalance: (totalAmount - paidAmount).toFixed(2)
          }
        },
        productSummary: [], // 单据详情页可不提供
        paymentSummary: {
          totalAmount: totalAmount.toFixed(2),
          totalPayment: paidAmount.toFixed(2),
          finalBalance: (totalAmount - paidAmount).toFixed(2)
        },
        paymentRecords: [], // 无需提供记录，保留空数组
        orderDetails
      };

      const request = require('../../utils/request');
      request.post('/export/excel', excelData)
        .then((res) => {
          // 云函数代理：返回本地临时文件路径
          if (res && res.filePath) {
            wx.hideLoading();
            this.shareExcelFileDirectly(res.filePath);
            return;
          }

          // 兼容老返回：downloadUrl
          if (res && res.success && res.data && res.data.downloadUrl) {
            const downloadUrl = res.data.downloadUrl;
            wx.downloadFile({
              url: downloadUrl,
              header: { 'X-App-Authorization': `Bearer ${wx.getStorageSync('token')}` },
              success: (downloadRes) => {
                wx.hideLoading();
                if (downloadRes.statusCode === 200) {
                  this.shareExcelFileDirectly(downloadRes.tempFilePath);
                } else {
                  console.error('文件下载失败，状态码:', downloadRes.statusCode);
                  wx.showToast({ title: '文件准备失败，请重试', icon: 'none' });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('下载失败详情:', err);
                wx.showToast({ title: '网络异常，分享失败', icon: 'none' });
              }
            });
            return;
          }

          // 其他返回
          wx.hideLoading();
          if (res && res.message) {
            wx.showToast({ title: res.message, icon: 'none' });
          } else {
            wx.showToast({ title: '生成失败，请重试', icon: 'none' });
          }
        })
        .catch((error) => {
          wx.hideLoading();
          console.error('Excel导出失败:', error);
          const msg = (error && error.getUserMessage && error.getUserMessage()) || (error && error.message) || '网络异常，请检查网络连接';
          wx.showToast({ title: msg, icon: 'none' });
        });
    } catch (e) {
      wx.hideLoading();
      console.error('构建导出数据失败:', e);
      wx.showToast({ title: '数据处理失败，请重试', icon: 'none' });
    }
  },

  // 直接分享Excel文件
  shareExcelFileDirectly(filePath) {
    const fileName = this.generateExcelFileName();
    wx.shareFileMessage({
      filePath,
      fileName,
      success: () => {
        wx.showToast({ title: '表格分享成功', icon: 'success', duration: 2000 });
      },
      fail: (shareErr) => {
        console.log('微信分享失败，提供备选方案:', shareErr);
        wx.showModal({
          title: '分享方式选择',
          content: '微信分享失败，请选择其他方式：',
          cancelText: '打开表格',
          confirmText: '保存到本地',
          success: (modalRes) => {
            // 无论选择哪个，都尝试打开文档
            this.openExcelDocument(filePath);
          },
          fail: () => {
            this.openExcelDocument(filePath);
          }
        });
      }
    });
  },

  // 打开Excel文档
  openExcelDocument(filePath) {
    wx.openDocument({
      filePath,
      fileType: 'xlsx',
      success: () => {
        wx.showToast({ title: '表格已打开', icon: 'success', duration: 2000 });
      },
      fail: (openErr) => {
        console.log('打开文档失败:', openErr);
        wx.showToast({ title: '表格已生成，请在文件管理中查看', icon: 'success', duration: 3000 });
      }
    });
  },

  // 生成文件名
  generateExcelFileName() {
    const order = this.data.order || {};
    const factoryName = order.factoryName || '工厂';
    const orderNo = order.orderNo || order.id || '';
    const ts = Date.now().toString().slice(-6);
    return `${factoryName}_收回单_${orderNo}_${ts}.xlsx`;
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
    // 调用云函数删除订单
    wx.cloud.callFunction({
      name: 'api',
      data: {
        action: 'deleteOrder',
        orderId: this.data.orderId,
        orderType: 'receive'
      }
    }).then(result => {
      const res = result.result;
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
          
          // === 使用云函数 ===
          wx.cloud.callFunction({
            name: 'api',
            data: {
              action: 'cancelOrder',
              orderId: this.data.orderId,
              orderType: 'receive'
            }
          })
            .then(result => {
              const apiRes = result.result;
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