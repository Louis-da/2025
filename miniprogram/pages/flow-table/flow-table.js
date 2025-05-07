const api = require('../../utils/api')

Page({
  data: {
    productNo: '',
    flowTable: null, // 初始值为null表示未查询过
    formattedFlowData: [], // 格式化后的流水数据
    canvasWidth: 750,
    canvasHeight: 1200,
    
    // 新增分享相关数据
    shareImagePath: '',
    showShareModalFlag: false,
    
    // 新增Excel分享相关数据
    excelFilePath: '',
    showExcelShareModalFlag: false,
    
    // 筛选相关
    showFilterModalFlag: false, // 筛选弹窗是否显示
    showProductSelectorFlag: false, // 货品选择弹窗是否显示
    selectedProduct: '', // 选中的货品名称
    selectedProductId: '', // 选中的货品ID
    selectedFactory: '', // 选中的工厂
    selectedFactoryId: '', // 选中的工厂ID
    dateRange: { // 时间范围
      start: '',
      end: ''
    },
    hasFilter: false, // 是否有筛选条件
    
    // 货品列表
    productList: [],
    filteredProductList: [],
    productSearchKeyword: '',
    
    // 工厂列表
    factories: [],
    
    // 流水摘要数据
    processSummary: [], // 按工序汇总
    factorySummary: [], // 按工厂汇总
    totalSendWeight: 0, // 总发出重量
    totalReceiveWeight: 0, // 总收回重量
    totalLossRate: 0 // 总损耗率
  },
  
  onLoad(options) {
    // 初始化工厂列表
    this.fetchFactories(() => {
      // 初始化货品列表
      this.initProducts();
      
      // 检查是否有URL参数传入的productNo
      if (options && options.productNo) {
        this.setData({ productNo: options.productNo });
        this.fetchFlowTable({ productNo: options.productNo }, () => {
          this.fetchFlowTableData();
        });
      }
      
      // 检查是否通过事件通道传递
      const eventChannel = this.getOpenerEventChannel();
      if (eventChannel) {
        eventChannel.on('passProductNo', (data) => {
          if (data && data.productNo) {
            this.setData({ productNo: data.productNo });
            this.fetchFlowTable({ productNo: data.productNo }, () => {
              this.fetchFlowTableData();
            });
          }
        });
      }
    });
  },
  
  // 初始化货品列表
  initProducts() {
    // 实际应该从API获取，这里使用模拟数据
    const products = [
      { 
        id: 'p1', 
        productNo: 'YF001', 
        name: '春季新款毛衣',
        imageUrl: '/images/ui/default-product.png'
      },
      { 
        id: 'p2', 
        productNo: 'YF002', 
        name: '夏季薄款T恤',
        imageUrl: '/images/ui/default-product.png'
      },
      { 
        id: 'p3', 
        productNo: 'YF003', 
        name: '冬季加厚围巾',
        imageUrl: '/images/ui/default-product.png'
      }
    ];
    
    this.setData({ 
      productList: products,
      filteredProductList: products
    });
  },
  
  inputProductNo(e) {
    this.setData({ productNo: e.detail.value });
  },
  
  // 显示货品选择弹窗
  showProductSelector() {
    this.setData({ 
      showProductSelectorFlag: true,
      filteredProductList: this.data.productList,
      productSearchKeyword: ''
    });
  },
  
  // 隐藏货品选择弹窗
  hideProductSelector() {
    this.setData({ showProductSelectorFlag: false });
  },
  
  // 防止弹窗滑动穿透
  preventTouchMove() {
    return false;
  },
  
  // 搜索货品
  searchProducts(e) {
    const keyword = e.detail.value.toLowerCase();
    this.setData({ productSearchKeyword: keyword });
    
    if (!keyword) {
      this.setData({ filteredProductList: this.data.productList });
      return;
    }
    
    const filtered = this.data.productList.filter(product => 
      product.productNo.toLowerCase().includes(keyword) || 
      product.name.toLowerCase().includes(keyword)
    );
    
    this.setData({ filteredProductList: filtered });
  },
  
  // 选择货品
  selectProduct(e) {
    const product = e.currentTarget.dataset.product;
    this.setData({
      selectedProductId: product.id,
      selectedProduct: `${product.productNo} ${product.name}`,
      showProductSelectorFlag: false,
      productNo: product.productNo
    });
  },
  
  // 选择工厂
  selectFactory(e) {
    const index = e.detail.value;
    const factory = this.data.factories[index];
    this.setData({
      selectedFactoryId: factory.id,
      selectedFactory: factory.name
    });
  },
  
  // 选择开始日期
  selectStartDate(e) {
    const dateRange = { ...this.data.dateRange, start: e.detail.value };
    this.setData({ dateRange });
  },
  
  // 选择结束日期
  selectEndDate(e) {
    const dateRange = { ...this.data.dateRange, end: e.detail.value };
    this.setData({ dateRange });
  },
  
  // 清除特定筛选条件
  clearFilter(e) {
    const type = e.currentTarget.dataset.type;
    
    if (type === 'product') {
      this.setData({
        selectedProduct: '',
        selectedProductId: '',
        productNo: ''
      });
    } else if (type === 'factory') {
      this.setData({
        selectedFactory: '',
        selectedFactoryId: ''
      });
    } else if (type === 'date') {
      this.setData({
        dateRange: {
          start: '',
          end: ''
        }
      });
    }
    
    // 重新检查是否有筛选条件
    const { selectedProduct, selectedFactory, dateRange } = this.data;
    const hasFilter = !!(selectedProduct || selectedFactory || dateRange.start);
    this.setData({ hasFilter });
    
    this.fetchFlowTableData();
  },
  
  fetchFlowTable(params, callback) {
    api.request('/flow-table', 'GET', params)
      .then(res => {
        if (Array.isArray(res)) {
          this.setData({ flowTable: res });
        } else {
          this.setData({ flowTable: [] });
          wx.showToast({ title: '未获取到流水数据', icon: 'none' });
        }
        if (callback) callback();
      })
      .catch(() => {
        this.setData({ flowTable: [] });
        wx.showToast({ title: '获取流水数据失败', icon: 'none' });
        if (callback) callback();
      });
  },
  
  fetchFactories(callback) {
    api.request('/factories', 'GET')
      .then(res => {
        if (Array.isArray(res)) {
          this.setData({ factories: res });
        } else {
          this.setData({ factories: [] });
          wx.showToast({ title: '未获取到工厂数据', icon: 'none' });
        }
        if (callback) callback();
      })
      .catch(() => {
        this.setData({ factories: [] });
        wx.showToast({ title: '获取工厂数据失败', icon: 'none' });
        if (callback) callback();
      });
  },
  
  // 将原始数据格式化为表格所需的格式
  formatFlowTableData(data) {
    const formattedData = [];
    const dateMap = new Map();
    
    // 第一步：按日期和工厂/工序分组
    data.forEach(item => {
      const date = item.date;
      const process = item.process;
      const factory = item.factory_name;
      const factoryProcess = `${factory}-${process}`;
      
      if (!dateMap.has(factoryProcess)) {
        dateMap.set(factoryProcess, {
          sendInfo: [],
          receiveInfo: [],
          sendDate: '',
          receiveDate: '',
          sendPerson: '',
          receivePerson: '',
          factory: factory,
          process: process
        });
      }
      
      const record = dateMap.get(factoryProcess);
      
      if (item.type === 'send') {
        record.sendInfo.push({
          color: item.color,
          size: item.size,
          weight: item.weight,
          quantity: item.quantity,
          date: item.date
        });
        record.sendDate = item.date;
        record.sendPerson = item.person;
      } else if (item.type === 'receive') {
        record.receiveInfo.push({
          color: item.color,
          size: item.size,
          weight: item.weight,
          quantity: item.quantity,
          date: item.date
        });
        record.receiveDate = item.date;
        record.receivePerson = item.person;
      }
    });
    
    // 转换为数组
    dateMap.forEach(value => {
      formattedData.push(value);
    });
    
    // 先按工序排序，相同工序再按日期排序
    formattedData.sort((a, b) => {
      // 首先按工序排序
      const processCompare = a.process.localeCompare(b.process);
      if (processCompare !== 0) return processCompare;
      
      // 然后按工厂排序
      const factoryCompare = a.factory.localeCompare(b.factory);
      if (factoryCompare !== 0) return factoryCompare;
      
      // 最后按日期排序
      const dateA = a.sendDate || a.receiveDate;
      const dateB = b.sendDate || b.receiveDate;
      return new Date(dateA) - new Date(dateB);
    });
    
    this.setData({ formattedFlowData: formattedData });
    
    // 计算汇总数据
    this.calculateSummaryData(data);
  },
  
  // 计算汇总数据
  calculateSummaryData(data) {
    // 按工序汇总
    const processMap = new Map();
    // 按工厂汇总
    const factoryMap = new Map();
    // 记录不同的工厂，用于后续分组
    const factories = new Set();
    
    // 总计数据
    let totalSendWeight = 0;
    let totalReceiveWeight = 0;
    
    // 统计数据
    data.forEach(item => {
      const process = item.process;
      const factory = item.factory_name;
      const weight = parseFloat(item.weight) || 0;
      const quantity = parseInt(item.quantity) || 0;
      const fee = parseFloat(item.fee) || 0;
      
      // 记录工厂
      factories.add(factory);
      
      // 按工序汇总
      if (!processMap.has(process)) {
        processMap.set(process, {
          process: process,
          sendWeight: 0,
          receiveWeight: 0
        });
      }
      
      // 按工厂+工序汇总
      const factoryProcessKey = `${factory}-${process}`;
      if (!factoryMap.has(factoryProcessKey)) {
        factoryMap.set(factoryProcessKey, {
          factory: factory,
          process: process,
          sendWeight: 0,
          receiveWeight: 0,
          sendQuantity: 0,
          receiveQuantity: 0,
          fee: 0
        });
      }
      
      const processItem = processMap.get(process);
      const factoryItem = factoryMap.get(factoryProcessKey);
      
      if (item.type === 'send') {
        processItem.sendWeight += weight;
        factoryItem.sendWeight += weight;
        factoryItem.sendQuantity += quantity;
        totalSendWeight += weight;
      } else if (item.type === 'receive') {
        processItem.receiveWeight += weight;
        factoryItem.receiveWeight += weight;
        factoryItem.receiveQuantity += quantity;
        factoryItem.fee += fee;
        totalReceiveWeight += weight;
      }
    });
    
    // 计算损耗率
    const processSummary = [];
    processMap.forEach(item => {
      const lossWeight = item.sendWeight - item.receiveWeight;
      const lossRate = item.sendWeight > 0 ? 
                      ((lossWeight / item.sendWeight) * 100).toFixed(2) : 
                      "0.00";
      
      processSummary.push({
        ...item,
        sendWeight: item.sendWeight.toFixed(2),
        receiveWeight: item.receiveWeight.toFixed(2),
        lossRate
      });
    });
    
    // 先对工厂汇总数据进行排序
    // 1. 先将Map转为数组
    const factoryArray = Array.from(factoryMap.entries()).map(([key, value]) => {
      const lossWeight = value.sendWeight - value.receiveWeight;
      const lossRate = value.sendWeight > 0 ? 
                       ((lossWeight / value.sendWeight) * 100).toFixed(2) : 
                       "0.00";
                       
      return {
        ...value,
        sendWeight: value.sendWeight.toFixed(2),
        receiveWeight: value.receiveWeight.toFixed(2),
        fee: value.fee.toFixed(0),
        lossRate,
        key: key // 保留原键以便后续处理
      };
    });
    
    // 2. 按工厂名称和工序排序
    factoryArray.sort((a, b) => {
      // 先按工厂名称排序
      const factoryCompare = a.factory.localeCompare(b.factory);
      if (factoryCompare !== 0) return factoryCompare;
      
      // 工厂名称相同则按工序排序
      return a.process.localeCompare(b.process);
    });
    
    // 3. 为每个工厂分配一个组索引，以便在UI中应用不同的背景色
    const factoryGroupMap = new Map();
    Array.from(factories).sort().forEach((factory, index) => {
      factoryGroupMap.set(factory, index % 4);
    });
    
    // 4. 为每个汇总项添加组索引
    const factorySummary = factoryArray.map(item => {
      return {
        ...item,
        groupIndex: factoryGroupMap.get(item.factory)
      };
    });
    
    // 计算总损耗率
    const totalLossWeight = totalSendWeight - totalReceiveWeight;
    const totalLossRate = totalSendWeight > 0 ? 
                        ((totalLossWeight / totalSendWeight) * 100).toFixed(2) : 
                        "0.00";
    
    // 对工序按名称排序
    processSummary.sort((a, b) => a.process.localeCompare(b.process));
    
    this.setData({
      processSummary,
      factorySummary,
      totalSendWeight: totalSendWeight.toFixed(2),
      totalReceiveWeight: totalReceiveWeight.toFixed(2),
      totalLossRate
    });
  },
  
  // 隐藏图片分享弹窗
  hideShareModal() {
    this.setData({ showShareModalFlag: false });
  },
  
  // 隐藏Excel分享弹窗
  hideExcelShareModal() {
    this.setData({ showExcelShareModalFlag: false });
  },

  // 计算导出图片所需的高度
  calculateExportHeight() {
    const { formattedFlowData, processSummary, factorySummary } = this.data;
    
    // 基础高度：标题 + 筛选条件区域 + 边距
    let height = 120;
    
    // 根据筛选条件数量增加高度
    const { selectedProduct, selectedFactory, dateRange } = this.data;
    if (selectedProduct) height += 25;
    if (selectedFactory) height += 25;
    if (dateRange.start) height += 25;
    
    // 表格头部高度
    height += 40;
    
    // 表格内容高度
    // 每行高度大约为50，但限制最多显示30行
    const maxRows = Math.min(30, formattedFlowData.length);
    height += maxRows * 50;
    
    // 如果有工序分组，每个分组标题额外增加高度
    if (formattedFlowData.length > 0) {
      // 计算有多少个不同的工序
      const processes = new Set();
      formattedFlowData.forEach(item => {
        if (item.process) processes.add(item.process);
      });
      // 每个工序分组标题高度
      height += processes.size * 30;
    }
    
    // 摘要部分高度
    height += 50; // 摘要标题
    height += 20 * 3; // 摘要内容：总发出、总收回、总损耗

    // 按工序汇总高度
    if (processSummary.length > 0) {
      height += 40; // 子标题
      height += processSummary.length * 30; // 每条记录
    }
    
    // 按工厂汇总高度 (限制显示前10条)
    if (factorySummary.length > 0) {
      height += 40; // 子标题
      height += Math.min(10, factorySummary.length) * 30; // 每条记录
    }

    // 底部留白
    height += 50;
    
    return height;
  },

  // 导出为图片
  exportAsImage() {
    const that = this;
    wx.showLoading({ title: '正在生成图片...' });

    // 动态计算画布高度
    const calculatedHeight = this.calculateExportHeight();
    this.setData({
      canvasHeight: calculatedHeight
    });
    
    // 获取canvas上下文
    const query = wx.createSelectorQuery();
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // 设置canvas尺寸
        canvas.width = that.data.canvasWidth;
        canvas.height = that.data.canvasHeight;
        
        // 开始绘制
        that.drawFlowTable(ctx, canvas.width, canvas.height);
        
        // 将canvas内容转为图片
        wx.canvasToTempFilePath({
          canvas: canvas,
          success: function(res) {
            // 保存图片到相册
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: function(saveRes) {
                wx.hideLoading();
                that.setData({
                  shareImagePath: res.tempFilePath,
                  showShareModalFlag: true
                });
                
                wx.showToast({
                  title: '已保存到相册',
                  icon: 'success',
                  duration: 1500
                });
              },
              fail: function(err) {
                console.error('保存到相册失败:', err);
                wx.hideLoading();
                
                if (err.errMsg.indexOf('auth deny') >= 0 || err.errMsg.indexOf('authorize') >= 0) {
                  wx.showModal({
                    title: '提示',
                    content: '需要您授权保存图片到相册',
                    confirmText: '去设置',
                    success(res) {
                      if (res.confirm) {
                        wx.openSetting();
                      }
                    }
                  });
                } else {
                  wx.showModal({
                    title: '保存失败',
                    content: '图片保存失败，请重试',
                    showCancel: false
                  });
                }
              }
            });
          },
          fail: function(err) {
            console.error('canvas转图片失败:', err);
            wx.hideLoading();
            wx.showToast({
              title: '生成图片失败',
              icon: 'none'
            });
          }
        }, this);
      });
  },
  
  // 绘制流水表到Canvas
  drawFlowTable(ctx, canvasWidth, canvasHeight) {
    // 设置背景色
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制标题
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('收发流水表', canvasWidth / 2, 30);
    
    // 绘制筛选条件
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    let filterY = 60;
    
    if (this.data.selectedProduct) {
      ctx.fillText(`货品: ${this.data.selectedProduct}`, 20, filterY);
      filterY += 25;
    }
    
    if (this.data.selectedFactory) {
      ctx.fillText(`工厂: ${this.data.selectedFactory}`, 20, filterY);
      filterY += 25;
    }
    
    if (this.data.dateRange.start) {
      ctx.fillText(`时间: ${this.data.dateRange.start} 至 ${this.data.dateRange.end || '今天'}`, 20, filterY);
      filterY += 25;
    }
    
    // 增加一些空间作为标题和表格之间的分隔
    filterY += 20;
    
    // 表格宽度和列宽度设置
    const colWidths = [80, 120, 150, 150, 80];
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    const tableX = Math.max(20, (canvasWidth - totalWidth) / 2);
    
    // 绘制表头背景
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(tableX, filterY, totalWidth, 40);
    
    // 绘制表头分隔线
    ctx.strokeStyle = '#e6e6e6';
    ctx.beginPath();
    ctx.moveTo(tableX, filterY + 40);
    ctx.lineTo(tableX + totalWidth, filterY + 40);
    ctx.stroke();
    
    // 绘制表头文字
    ctx.fillStyle = '#000000';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    
    // 表头第一行 - 发出/收回分组
    let headerY = filterY + 18;
    ctx.fillText('发出', tableX + colWidths[0] + colWidths[1]/2, headerY);
    ctx.fillText('收回', tableX + colWidths[0] + colWidths[1] + colWidths[2]/2, headerY);
    
    // 表头第二行 - 列标题
    headerY = filterY + 35;
    const headers = ['日期', '工厂', '', '工厂', '日期'];
    let currentX = tableX;
    
    for (let i = 0; i < headers.length; i++) {
      ctx.fillText(headers[i], currentX + colWidths[i]/2, headerY);
      currentX += colWidths[i];
    }
    
    // 绘制表格内容
    let currentY = filterY + 40;
    const rowHeight = 50;
    
    // 获取处理后的数据
    const flowData = this.data.formattedFlowData || [];
    
    // 最多显示30行数据(包括工序标题)，防止图片过长
    const maxDisplayRows = 30;
    let displayedRows = 0;
    let currentProcess = '';
    
    // 表格行
    for (let i = 0; i < flowData.length && displayedRows < maxDisplayRows; i++) {
      const item = flowData[i];
      
      // 绘制工序分组标题
      if (i === 0 || item.process !== currentProcess) {
        currentProcess = item.process;
        
        // 绘制工序标题背景
        ctx.fillStyle = 'rgba(0, 122, 255, 0.05)';
        ctx.fillRect(tableX, currentY, totalWidth, 30);
        
        // 绘制工序标题文字
        ctx.fillStyle = '#007AFF';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(item.process, tableX + 20, currentY + 20);
        
        // 更新垂直位置
        currentY += 30;
        displayedRows++;
        
        // 检查是否超出最大行数
        if (displayedRows >= maxDisplayRows) break;
      }
      
      // 绘制行背景
      ctx.fillStyle = displayedRows % 2 === 0 ? '#ffffff' : '#f9f9f9';
      ctx.fillRect(tableX, currentY, totalWidth, rowHeight);
      
      // 绘制分隔线
      ctx.strokeStyle = '#e6e6e6';
      ctx.beginPath();
      ctx.moveTo(tableX, currentY + rowHeight);
      ctx.lineTo(tableX + totalWidth, currentY + rowHeight);
      ctx.stroke();
      
      // 绘制内容
      ctx.fillStyle = '#000000';
      ctx.font = '12px sans-serif';
      
      // 发出日期
      ctx.textAlign = 'center';
      ctx.fillText(item.sendDate || '', tableX + colWidths[0]/2, currentY + 25);
      
      // 工厂名称
      ctx.textAlign = 'right';
      ctx.fillText(item.factory || '', tableX + colWidths[0] + colWidths[1] - 10, currentY + 25);
      
      // 发出信息 - 更详细处理
      ctx.textAlign = 'left';
      if (item.sendInfo && item.sendInfo.length > 0) {
        let sendTextY = currentY + 15;
        const maxInfoShow = Math.min(2, item.sendInfo.length);
        
        for (let j = 0; j < maxInfoShow; j++) {
          const sendItem = item.sendInfo[j];
          const sendText = `${sendItem.color || ''} ${sendItem.size || ''} ${sendItem.weight || 0}kg ${sendItem.quantity ? '×' + sendItem.quantity : ''}`;
          ctx.fillText(sendText, tableX + colWidths[0] + colWidths[1] + 10, sendTextY);
          sendTextY += 18;
        }
        
        if (item.sendInfo.length > maxInfoShow) {
          ctx.fillText(`...共${item.sendInfo.length}项`, tableX + colWidths[0] + colWidths[1] + 10, sendTextY);
        }
      }
      
      // 收回信息 - 更详细处理
      if (item.receiveInfo && item.receiveInfo.length > 0) {
        let receiveTextY = currentY + 15;
        const maxInfoShow = Math.min(2, item.receiveInfo.length);
        
        for (let j = 0; j < maxInfoShow; j++) {
          const receiveItem = item.receiveInfo[j];
          const receiveText = `${receiveItem.color || ''} ${receiveItem.size || ''} ${receiveItem.weight || 0}kg ${receiveItem.quantity ? '×' + receiveItem.quantity : ''}`;
          ctx.fillText(receiveText, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, receiveTextY);
          receiveTextY += 18;
        }
        
        if (item.receiveInfo.length > maxInfoShow) {
          ctx.fillText(`...共${item.receiveInfo.length}项`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, receiveTextY);
        }
      }
      
      // 工厂名称(收回)
      ctx.textAlign = 'right';
      ctx.fillText(item.factory || '', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 10, currentY + 25);
      
      // 收回日期
      ctx.textAlign = 'center';
      ctx.fillText(item.receiveDate || '', tableX + totalWidth - colWidths[4]/2, currentY + 25);
      
      // 更新垂直位置
      currentY += rowHeight;
      displayedRows++;
    }
    
    // 如果数据超过了最大显示行数，添加提示
    if (flowData.length > maxDisplayRows) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#999999';
      ctx.fillText(`... 还有${flowData.length - displayedRows}条记录 ...`, canvasWidth / 2, currentY + 20);
      currentY += 40;
    }
    
    // 绘制摘要信息
    currentY += 20;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('流水摘要', tableX, currentY);
    currentY += 30;
    
    ctx.font = '14px sans-serif';
    ctx.fillText(`总发出重量: ${this.data.totalSendWeight || 0} kg`, tableX, currentY);
    currentY += 25;
    
    ctx.fillText(`总收回重量: ${this.data.totalReceiveWeight || 0} kg`, tableX, currentY);
    currentY += 25;
    
    // 高亮显示损耗率
    let lossRateText = `总损耗率: ${this.data.totalLossRate || 0}%`;
    if (this.data.totalLossRate > 5) {
      ctx.fillStyle = '#FF3B30'; // 苹果红色
    }
    ctx.fillText(lossRateText, tableX, currentY);
    
    // 添加生成时间和水印
    ctx.fillStyle = '#999999';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    const now = new Date();
    const timeString = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    ctx.fillText(`生成时间: ${timeString}`, canvasWidth / 2, canvasHeight - 20);
  },
  
  // 配置分享功能
  onShareAppMessage: function(res) {
    // 来自分享按钮的分享
    if (res.from === 'button') {
      const { productNo, selectedProduct } = this.data;
      
      // 根据不同的分享类型设置不同的分享内容
      if (this.data.showShareModalFlag) {
        // 分享图片
        return {
          title: `${selectedProduct || productNo || '货品'}的收发流水表`,
          path: `/pages/flow-table/flow-table?productNo=${productNo || ''}`,
          imageUrl: this.data.shareImagePath
        };
      } else if (this.data.showExcelShareModalFlag) {
        // 分享Excel
        return {
          title: `${selectedProduct || productNo || '货品'}的收发流水表(Excel)`,
          path: `/pages/flow-table/flow-table?productNo=${productNo || ''}`,
          // Excel没有预览图，使用默认小程序卡片
        };
      }
    }
    
    // 来自右上角菜单的分享
    return {
      title: '工厂收发流水表',
      path: '/pages/flow-table/flow-table'
    };
  },
  
  // 导出为Excel表格
  exportAsExcel() {
    const { flowTable, productNo, selectedProduct } = this.data;
    
    wx.showLoading({ title: '正在导出...' });
    
    // 准备表格数据
    const generateExcelData = () => {
      let excelData = [];
      
      // 添加标题行
      excelData.push(['收发流水表']);
      excelData.push([]);
      
      // 添加筛选条件
      if (this.data.selectedProduct) {
        excelData.push(['货品:', this.data.selectedProduct]);
      }
      
      if (this.data.selectedFactory) {
        excelData.push(['工厂:', this.data.selectedFactory]);
      }
      
      if (this.data.dateRange.start) {
        excelData.push(['时间:', `${this.data.dateRange.start} 至 ${this.data.dateRange.end || '今天'}`]);
      }
      
      excelData.push([]);
      
      // 添加表头
      excelData.push(['日期', '工厂', '工序', '发出信息', '发出重量(kg)', '收回信息', '收回重量(kg)', '损耗率', '日期']);
      
      // 添加数据行
      const flowData = this.data.formattedFlowData || [];
      let currentProcess = '';
      
      flowData.forEach((item, index) => {
        // 如果是新工序，添加工序分隔行
        if (index === 0 || item.process !== currentProcess) {
          currentProcess = item.process;
          excelData.push([`工序：${item.process}`, '', '', '', '', '', '', '', '']);
        }
        
        // 发出信息格式化
        let sendInfoText = '';
        let sendWeightTotal = 0;
        
        if (item.sendInfo && item.sendInfo.length > 0) {
          sendInfoText = item.sendInfo.map(si => 
            `${si.color || ''} ${si.size || ''} ${si.weight || 0}kg ${si.quantity ? '×' + si.quantity : ''}`
          ).join('\n');
          
          // 计算总重量
          sendWeightTotal = item.sendInfo.reduce((total, si) => total + (parseFloat(si.weight) || 0), 0);
        }
        
        // 收回信息格式化
        let receiveInfoText = '';
        let receiveWeightTotal = 0;
        
        if (item.receiveInfo && item.receiveInfo.length > 0) {
          receiveInfoText = item.receiveInfo.map(ri => 
            `${ri.color || ''} ${ri.size || ''} ${ri.weight || 0}kg ${ri.quantity ? '×' + ri.quantity : ''}`
          ).join('\n');
          
          // 计算总重量
          receiveWeightTotal = item.receiveInfo.reduce((total, ri) => total + (parseFloat(ri.weight) || 0), 0);
        }
        
        // 计算损耗率
        const lossRate = sendWeightTotal > 0 ? 
                        ((sendWeightTotal - receiveWeightTotal) / sendWeightTotal * 100).toFixed(2) + '%' : 
                        '0.00%';
        
        excelData.push([
          item.sendDate || '',
          item.factory || '',
          item.process || '',
          sendInfoText,
          sendWeightTotal.toFixed(2),
          receiveInfoText,
          receiveWeightTotal.toFixed(2),
          lossRate,
          item.receiveDate || ''
        ]);
      });
      
      // 添加汇总信息
      excelData.push([]);
      excelData.push(['流水摘要']);
      excelData.push(['总发出重量:', `${this.data.totalSendWeight || 0} kg`]);
      excelData.push(['总收回重量:', `${this.data.totalReceiveWeight || 0} kg`]);
      excelData.push(['总损耗率:', `${this.data.totalLossRate || 0}%`]);
      
      // 添加生成时间
      const now = new Date();
      const timeString = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      excelData.push(['生成时间:', timeString]);
      
      // 返回Excel数据对象
      return {
        name: `${selectedProduct || productNo || '货品'}_收发流水表`,
        sheets: [{
          sheetName: '收发流水',
          data: excelData
        }]
      };
    };
    
    const excelData = generateExcelData();
    
    // 在小程序环境中，使用自建后端或本地导出逻辑
    // 这里使用模拟方式，在实际项目中应替换为真实的导出逻辑
    setTimeout(() => {
      wx.hideLoading();
      
      // 模拟生成临时文件路径，实际项目中应通过云函数或API生成
      const tempFilePath = `${wx.env.USER_DATA_PATH}/excel_${Date.now()}.xlsx`;
      
      // 模拟文件保存成功
      wx.showToast({
        title: '表格已导出',
        icon: 'success',
        duration: 1500,
        success: () => {
          // 设置Excel文件路径并显示分享弹窗
          this.setData({
            excelFilePath: tempFilePath,
            showExcelShareModalFlag: true
          });
        }
      });
    }, 1500);
  },
  
  // 分享流水表（可选功能）
  shareFlowTable() {
    const { flowTable, productNo } = this.data;
    let shareText = `货号"${productNo}"的收发流水表\n\n`;
    
    if (flowTable && flowTable.length > 0) {
      flowTable.forEach((item, index) => {
        // 为每个记录添加序号
        shareText += `#${index + 1}\n`;
        shareText += `类型：${item.type === 'send' ? '发出' : '收回'}\n`;
        shareText += `单据号：${item.order_no}\n`;
        shareText += `工厂：${item.factory_name}\n`;
        shareText += `工序：${item.process}\n`;
        shareText += `货品：${item.productNo} ${item.color} ${item.size}\n`;
        shareText += `重量：${item.weight}kg\n`;
        shareText += `数量：${item.quantity}打\n`;
        shareText += `工费：${item.fee || 0}元\n`;
        shareText += `时间：${item.date}\n\n`;
      });
    }
    
    // 复制到剪贴板
    wx.setClipboardData({
      data: shareText,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板' });
      }
    });
    
    wx.showModal({
      title: '分享提示',
      content: '流水表内容已复制到剪贴板，您可以粘贴分享给他人',
      showCancel: false
    });
  },

  // 返回收发管理页面
  backToSendReceive() {
    wx.switchTab({
      url: '/pages/send-receive/send-receive'
    });
  }
});