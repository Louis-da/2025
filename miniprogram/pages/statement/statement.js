const api = require('../../utils/api')

Page({
  data: {
    factories: [],
    selectedFactory: null,
    products: [], // 添加货品数组
    selectedProduct: null, // 添加选中的货品
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    statement: null,
    isLoading: false,
    canvasWidth: 750,  // 设置画布宽度，单位px
    canvasHeight: 1200, // 设置画布高度，会根据内容动态调整
    showExportSuccess: false,
    exportPath: '',
    openStyleDetail: null, // 当前展开的货号详情
    selectedProcess: null // 当前选中的工序
  },
  onLoad() {
    this.fetchFactories();
    this.fetchProducts(); // 添加获取货品列表
    
    // 设置导航栏标题为空，避免显示"工厂对账单"
    wx.setNavigationBarTitle({
      title: ''
    });
  },
  fetchFactories() {
    this.setData({ isLoading: true });
    const orgId = wx.getStorageSync('orgId') || 'org1';
    api.request('/factories', 'GET', { orgId })
      .then(res => {
        this.setData({ factories: res, isLoading: false });
      })
      .catch(() => {
        this.setData({ isLoading: false });
        wx.showToast({
          title: '获取工厂列表失败',
          icon: 'none'
        });
      });
  },
  selectFactory(e) {
    const index = e.detail.value;
    this.setData({ selectedFactory: this.data.factories[index] });
  },
  changeStartDate(e) {
    this.setData({ startDate: e.detail.value });
  },
  changeEndDate(e) {
    this.setData({ endDate: e.detail.value });
  },
  fetchProducts() {
    const orgId = wx.getStorageSync('orgId') || 'org1';
    api.request('/products', 'GET', { orgId })
      .then(res => {
        this.setData({ products: [{ id: '', styleNo: '全部货品', name: '全部货品' }, ...res] });
      })
      .catch(() => {
        wx.showToast({
          title: '获取货品列表失败',
          icon: 'none'
        });
      });
  },
  selectProduct(e) {
    const index = e.detail.value;
    if (index === '0') { // 如果选择了"全部货品"
      this.setData({ selectedProduct: null });
    } else {
      this.setData({ selectedProduct: this.data.products[index] });
    }
  },
  fetchStatement() {
    const { selectedFactory, selectedProduct, startDate, endDate } = this.data;
    const orgId = wx.getStorageSync('orgId') || 'org1';
    if (!selectedFactory) {
      wx.showToast({ title: '请选择工厂', icon: 'none' });
      return;
    }
    this.setData({ isLoading: true });
    api.request('/statement', 'GET', {
      orgId,
      factoryName: selectedFactory.name,
      startDate,
      endDate,
      productId: selectedProduct ? selectedProduct.id : null
    })
      .then(res => {
        this.setData({ statement: res, isLoading: false });
      })
      .catch(() => {
        this.setData({ isLoading: false });
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
      });
  },
  
  // 导出为图片
  exportAsImage() {
    wx.showLoading({
      title: '正在生成图片...',
      mask: true
    });
    
    this.renderToCanvas().then(canvas => {
      wx.canvasToTempFilePath({
        canvas: canvas,
        success: (res) => {
          wx.hideLoading();
          const tempFilePath = res.tempFilePath;
          
          // 保存到相册
          wx.saveImageToPhotosAlbum({
            filePath: tempFilePath,
            success: () => {
              this.setData({
                showExportSuccess: true,
                exportPath: '图片已保存到相册'
              });
              
              // 分享图片
              wx.showShareImageMenu({
                path: tempFilePath
              });
            },
            fail: (err) => {
              // 如果用户拒绝授权，则引导用户开启授权
              if (err.errMsg.indexOf('auth deny') >= 0) {
                wx.showModal({
                  title: '提示',
                  content: '请允许保存图片到相册',
                  success: (res) => {
                    if (res.confirm) {
                      wx.openSetting();
                    }
                  }
                });
              } else {
                wx.showToast({
                  title: '保存失败',
                  icon: 'none'
                });
              }
            }
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({
            title: '导出图片失败',
            icon: 'none'
          });
        }
      });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({
        title: '生成图片失败',
        icon: 'none'
      });
    });
  },
  
  // 隐藏导出成功提示
  hideExportSuccess() {
    this.setData({
      showExportSuccess: false
    });
  },
  
  // 渲染对账单到Canvas
  renderToCanvas() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery();
      query.select('#statementCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            reject(new Error('获取Canvas节点失败'));
            return;
          }
          
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 设置Canvas尺寸
          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = this.data.canvasWidth * dpr;
          canvas.height = this.data.canvasHeight * dpr;
          ctx.scale(dpr, dpr);
          
          // 清空画布
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // 设置背景色
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // 绘制对账单
          this.drawStatement(ctx).then(() => {
            resolve(canvas);
          }).catch(reject);
        });
    });
  },
  
  // 绘制对账单到Canvas
  drawStatement(ctx) {
    return new Promise((resolve) => {
      const { statement } = this.data;
      const margin = 20;
      const cellPadding = 10;
      let y = margin;
      
      // 设置字体
      ctx.font = 'normal 14px sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'middle';
      
      // 绘制标题
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${statement.factoryName}工厂对账单`, this.data.canvasWidth / 2, y + 15);
      y += 40;
      
      // 绘制分享/导出标签
      ctx.font = 'normal 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ff6600';
      ctx.fillText('分享/导出', this.data.canvasWidth - margin, y - 20);
      
      // 恢复默认颜色
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      
      // 绘制工厂信息
      this.drawHeaderInfo(ctx, y, margin);
      y += 80;
      
      // 绘制发出/收回汇总表格
      this.drawSummaryTable(ctx, y, margin);
      y += 80;
      
      // 绘制工序对比表格
      if (statement.processComparison && statement.processComparison.length > 0) {
        y = this.drawProcessComparisonTable(ctx, y + 20, margin);
        y += 20;
      }
      
      // 绘制按货号汇总表格
      if (statement.styleSummary && statement.styleSummary.length > 0) {
        y = this.drawStyleSummaryTable(ctx, y + 20, margin);
        y += 20;
      }
      
      // 绘制发出明细表格
      const sendOrders = statement.orders.filter(item => item.type === '发出单');
      if (sendOrders.length > 0) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('发出', margin + (this.data.canvasWidth - 2 * margin) / 2, y, this.data.canvasWidth);
        y += 30;
        y = this.drawDetailTable(ctx, 'send', sendOrders, y, margin);
        y += 20;
      }
      
      // 绘制收回明细表格
      const receiveOrders = statement.orders.filter(item => item.type === '收回单');
      if (receiveOrders.length > 0) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('收回', margin + (this.data.canvasWidth - 2 * margin) / 2, y, this.data.canvasWidth);
        y += 30;
        y = this.drawDetailTable(ctx, 'receive', receiveOrders, y, margin);
        y += 20;
      }
      
      // 绘制本期合计
      this.drawTotalSummary(ctx, y, margin);
      y += 60;
      
      // 绘制备注
      this.drawRemarks(ctx, y, margin);
      
      // 动态调整Canvas高度
      this.setData({
        canvasHeight: y + 50 // 加上一些底部margin
      });
      
      // 0.5秒后解决Promise，确保Canvas有足够时间渲染
      setTimeout(() => {
        resolve();
      }, 500);
    });
  },
  
  // 绘制工序对比表格
  drawProcessComparisonTable(ctx, y, margin) {
    const { statement } = this.data;
    const width = this.data.canvasWidth - 2 * margin;
    const headerHeight = 30;
    const rowHeight = 30;
    
    // 绘制标题
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('工序对比分析', margin + width / 2, y);
    y += 30;
    
    // 还原字体
    ctx.font = 'normal 14px sans-serif';
    ctx.textAlign = 'left';
    
    // 绘制表格边框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, y, width, headerHeight);
    
    // 绘制表头背景
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(margin, y, width, headerHeight);
    
    // 绘制表头文字
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    
    // 计算列宽
    const columnWidth = width / 4;
    
    // 绘制表头
    ctx.fillText('工序', margin + columnWidth * 0.5, y + headerHeight / 2);
    ctx.fillText('发出重量(kg)', margin + columnWidth * 1.5, y + headerHeight / 2);
    ctx.fillText('收回重量(kg)', margin + columnWidth * 2.5, y + headerHeight / 2);
    ctx.fillText('损耗率(%)', margin + columnWidth * 3.5, y + headerHeight / 2);
    
    y += headerHeight;
    
    // 绘制数据行
    statement.processComparison.forEach((item, index) => {
      ctx.strokeRect(margin, y, width, rowHeight);
      
      // 偶数行添加背景色
      if (index % 2 === 1) {
        ctx.fillStyle = '#f9f9f9';
        ctx.fillRect(margin, y, width, rowHeight);
      }
      
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      
      // 绘制数据
      ctx.fillText(item.process, margin + columnWidth * 0.5, y + rowHeight / 2);
      ctx.fillText(item.sendWeight, margin + columnWidth * 1.5, y + rowHeight / 2);
      ctx.fillText(item.receiveWeight, margin + columnWidth * 2.5, y + rowHeight / 2);
      
      // 损耗率超过5%标红显示
      if (parseFloat(item.lossRate) > 5) {
        ctx.fillStyle = '#ff3b30';
      }
      ctx.fillText(item.lossRate + '%', margin + columnWidth * 3.5, y + rowHeight / 2);
      
      // 恢复默认颜色
      ctx.fillStyle = '#000000';
      
      y += rowHeight;
    });
    
    // 绘制总计行
    ctx.strokeRect(margin, y, width, rowHeight);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(margin, y, width, rowHeight);
    ctx.fillStyle = '#000000';
    
    // 计算总计数据
    const totalSendWeight = statement.processComparison.reduce((sum, item) => sum + parseFloat(item.sendWeight), 0).toFixed(1);
    const totalReceiveWeight = statement.processComparison.reduce((sum, item) => sum + parseFloat(item.receiveWeight), 0).toFixed(1);
    const totalLossRate = statement.lossRate;
    
    // 绘制总计行数据
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('总计', margin + columnWidth * 0.5, y + rowHeight / 2);
    ctx.fillText(totalSendWeight, margin + columnWidth * 1.5, y + rowHeight / 2);
    ctx.fillText(totalReceiveWeight, margin + columnWidth * 2.5, y + rowHeight / 2);
    ctx.fillText(totalLossRate + '%', margin + columnWidth * 3.5, y + rowHeight / 2);
    
    // 恢复默认字体
    ctx.font = 'normal 14px sans-serif';
    ctx.textAlign = 'left';
    
    return y + rowHeight + 10; // 返回新的Y坐标，加上一些间距
  },
  
  // 绘制按货号汇总表格
  drawStyleSummaryTable(ctx, y, margin) {
    const { statement } = this.data;
    const width = this.data.canvasWidth - 2 * margin;
    const headerHeight = 30;
    const rowHeight = 30;
    
    // 绘制标题
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('按货号汇总', margin + width / 2, y);
    y += 30;
    
    // 还原字体
    ctx.font = 'normal 14px sans-serif';
    ctx.textAlign = 'left';
    
    // 绘制表格边框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, y, width, headerHeight);
    
    // 绘制表头背景
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(margin, y, width, headerHeight);
    
    // 绘制表头文字
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    
    // 计算列宽 - 现在有9列
    const columnWidth = width / 9;
    
    // 绘制表头
    ctx.fillText('货号', margin + columnWidth * 0.5, y + headerHeight / 2);
    ctx.fillText('工序', margin + columnWidth * 1.5, y + headerHeight / 2);
    ctx.fillText('发出数量', margin + columnWidth * 2.5, y + headerHeight / 2);
    ctx.fillText('发出重量(kg)', margin + columnWidth * 3.5, y + headerHeight / 2);
    ctx.fillText('收回重量(kg)', margin + columnWidth * 4.5, y + headerHeight / 2);
    ctx.fillText('收回数量', margin + columnWidth * 5.5, y + headerHeight / 2);
    ctx.fillText('工费', margin + columnWidth * 6.5, y + headerHeight / 2);
    ctx.fillText('支付方式', margin + columnWidth * 7.5, y + headerHeight / 2);
    ctx.fillText('支付金额', margin + columnWidth * 8.5, y + headerHeight / 2);
    
    y += headerHeight;
    
    // 绘制数据行
    statement.styleSummary.forEach((item, index) => {
      ctx.strokeRect(margin, y, width, rowHeight);
      
      // 偶数行添加背景色
      if (index % 2 === 1) {
        ctx.fillStyle = '#f9f9f9';
        ctx.fillRect(margin, y, width, rowHeight);
      }
      
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      
      // 绘制数据
      ctx.fillText(item.styleNo, margin + columnWidth * 0.5, y + rowHeight / 2);
      ctx.fillText(item.process || '-', margin + columnWidth * 1.5, y + rowHeight / 2);
      ctx.fillText(item.sendQuantity || '0', margin + columnWidth * 2.5, y + rowHeight / 2);
      ctx.fillText(item.sendWeight, margin + columnWidth * 3.5, y + rowHeight / 2);
      ctx.fillText(item.receiveWeight, margin + columnWidth * 4.5, y + rowHeight / 2);
      ctx.fillText(item.receiveQuantity || '0', margin + columnWidth * 5.5, y + rowHeight / 2);
      ctx.fillText('¥' + item.fee, margin + columnWidth * 6.5, y + rowHeight / 2);
      ctx.fillText(item.paymentMethod || '未付', margin + columnWidth * 7.5, y + rowHeight / 2);
      ctx.fillText('¥' + (item.paymentAmount || '0'), margin + columnWidth * 8.5, y + rowHeight / 2);
      
      y += rowHeight;
    });
    
    // 绘制总计行
    ctx.strokeRect(margin, y, width, rowHeight);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(margin, y, width, rowHeight);
    ctx.fillStyle = '#000000';
    
    // 计算总计数据
    const totalSendWeight = statement.styleSummary.reduce((sum, item) => sum + parseFloat(item.sendWeight), 0).toFixed(1);
    const totalReceiveWeight = statement.styleSummary.reduce((sum, item) => sum + parseFloat(item.receiveWeight), 0).toFixed(1);
    const totalFee = statement.styleSummary.reduce((sum, item) => sum + parseFloat(item.fee), 0).toFixed(2);
    const totalSendQuantity = statement.styleSummary.reduce((sum, item) => sum + parseInt(item.sendQuantity || 0), 0);
    const totalReceiveQuantity = statement.styleSummary.reduce((sum, item) => sum + parseInt(item.receiveQuantity || 0), 0);
    const totalPaymentAmount = statement.styleSummary.reduce((sum, item) => sum + parseFloat(item.paymentAmount || 0), 0).toFixed(2);
    
    // 计算总损耗率
    let totalLossRate = 0;
    if (parseFloat(totalSendWeight) > 0) {
      totalLossRate = ((parseFloat(totalSendWeight) - parseFloat(totalReceiveWeight)) / parseFloat(totalSendWeight) * 100).toFixed(2);
    }
    
    // 绘制总计行数据
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('总计', margin + columnWidth * 0.5, y + rowHeight / 2);
    ctx.fillText('', margin + columnWidth * 1.5, y + rowHeight / 2);
    ctx.fillText(totalSendQuantity.toString(), margin + columnWidth * 2.5, y + rowHeight / 2);
    ctx.fillText(totalSendWeight, margin + columnWidth * 3.5, y + rowHeight / 2);
    ctx.fillText(totalReceiveWeight, margin + columnWidth * 4.5, y + rowHeight / 2);
    ctx.fillText(totalReceiveQuantity.toString(), margin + columnWidth * 5.5, y + rowHeight / 2);
    ctx.fillText('¥' + totalFee, margin + columnWidth * 6.5, y + rowHeight / 2);
    ctx.fillText('', margin + columnWidth * 7.5, y + rowHeight / 2);
    ctx.fillText('¥' + totalPaymentAmount, margin + columnWidth * 8.5, y + rowHeight / 2);
    
    // 恢复默认字体
    ctx.font = 'normal 14px sans-serif';
    ctx.textAlign = 'left';
    
    return y + rowHeight + 10; // 返回新的Y坐标，加上一些间距
  },
  
  // 绘制头部信息
  drawHeaderInfo(ctx, y, margin) {
    const { statement } = this.data;
    
    // 工厂名称
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('张三', margin, y + 15);
    
    // 织机/缝盘等信息
    ctx.font = 'normal 14px sans-serif';
    ctx.fillText('织机     缝盘', margin + 100, y + 15);
    
    // 第二行 期初欠款
    y += 30;
    ctx.fillText('期初欠款', margin, y + 15);
    ctx.textAlign = 'right';
    ctx.fillText('500', margin + 120, y + 15);
    
    // 织机发出/收回等数据
    ctx.textAlign = 'center';
    ctx.fillText('织机发出', margin + 180, y + 15);
    ctx.fillText('织机收回', margin + 260, y + 15);
    ctx.fillText('缝盘发出', margin + 340, y + 15);
    ctx.fillText('缝盘收回', margin + 420, y + 15);
    ctx.fillText('本期工费', margin + 500, y + 15);
    ctx.fillText('付款金额', margin + 580, y + 15);
    ctx.fillText('期末欠款', margin + 660, y + 15);
    
    // 第三行 数据
    y += 30;
    const totalSendWeight = statement.orders
      .filter(order => order.type === '发出单')
      .reduce((sum, order) => sum + parseFloat(order.weight || 0), 0);
    
    const totalReceiveWeight = statement.orders
      .filter(order => order.type === '收回单')
      .reduce((sum, order) => sum + parseFloat(order.weight || 0), 0);
    
    // 假设织机和缝盘的分配
    ctx.textAlign = 'right';
    ctx.fillText('145', margin + 180, y + 15);
    ctx.fillText('1000', margin + 260, y + 15);
    ctx.fillText('145', margin + 340, y + 15);
    ctx.fillText('90', margin + 420, y + 15);
    ctx.fillText(statement.totalFee || '855', margin + 500, y + 15);
    ctx.fillText(statement.paidAmount || '0', margin + 580, y + 15);
    ctx.fillText('1355', margin + 660, y + 15);
    
    // 重置文本对齐
    ctx.textAlign = 'left';
    
    return y;
  },
  
  // 绘制汇总表格
  drawSummaryTable(ctx, y, margin) {
    const width = this.data.canvasWidth - 2 * margin;
    const headerHeight = 30;
    
    // 绘制表格边框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, y, width, headerHeight);
    
    // 绘制表头
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(margin, y, width, headerHeight);
    
    // 绘制表头文字
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px sans-serif';
    
    ctx.fillText('单号', margin + 40, y + headerHeight / 2);
    ctx.fillText('日期', margin + 120, y + headerHeight / 2);
    ctx.fillText('重量(kg)', margin + 200, y + headerHeight / 2);
    ctx.fillText('颜色', margin + 260, y + headerHeight / 2);
    ctx.fillText('尺码', margin + 320, y + headerHeight / 2);
    ctx.fillText('数量', margin + 380, y + headerHeight / 2);
    ctx.fillText('工序', margin + 440, y + headerHeight / 2);
    ctx.fillText('备注', margin + 500, y + headerHeight / 2);
    ctx.fillText('支付', margin + 560, y + headerHeight / 2);
    
    ctx.textAlign = 'left';
    return y + headerHeight;
  },
  
  // 绘制明细表格
  drawDetailTable(ctx, type, orders, y, margin) {
    const { statement } = this.data;
    const width = this.data.canvasWidth - 2 * margin;
    const rowHeight = 30;
    
    // 表头
    const headerHeight = 30;
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, y, width, headerHeight);
    
    // 表头背景
    if (type === 'send') {
      ctx.fillStyle = '#dae3f3'; // 发出单背景色
    } else {
      ctx.fillStyle = '#f8cbad'; // 收回单背景色
    }
    ctx.fillRect(margin, y, width, headerHeight);
    
    // 表头文字
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px sans-serif';
    
    const headers = type === 'send' ? 
      ['单号', '日期', '重量(kg)', '颜色', '尺码', '数量', '工序', '备注'] :
      ['日期', '重量', '颜色', '尺码', '数量', '工价', '工费', '支付', '工序', '备注'];
    
    const columnWidths = type === 'send' ?
      [80, 100, 80, 60, 60, 60, 60, 250] :
      [80, 60, 60, 60, 60, 60, 60, 60, 60, 170];
    
    let xPos = margin + 40;
    headers.forEach((header, i) => {
      ctx.fillText(header, xPos, y + headerHeight / 2);
      xPos += columnWidths[i];
    });
    
    // 恢复默认
    ctx.textAlign = 'left';
    ctx.font = 'normal 14px sans-serif';
    
    // 明细行
    let totalY = y + headerHeight;
    let groupTotalWeight = 0;
    let groupTotalQty = 0;
    let groupTotalFee = 0;
    let currentGroupId = null;
    
    orders.forEach((order, orderIndex) => {
      // 假设每个订单有多行数据
      const rows = type === 'send' ? 
        [{ 
          date: order.date, 
          weight: order.weight, 
          color: order.process || '黑色', 
          size: 'S',
          quantity: order.quantity,
          process: order.process || '织机',
          remark: ''
        }] :
        [{ 
          date: order.date, 
          weight: order.weight, 
          color: order.process || '黑色', 
          size: 'S',
          quantity: order.quantity,
          price: '3',
          fee: order.fee,
          payment: '未付',
          process: order.process || '织机',
          remark: ''
        }];
        
      // 如果是新组，则添加单号和组标题
      if (currentGroupId !== order._id) {
        currentGroupId = order._id;
        
        // 如果不是第一组，绘制上一组小计
        if (orderIndex > 0) {
          this.drawGroupTotal(ctx, totalY, margin, width, type, groupTotalWeight, groupTotalQty, groupTotalFee);
          totalY += rowHeight;
          
          // 重置组合计
          groupTotalWeight = 0;
          groupTotalQty = 0;
          groupTotalFee = 0;
        }
        
        // 绘制单号
        ctx.strokeRect(margin, totalY, width, rowHeight);
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(margin, totalY, 80, rowHeight);
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(order.orderNo || '25003', margin + 40, totalY + rowHeight / 2);
        ctx.textAlign = 'left';
        
        totalY += rowHeight;
      }
      
      // 绘制数据行
      rows.forEach(row => {
        ctx.strokeRect(margin, totalY, width, rowHeight);
        
        let x = margin + 40;
        
        if (type === 'send') {
          // 发出单行
          ctx.textAlign = 'center';
          ctx.fillText(row.date, x, totalY + rowHeight / 2); x += 100;
          ctx.fillText(row.weight, x, totalY + rowHeight / 2); x += 80;
          ctx.fillText(row.color, x, totalY + rowHeight / 2); x += 60;
          ctx.fillText(row.size, x, totalY + rowHeight / 2); x += 60;
          ctx.fillText(row.quantity, x, totalY + rowHeight / 2); x += 60;
          ctx.fillText(row.process, x, totalY + rowHeight / 2); x += 60;
          ctx.textAlign = 'left';
          ctx.fillText(row.remark, x + 10, totalY + rowHeight / 2);
        } else {
          // 收回单行
          ctx.textAlign = 'center';
          ctx.fillText(row.date, x, totalY + rowHeight / 2); x += 80;
          ctx.fillText(row.weight, x, totalY + rowHeight / 2); x += 60;
          ctx.fillText(row.color, x, totalY + rowHeight / 2); x += 60;
          ctx.fillText(row.size, x, totalY + rowHeight / 2); x += 60;
          ctx.fillText(row.quantity, x, totalY + rowHeight / 2); x += 60;
          ctx.fillText(row.price, x, totalY + rowHeight / 2); x += 60;
          ctx.fillText(row.fee, x, totalY + rowHeight / 2); x += 60;
          ctx.fillText(row.payment, x, totalY + rowHeight / 2); x += 60;
          ctx.fillText(row.process, x, totalY + rowHeight / 2); x += 60;
          ctx.textAlign = 'left';
          ctx.fillText(row.remark, x + 10, totalY + rowHeight / 2);
        }
        
        ctx.textAlign = 'left';
        
        // 累加组合计
        groupTotalWeight += parseFloat(row.weight || 0);
        groupTotalQty += parseInt(row.quantity || 0);
        if (type === 'receive') {
          groupTotalFee += parseFloat(row.fee || 0);
        }
        
        totalY += rowHeight;
      });
    });
    
    // 最后一组的小计
    this.drawGroupTotal(ctx, totalY, margin, width, type, groupTotalWeight, groupTotalQty, groupTotalFee);
    totalY += rowHeight;
    
    return totalY;
  },
  
  // 绘制组小计
  drawGroupTotal(ctx, y, margin, width, type, weight, qty, fee) {
    const rowHeight = 30;
    
    ctx.strokeRect(margin, y, width, rowHeight);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(margin, y, width, rowHeight);
    
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px sans-serif';
    
    ctx.fillText('合计:', margin + 100, y + rowHeight / 2);
    ctx.fillText(weight.toFixed(0), margin + 200, y + rowHeight / 2);
    
    if (type === 'send') {
      ctx.fillText('0', margin + 380, y + rowHeight / 2);
    } else {
      ctx.fillText(qty.toFixed(0), margin + 380, y + rowHeight / 2);
      ctx.fillText(fee.toFixed(0), margin + 500, y + rowHeight / 2);
    }
    
    // 绘制损耗率
    ctx.fillStyle = '#ff0000';
    ctx.fillText('损耗率', margin + 620, y + rowHeight / 2);
    ctx.fillText('1%', margin + 700, y + rowHeight / 2);
    
    // 恢复默认样式
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.font = 'normal 14px sans-serif';
  },
  
  // 绘制合计汇总
  drawTotalSummary(ctx, y, margin) {
    const { statement } = this.data;
    const rowHeight = 30;
    const width = this.data.canvasWidth - 2 * margin;
    
    ctx.strokeRect(margin, y, width, rowHeight);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(margin, y, width, rowHeight);
    
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px sans-serif';
    
    ctx.fillText('本期总计:', margin + 10, y + rowHeight / 2);
    
    // 添加总计数据
    ctx.textAlign = 'right';
    const totalSendWeight = statement.orders
      .filter(order => order.type === '发出单')
      .reduce((sum, order) => sum + parseFloat(order.weight || 0), 0);
    
    const totalReceiveWeight = statement.orders
      .filter(order => order.type === '收回单')
      .reduce((sum, order) => sum + parseFloat(order.weight || 0), 0);
    
    ctx.fillText(`发出总重: ${totalSendWeight.toFixed(0)}`, margin + 200, y + rowHeight / 2);
    ctx.fillText(`发出总数: 145`, margin + 320, y + rowHeight / 2);
    ctx.fillText(`收回总重: ${totalReceiveWeight.toFixed(0)}`, margin + 440, y + rowHeight / 2);
    ctx.fillText(`收回总数: 204`, margin + 560, y + rowHeight / 2);
    ctx.fillText(`工费总计: ${statement.totalFee || '855'}`, margin + 680, y + rowHeight / 2);
    
    // 单位声明
    y += rowHeight;
    ctx.textAlign = 'left';
    ctx.font = 'normal 14px sans-serif';
    ctx.fillText('重量单位: kg', margin + 10, y + rowHeight / 2);
    
    // 恢复默认样式
    ctx.textAlign = 'left';
  },
  
  // 绘制备注
  drawRemarks(ctx, y, margin) {
    const rowHeight = 30;
    
    ctx.font = 'normal 14px sans-serif';
    ctx.fillStyle = '#ff0000';
    ctx.textAlign = 'center';
    ctx.fillText('备注: 损耗率 = (发出重量合计-收回重量合计)/发出重量合计', margin + (this.data.canvasWidth - 2 * margin) / 2, y + rowHeight / 2);
    
    y += rowHeight;
    ctx.fillText('回毛: 发出的毛料有剩余, 收回时直接还回厂毛.', margin + (this.data.canvasWidth - 2 * margin) / 2, y + rowHeight / 2);
    
    // 恢复默认样式
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
  },
  // 跳转到发出单详情
  goToSendOrderDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/send-order/send-order?id=${id}&mode=view`
    });
  },
  // 跳转到收回单详情
  goToReceiveOrderDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/receive-order-detail/receive-order-detail?id=${id}`
    });
  },
  // 支持下拉刷新
  onPullDownRefresh() {
    if (this.data.selectedFactory) {
      this.fetchStatement();
    } else {
      this.fetchFactories();
    }
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
  
  // 返回收发管理页面
  backToSendReceive() {
    wx.switchTab({
      url: '/pages/send-receive/send-receive'
    });
  },
  // 切换货号详情展开/收起
  toggleStyleDetail(e) {
    const styleNo = e.currentTarget.dataset.style;
    this.setData({
      openStyleDetail: this.data.openStyleDetail === styleNo ? null : styleNo
    });
  },
  
  // 选择工序
  selectProcess(e) {
    const process = e.currentTarget.dataset.process;
    this.setData({
      selectedProcess: this.data.selectedProcess === process ? null : process
    });
  },
});