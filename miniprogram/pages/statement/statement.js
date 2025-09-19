const api = require('../../utils/api')
const imageUtil = require('../../utils/image.js') // 添加image工具引用
const { searchMatch } = require('../../utils/pinyin'); // 引入拼音搜索工具

Page({
  data: {
    factories: [],
    products: [],
    selectedFactory: null,
    selectedProduct: null,
    startDate: '',
    endDate: '',
    statement: null,
    isLoading: false,
    canvasWidth: 800,  // 保持Canvas宽度
    canvasHeight: 1400, // 增加Canvas高度以容纳图片和分页
    // 修改工厂搜索相关 - 改为下拉式
    factorySearchKeyword: '',
    filteredFactories: [],
    // 新增下拉式搜索相关
    showFactoryDropdown: false,
    hideDropdownTimer: null,
    // 新增货品下拉搜索相关
    productSearchKeyword: '',
    filteredProducts: [],
    showProductDropdown: false,
    hideProductDropdownTimer: null,
    productInputValue: '' // 添加输入框显示值
  },
  onLoad() {
    // 获取系统信息，用于响应式布局
    const systemInfo = wx.getWindowInfo();
    
    // 设置默认查询日期为当前年度的时间范围
    const now = new Date();
    const currentYear = now.getFullYear();
    const yearStartDate = `${currentYear}-01-01`;
    const yearEndDate = `${currentYear}-12-31`;
    
    // 根据屏幕宽度调整Canvas尺寸
    const screenWidth = systemInfo.windowWidth;
    const canvasWidth = Math.min(750, screenWidth * 2); // 2倍图用于高清显示
    
    // 设置默认日期和初始值
    this.setData({
      startDate: yearStartDate,
      endDate: yearEndDate,
      productInputValue: '全部货品', // 设置初始显示值
      canvasWidth
    });
    
    // 获取工厂列表和货品列表
    this.fetchFactories();
    this.fetchProducts();
    
    // 设置导航栏标题为空，避免显示"工厂对账单"
    wx.setNavigationBarTitle({
      title: ''
    });
  },
  fetchFactories() {
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      wx.showToast({ title: '组织信息缺失，请重新登录', icon: 'none' });
      return;
    }
    
    api.getFactories()
      .then(res => {
        console.log('[statement.js fetchFactories] API调用成功');
        const factories = res.data || [];
        console.log('[statement.js fetchFactories] 获取到工厂数量:', factories.length);
        
        // 过滤掉已停用的工厂（status = 'inactive'），只显示启用的工厂（status = 'active'）
        const enabledFactories = factories.filter(f => f.status === 'active');
        console.log('[statement.js fetchFactories] 过滤后启用的工厂数量:', enabledFactories.length);
        
        const updateObj = { 
          factories: enabledFactories,
          filteredFactories: enabledFactories // 初始化过滤后的工厂列表
        };
        console.log('[statement.js fetchFactories] setData with:', updateObj);
        this.setData(updateObj);
      })
      .catch(err => {
        console.error('[statement.js fetchFactories] API调用失败:', err);
        const updateObj = { 
          factories: [],
          filteredFactories: [] // 同时清空过滤列表
        };
        console.log('[statement.js fetchFactories CATCH] setData with:', updateObj);
        this.setData(updateObj);
        wx.showToast({ title: '获取工厂数据失败', icon: 'none' });
      });
  },
  selectFactory(e) {
    const factory = this.data.factories[e.detail.value];
    this.setData({ selectedFactory: factory });
  },
  changeStartDate(e) {
    this.setData({ startDate: e.detail.value });
  },
  changeEndDate(e) {
    this.setData({ endDate: e.detail.value });
  },
  fetchProducts() {
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      wx.showToast({ title: '组织信息缺失，请重新登录', icon: 'none' });
      return;
    }
    
    api.cloudFunctionRequest('/products', 'GET', { orgId })
      .then(res => {
        if (res && res.success && res.data) {
          // 过滤掉已停用的货品（status = 0），只显示启用的货品（status = 1）
          const enabledProducts = res.data.filter(p => p.status === 1);
  
          
          this.setData({
            products: enabledProducts,
            filteredProducts: enabledProducts // 初始化过滤后的货品列表
          });
        }
      })
      .catch(err => {
        console.error('获取产品列表失败:', err);
        this.setData({
          products: [],
          filteredProducts: [] // 同时清空过滤列表
        });
      });
  },
  selectProduct(e) {
    const product = this.data.products[e.detail.value];
    this.setData({ selectedProduct: product });
  },
  // 获取对账单数据
  async fetchStatement() {
    // 🔧 新增：检查token有效性
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      wx.navigateTo({
        url: '/pages/login/login'
      });
      return;
    }

    if (!this.data.selectedFactory) {
      wx.showToast({
        title: '请先选择工厂',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isLoading: true,
      statement: null
    });

    try {
      console.log('开始获取对账单数据...');
      console.log('查询参数:', {
        factoryName: this.data.selectedFactory.name,
        productId: (this.data.selectedProduct && this.data.selectedProduct.id) || '',
        startDate: this.data.startDate,
        endDate: this.data.endDate
      });

      const requestData = {
        factoryName: this.data.selectedFactory.name,  // 🔧 修复：使用factoryName而不是factoryId
        startDate: this.data.startDate,
        endDate: this.data.endDate
      };

      // 如果选择了具体货品，添加货品ID
      if (this.data.selectedProduct && this.data.selectedProduct.id) {
        requestData.productId = this.data.selectedProduct.id;
      }

      const response = await api.cloudFunctionRequest('/statement', 'GET', requestData);

      console.log('后端返回原始数据:', response);

      if (response && (response.success || response.data || Array.isArray(response))) {
        // 统一处理数据格式
        let statementData = response.data || response;
        
        // 获取付款记录
        const paymentRecords = await this.fetchPaymentRecords();
        
        // 处理对账单数据
        const processedStatement = this.processBackendStatementData(statementData, paymentRecords);
        
        // 🔧 修复：检查处理结果是否有效
        if (!processedStatement) {
          throw new Error('对账单数据处理失败');
        }
        
        // 🔧 优化：预处理图片URL，避免重复请求
        if (processedStatement.products && processedStatement.products.length > 0) {
          processedStatement.products = processedStatement.products.map(product => {
            // 重置图片加载状态
            product.imageLoadFailed = false;
            product.showPlaceholder = false;
            
            // 如果有图片URL，使用完整URL
            if (product.imageUrl && !product.imageUrl.startsWith('http')) {
              product.imageUrl = imageUtil.getFullImageUrl(product.imageUrl);
            }
            
            return product;
          });
        }
        
        this.setData({
          statement: processedStatement,
          isLoading: false
        });

        console.log('处理后的对账单数据:', processedStatement);

        if (!processedStatement || ((!processedStatement.sendOrders || !processedStatement.sendOrders.length) && (!processedStatement.receiveOrders || !processedStatement.receiveOrders.length))) {
          wx.showToast({
            title: '该期间无对账数据',
            icon: 'none'
          });
        }
      } else {
        throw new Error('数据格式错误');
      }
    } catch (error) {
      console.error('获取对账单失败:', error);
      
      // 🔧 新增：JWT错误特殊处理
      if (error.message && error.message.includes('jwt')) {
        wx.showModal({
          title: '登录过期',
          content: '登录状态已过期，请重新登录',
          showCancel: false,
          success: () => {
            wx.removeStorageSync('token');
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        });
        return;
      }
      
      this.setData({
        isLoading: false,
        statement: null
      });

      let errorMessage = '获取对账单失败';
      if (error.message) {
        errorMessage += ': ' + error.message;
      }

      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 处理后端返回的对账单数据
  processBackendStatementData(backendData, paymentRecords = []) {
    try {
      const orders = backendData.orders || [];
      const sendOrders = [];
      const receiveOrders = [];
      const productsMap = new Map();
      
      // 🔧 重要修复：按订单ID分组处理，确保相同单号明细正确合并
      const orderGroups = {};
      orders.forEach(item => {
        const orderId = item.orderId;
        const orderType = item.orderType;
        const key = `${orderType}_${orderId}`;
        
        if (!orderGroups[key]) {
          orderGroups[key] = {
            id: orderId,
            orderNo: item.orderNo,
            date: item.orderDate,
            creator: '系统',
            process: item.orderProcess,
            quantity: 0,
            weight: 0,
            fee: 0, // 工费累计字段（各明细工费之和）
            totalAmount: orderType === 'receive' ? '0.00' : '0.00', // 🔧 修正：totalAmount将通过累计工费计算
            paymentAmount: orderType === 'receive' ? (item.orderPaymentAmount || '0.00') : '0.00',
            paymentMethod: orderType === 'receive' ? (item.orderPaymentMethod || '') : '',
            balance: '0.00',
            remark: '',
            type: orderType,
            // 🔧 新增：保存第一个明细的产品信息，用于订单级别显示
            styleNo: item.styleNo,
            productNo: item.styleNo, // 兼容性字段
            productName: item.productName,
            productId: item.productId,
            // 🔧 新增：明细列表，用于展示相同单号的多条明细
            details: []
          };
        }
        
        // 累计数量和重量
        orderGroups[key].quantity += parseInt(item.itemQuantity || 0);
        orderGroups[key].weight += parseFloat(item.itemWeight || 0);
        // 🔧 重要修复：不再在前端重复计算工费，使用后端计算的订单级工费
        // 前端只处理明细显示，总金额严格使用后端的totalFee计算结果
        // 移除前端重复累计工费逻辑，避免与后端计算结果不一致
        
        // 🔧 新增：将明细添加到details数组，便于展示，包含完整的颜色、尺码等信息
        let fee = item.itemFee; // 使用后端SQL查询的正确字段itemFee
        if (fee === undefined || fee === null || fee === '') {
          fee = 0;
        }
        orderGroups[key].details.push({
          productId: item.productId,
          styleNo: item.styleNo,
          productName: item.productName,
          quantity: parseInt(item.itemQuantity || 0),
          weight: parseFloat(item.itemWeight || 0),
          unitPrice: parseFloat(fee) || 0, // fee就是工价
          price: fee || '', // 工价显示值
          process: item.orderProcess,
          imageUrl: item.imageUrl,
          itemColor: item.itemColor,
          color: item.itemColor, // 兼容字段
          itemSize: item.itemSize,
          size: item.itemSize, // 兼容字段
          creator: item.creator || item.orderCreator || '',
          remark: item.remark || item.orderRemark || '',
          itemQuantity: parseInt(item.itemQuantity || 0),
          itemWeight: parseFloat(item.itemWeight || 0)
        });
        
        // 🔧 调试：检查收回单明细的工价
        if (orderType === 'receive') {
          console.log(`[DEBUG] 收回单明细工价检查: 货号=${item.styleNo}, 数量=${item.itemQuantity}, itemFee=${item.itemFee}, 解析后工价=${parseFloat(item.itemFee || 0)}`);
        }
        
        // 处理货品汇总数据
        const productId = item.productId;
        const styleNo = item.styleNo;
        
        if (!productsMap.has(productId)) {
          // 🔧 修复：使用标准的imageUtil.getFullImageUrl函数处理图片URL
          let fullImageUrl = '';
          let fullOriginalImageUrl = '';
          
          if (item.imageUrl) {
            // 使用统一的图片URL处理函数，与货品管理保持一致
            fullImageUrl = imageUtil.getFullImageUrl(item.imageUrl);
            fullOriginalImageUrl = imageUtil.getFullImageUrl(item.imageUrl);
            console.log(`[对账单货品图片] 产品ID:${productId}, 原始URL:${item.imageUrl}, 处理后URL:${fullImageUrl}`);
          }

          productsMap.set(productId, {
            id: productId,
            productNo: styleNo,
            name: item.productName,
            process: item.orderProcess,
            imageUrl: fullImageUrl,
            originalImageUrl: fullOriginalImageUrl,
            sendQuantity: 0,
            sendWeight: 0,
            receiveQuantity: 0,
            receiveWeight: 0,
            lossRate: 0
          });
        }
        
        const product = productsMap.get(productId);
        if (orderType === 'send') {
          product.sendQuantity += parseInt(item.itemQuantity || 0);
          product.sendWeight += parseFloat(item.itemWeight || 0);
        } else if (orderType === 'receive') {
          product.receiveQuantity += parseInt(item.itemQuantity || 0);
          product.receiveWeight += parseFloat(item.itemWeight || 0);
        }
      });
      
      // 转换订单分组为数组，并格式化details
      Object.values(orderGroups).forEach(order => {
        order.weight = order.weight.toFixed(2);
        
        // 🔧 重要修复：使用后端计算的订单级工费，不再前端重复计算
        if (order.type === 'receive') {
          // 从后端数据中获取订单级工费（orderFee字段）
          const foundOrder = orders.find(item => 
            item.orderType === 'receive' && item.orderId === order.id
          );
          const backendOrderFee = foundOrder ? foundOrder.orderFee || 0 : 0;
          
          // 使用后端计算的订单工费，确保与数据库一致
          order.fee = parseFloat(backendOrderFee).toFixed(2);
          order.totalAmount = order.fee; // 确保一致性
          
          // 明细工费按比例分配（仅用于显示）
          const orderTotalFee = parseFloat(order.fee);
          const totalQuantity = order.details.reduce((sum, detail) => sum + (detail.quantity || 0), 0);
          
          order.details.forEach(detail => {
            // 按数量比例分配工费用于显示
            const detailRatio = totalQuantity > 0 ? (detail.quantity || 0) / totalQuantity : 0;
            detail.calculatedFee = (orderTotalFee * detailRatio); // 明细工费（显示用）
          });
        } else {
          // 🔧 修复：发出单明细也需要处理calculatedFee字段，避免toFixed undefined错误
          order.details.forEach(detail => {
            // 发出单明细：保持原有工价不变，只设置工费为0
            detail.calculatedFee = 0; // 发出单没有工费
            // 注意：不修改 detail.unitPrice，发出单本来就没有工价数据
          });
          // 发出单不涉及工费计算
          order.fee = order.fee ? order.fee.toFixed(2) : '';
        }
        
        // 🔧 格式化明细信息，确保科学严谨展示，包含颜色、尺码
        order.details = order.details.map(detail => {
          // 🔧 关键修正：使用计算出的工费值，并确保有默认值
          const calculatedFee = detail.calculatedFee || 0; // 明细工费
          const unitPrice = detail.unitPrice || 0; // 工价
          return {
            ...detail,
            weight: (detail.weight || 0).toFixed(2), // 🔧 防止undefined
            unitPrice: unitPrice, // 工价（fee字段的值）
            fee: calculatedFee.toFixed(2), // 明细工费（工价×数量）
            // 🔧 优化：包含颜色、尺码的完整显示文本
            displayText: `${detail.productName || ''}(${detail.styleNo || ''}) ${detail.itemColor || detail.color || ''}/${detail.itemSize || detail.size || ''} ${detail.quantity || 0}/${(detail.weight || 0).toFixed(2)}kg`
          };
        });
        
        if (order.type === 'send') {
          sendOrders.push(order);
        } else if (order.type === 'receive') {
          receiveOrders.push(order);
        }
      });
      
      // 计算货品损耗率
      productsMap.forEach(product => {
        if (product.sendWeight > 0) {
          product.lossRate = ((product.sendWeight - product.receiveWeight) / product.sendWeight * 100).toFixed(2);
        }
        product.sendWeight = product.sendWeight.toFixed(2);
        product.receiveWeight = product.receiveWeight.toFixed(2);
      });
      
      const products = Array.from(productsMap.values());
      
      // 🔧 重要修复：处理付款记录数据 - 按单据去重，避免重复计算
      const allPaymentRecords = [];
      
      // 1. 添加工厂账户明细中的付款记录
      paymentRecords.forEach(record => {
        // 安全的数值处理
        const amount = record.amount || record.paymentAmount || record.payAmount || 0;
        const numericAmount = parseFloat(amount);
        
        allPaymentRecords.push({
          id: record.id || record._id,
          date: record.date || record.createTime,
          orderNo: record.orderNo || record.paymentOrderNo || '',
          amount: (isNaN(numericAmount) ? 0 : numericAmount).toFixed(2),
          paymentMethod: record.paymentMethod || record.method || record.payMethod || '',
          remark: record.remark || record.description || '',
          type: record.type || 'payment',
          status: record.status || 'completed',
          source: 'account' // 标记来源为账户明细
        });
      });
      
      // 2. 🔧 修复：按收回单去重添加支付记录，避免多条明细重复计算
      const receiveOrderPayments = new Map(); // 用于收回单支付去重
      Object.values(orderGroups).forEach(order => {
        if (order.type === 'receive') {
          const paymentAmount = parseFloat(order.paymentAmount || 0);
          const orderNo = order.orderNo;
          
          // 🔧 关键修复：按收回单号去重，确保每个收回单的支付只记录一次
          if (paymentAmount > 0 && orderNo && !receiveOrderPayments.has(orderNo)) {
            receiveOrderPayments.set(orderNo, true);
            
            allPaymentRecords.push({
              id: `receive_${order.id}`,
              date: order.date,
              orderNo: orderNo,
              amount: paymentAmount.toFixed(2),
              paymentMethod: order.paymentMethod || '',
              remark: `收回单支付 - ${orderNo}`,
              type: 'receive_payment',
              status: 'completed',
              source: 'receive_order' // 标记来源为收回单
            });
            
            console.log(`[processBackendStatementData] ✅ 收回单支付已添加: ${orderNo}, 金额: ${paymentAmount}`);
          } else if (paymentAmount > 0 && receiveOrderPayments.has(orderNo)) {
            console.log(`[processBackendStatementData] ⚠️ 收回单支付重复，跳过: ${orderNo}, 金额: ${paymentAmount}`);
          }
        }
      });
      
      // 3. 🔧 增强去重处理 - 按单号和来源去重，防止重复计算
      const uniquePaymentRecords = [];
      const processedOrderNos = new Set();
      const processedAmountDates = new Set();
      
      // 先处理账户明细记录
      allPaymentRecords.filter(record => record.source === 'account').forEach(record => {
        const amountDateKey = `${record.amount}_${record.date}`;
        const orderNo = record.orderNo ? record.orderNo.trim() : '';
        
        // 检查是否为收回单关联的付款记录
        const isReceiveOrderPayment = orderNo && receiveOrderPayments.has(orderNo);
        
        if (!isReceiveOrderPayment) {
          uniquePaymentRecords.push(record);
          if (orderNo !== '') {
            processedOrderNos.add(orderNo);
          }
          processedAmountDates.add(amountDateKey);
          console.log(`[processBackendStatementData] ✅ 账户付款已添加: ${orderNo}, 金额: ${record.amount}`);
        } else {
          console.log(`[processBackendStatementData] ℹ️ 跳过收回单关联付款: ${orderNo}, 金额: ${record.amount}`);
        }
      });
      
      // 再处理收回单记录（已去重）
      allPaymentRecords.filter(record => record.source === 'receive_order').forEach(record => {
        uniquePaymentRecords.push(record);
        const orderNo = record.orderNo ? record.orderNo.trim() : '';
        if (orderNo !== '') {
          processedOrderNos.add(orderNo);
        }
        processedAmountDates.add(`${record.amount}_${record.date}`);
      });
      
      // 4. 排序和格式化
      const processedPaymentRecords = uniquePaymentRecords.sort((a, b) => {
        const dateA = new Date(a.date || '1970-01-01');
        const dateB = new Date(b.date || '1970-01-01');
        return dateB - dateA; // 降序排序，最新的在前
      });
      
      // 🔧 关键财务修复：正确计算付款记录总额，确保与后端逻辑一致
      const paymentRecordsTotal = processedPaymentRecords.reduce((sum, record) => {
        const amount = parseFloat(record.amount || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      console.log(`[processBackendStatementData] 💰 前端付款记录汇总: 总计 ${paymentRecordsTotal.toFixed(2)} 元, 记录数: ${processedPaymentRecords.length}`);
      
      // 🔧 严重修复：财务计算必须与后端保持一致，使用后端已计算并验证的数据
      const totalAmountNum = parseFloat(backendData.totalFee || 0);
      const totalAmount = (isNaN(totalAmountNum) ? 0 : totalAmountNum).toFixed(2);
      
      // 🔧 关键修复：使用后端计算的准确支付金额，而不是前端重新计算
      const totalPaymentNum = parseFloat(backendData.paidAmount || 0);
      const totalPayment = (isNaN(totalPaymentNum) ? 0 : totalPaymentNum).toFixed(2);
      
      // 🔧 新增：详细的财务数据验证日志
      console.log(`[财务数据验证] 后端totalFee: ${backendData.totalFee}, 处理后总金额: ${totalAmount}`);
      console.log(`[财务数据验证] 后端paidAmount: ${backendData.paidAmount}, 处理后总支付: ${totalPayment}`);
      
      // 验证前端订单工费累计是否与后端一致
      const frontendTotalFee = receiveOrders.reduce((sum, order) => sum + parseFloat(order.fee || 0), 0);
      console.log(`[财务数据验证] 前端收回单工费累计: ${frontendTotalFee.toFixed(2)}, 后端总金额: ${totalAmount}`);
      if (Math.abs(frontendTotalFee - parseFloat(totalAmount)) > 0.01) {
        console.warn(`[财务数据不一致警告] 前端累计=${frontendTotalFee.toFixed(2)}, 后端总金额=${totalAmount}, 差异=${(frontendTotalFee - parseFloat(totalAmount)).toFixed(2)}`);
      }
      
      // 🔧 严谨计算：结余 = 总金额 - 总支付，遵循标准财务逻辑
      const finalBalance = (parseFloat(totalAmount) - parseFloat(totalPayment)).toFixed(2);
      
      // 🔧 新增：财务数据一致性验证
      const frontendPaymentTotal = paymentRecordsTotal.toFixed(2);
      const backendPaymentTotal = totalPayment;
      
      if (Math.abs(parseFloat(frontendPaymentTotal) - parseFloat(backendPaymentTotal)) > 0.01) {
        console.warn(`[对账统计警告] 前后端支付金额不一致: 前端=${frontendPaymentTotal}, 后端=${backendPaymentTotal}`);
        // 在生产环境中应该抛出错误或记录审计日志
      }
      
      console.log(`[对账统计] 总金额=${totalAmount}, 总支付=${totalPayment}, 结余=${finalBalance}`);
      console.log(`[对账统计] 前端支付汇总=${frontendPaymentTotal}, 后端支付汇总=${backendPaymentTotal}`);
      
      // 设置处理后的数据
      const statementResult = {
        products: products,
        sendOrders: sendOrders,
        receiveOrders: receiveOrders,
        orders: orders, // 新增：保存原始明细数据用于详细展示
        paymentRecords: processedPaymentRecords, // 新增付款记录
        initialBalance: '0.00',
        finalBalance: finalBalance,
        totalAmount: totalAmount,
        totalPayment: totalPayment, // 使用后端计算的支付金额
        creator: wx.getStorageSync('userName') || '系统',
        createDate: new Date().toISOString().split('T')[0]
      };
      
      console.log('[processBackendStatementData] 处理完成，返回对账单数据:', statementResult);
      return statementResult; // 🔧 关键修复：返回处理后的对账单数据
      
    } catch (error) {
      console.error('处理对账单数据时出错:', error);
      wx.showToast({ title: '数据处理失败', icon: 'none' });
      return null; // 🔧 修复：错误时返回null
    }
  },

  // 渲染对账单到Canvas
  renderToCanvas(currentPage = 1, totalPages = 1, recordsPerPage = 20) {
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
          
          const dpr = wx.getWindowInfo().pixelRatio;
          
          // 🔧 画布尺寸调整：从A4纸张比例调整为标准手机屏幕比例
          // 新尺寸：1080px × 1920px（16:9标准手机竖屏比例）
          const canvasWidth = 1080;  // 手机屏幕适配宽度
          const canvasHeight = 1920; // 手机屏幕适配高度
          
          canvas.width = canvasWidth * dpr;
          canvas.height = canvasHeight * dpr;
          ctx.scale(dpr, dpr);
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          
          this.drawBusinessStatement(ctx, canvasWidth, canvasHeight, currentPage, totalPages, recordsPerPage).then(() => {
            resolve(canvas);
          }).catch((error) => {
            console.error('绘制对账单失败:', error);
            reject(error);
          });
        });
    });
  },
  
  // 绘制手机屏幕适配的对账单
  drawBusinessStatement(ctx, canvasWidth, canvasHeight, currentPage = 1, totalPages = 1, recordsPerPage = 20) {
    return new Promise(async (resolve, reject) => {
      const { statement, selectedFactory } = this.data;
      // 🔧 手机屏幕适配的边距：左右边距适当缩小以充分利用空间
      const margin = 40;     // 左右边距从50px调整为40px
      const topMargin = 50;  // 顶部边距从60px调整为50px
      const bottomMargin = 70; // 底部边距从80px调整为70px
      let y = topMargin;
      
      try {
        // 1. 绘制紧凑标题区域（包含分页信息）
        y = this.drawCompactHeader(ctx, canvasWidth, y, margin, currentPage, totalPages);
        y += 15;
        
        if (currentPage === 1) {
          // 只在第一页显示摘要和结算明细
          // 2. 绘制期初期末欠款信息
          y = this.drawDebtInfo(ctx, canvasWidth, y, margin);
          y += 20;
          
          // 3. 绘制紧凑对账摘要
          y = this.drawCompactSummary(ctx, canvasWidth, y, margin);
          y += 20;
          
          // 4. 绘制紧凑的结算支付明细
          y = this.drawCompactPaymentDetails(ctx, canvasWidth, y, margin);
          y += 20;
        }
        
        // 5. 绘制优化的货品汇总（包含图片）- 移动到收发明细表上方
        if (currentPage === 1) {
          y = await this.drawOptimizedProductSummary(ctx, canvasWidth, y, margin);
          y += 20;
        }
        
        // 6. 绘制紧凑的收发明细表格（分页）
        y = this.drawCompactOrderTable(ctx, canvasWidth, y, margin, canvasHeight, currentPage, totalPages, recordsPerPage);
        
        // 7. 绘制A4格式页脚
        this.drawA4Footer(ctx, canvasWidth, canvasHeight, margin, bottomMargin, currentPage, totalPages);
        
        resolve();
      } catch (error) {
        console.error('绘制紧凑对账单失败:', error);
        reject(error);
      }
    });
  },

  // 绘制手机屏幕适配格式标题
  drawCompactHeader(ctx, canvasWidth, y, margin, currentPage = 1, totalPages = 1) {
    const { selectedFactory } = this.data;
    
    // 🔧 手机屏幕适配的字体大小
    const titleFontSize = 30; // 主标题字体从32px调整为30px
    const infoFontSize = 15;  // 信息字体从16px调整为15px
    
    // 绘制主标题 - 使用公司名称
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold ${titleFontSize}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    
    // 获取公司名称
    const companyName = wx.getStorageSync('companyName') || '公司';
    const baseTitle = `${companyName}收发对账单`;
    const mainTitle = totalPages > 1 ? `${baseTitle} (第${currentPage}/${totalPages}页)` : baseTitle;
    ctx.fillText(mainTitle, canvasWidth / 2, y + titleFontSize + 5);
    
    y += titleFontSize + 15;
    
    // 绘制分割线
    ctx.strokeStyle = '#007aff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin + canvasWidth * 0.15, y);
    ctx.lineTo(canvasWidth - margin - canvasWidth * 0.15, y);
    ctx.stroke();
    
    y += 15;
    
    // 绘制基本信息 - 自适应布局
    ctx.fillStyle = '#333333';
    ctx.font = `${infoFontSize}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'left';
    
    const infoY = y + 15;
    const factoryName = selectedFactory ? selectedFactory.name : '';
    const dateRange = `${this.data.startDate} 至 ${this.data.endDate}`;
    
    // 🔧 手机屏幕三列布局，调整工厂名称字体，移除右上角生成时间
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 26px "Microsoft YaHei", sans-serif'; // 从28px调整为26px
    ctx.textAlign = 'left';
    ctx.fillText(`工厂：${factoryName}`, margin, infoY + 10); // 向下偏移10像素更突出
    ctx.restore();
    ctx.font = `${infoFontSize}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(`统计期间：${dateRange}`, margin + canvasWidth * 0.35, infoY);
    
    return y + 30;
  },

  // 绘制期初期末欠款信息
  drawDebtInfo(ctx, canvasWidth, y, margin) {
    const { statement } = this.data;
    
    // 期初期末欠款标题
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('账款信息', margin, y + 24);
    
    y += 35;
    
    // 获取期初期末欠款数据
    const initialBalance = parseFloat(statement.initialBalance || '0.00');
    const finalBalance = parseFloat(statement.finalBalance || '0.00');
    
    // 绘制期初期末欠款信息卡片
    const cardWidth = (canvasWidth - 2 * margin - 20) / 2;
    const cardHeight = 80; // A4适配高度
    
    const debtData = [
      { 
        title: '期初欠款', 
        value: `¥${initialBalance.toFixed(2)}`, 
        color: initialBalance > 0 ? '#ff3b30' : '#34c759',
        bgColor: initialBalance > 0 ? '#fff5f5' : '#f0f9f0'
      },
      { 
        title: '期末欠款', 
        value: `¥${finalBalance.toFixed(2)}`, 
        color: finalBalance > 0 ? '#ff3b30' : '#34c759',
        bgColor: finalBalance > 0 ? '#fff5f5' : '#f0f9f0'
      }
    ];
    
    debtData.forEach((item, index) => {
      const cardX = margin + index * (cardWidth + 20);
      
      // 卡片背景
      ctx.fillStyle = item.bgColor;
      ctx.fillRect(cardX, y, cardWidth, cardHeight);
      
      // 卡片边框
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(cardX, y, cardWidth, cardHeight);
      
      // 卡片标题
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.title, cardX + cardWidth / 2, y + 28);
      
      // 金额数值
      ctx.fillStyle = item.color;
      ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
      ctx.fillText(item.value, cardX + cardWidth / 2, y + 58);
    });
    
    return y + cardHeight + 15;
  },

  // 绘制紧凑摘要
  drawCompactSummary(ctx, canvasWidth, y, margin) {
    const { statement } = this.data;
    
    // 摘要标题
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 22px "Microsoft YaHei", sans-serif'; // 从24px调整为22px
    ctx.textAlign = 'left';
    ctx.fillText('对账摘要', margin, y + 22); // 从24调整为22
    
    y += 28; // 从30调整为28
    
    // 计算统计数据
    const sendOrderCount = statement.sendOrders ? statement.sendOrders.length : 0;
    const receiveOrderCount = statement.receiveOrders ? statement.receiveOrders.length : 0;
    
    let sendQty = 0, sendWeight = 0, receiveQty = 0, receiveWeight = 0;
    
    if (statement.sendOrders) {
      statement.sendOrders.forEach(order => {
        sendQty += parseInt(order.quantity || 0);
        sendWeight += parseFloat(order.weight || 0);
      });
    }
    
    if (statement.receiveOrders) {
      statement.receiveOrders.forEach(order => {
        receiveQty += parseInt(order.quantity || 0);
        receiveWeight += parseFloat(order.weight || 0);
      });
    }
    
    const lossWeight = (sendWeight - receiveWeight).toFixed(2);
    const lossRate = sendWeight > 0 ? ((sendWeight - receiveWeight) / sendWeight * 100).toFixed(2) : '0.00';
    
    // 🔧 绘制手机屏幕适配摘要卡片
    const cardWidth = (canvasWidth - 2 * margin - 30) / 4;
    const cardHeight = 85; // 从90调整为85
    
    const summaryData = [
      { title: '发出单', value: `${sendOrderCount}单`, detail: `${sendQty}打/${sendWeight.toFixed(2)}kg`, color: '#007aff' },
      { title: '收回单', value: `${receiveOrderCount}单`, detail: `${receiveQty}打/${receiveWeight.toFixed(2)}kg`, color: '#ff9500' },
      { title: '损耗分析', value: `${lossWeight}kg`, detail: `损耗率${lossRate}%`, color: '#ff3b30' },
      { title: '财务状况', value: `¥${statement.totalAmount || '0.00'}`, detail: `已付¥${statement.totalPayment || '0.00'} 结余¥${statement.finalBalance || '0.00'}`, color: '#34c759' }
    ];
    
    summaryData.forEach((item, index) => {
      const cardX = margin + index * (cardWidth + 8);
      
      // 卡片背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cardX, y, cardWidth, cardHeight);
      
      // 卡片边框 - 更细
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cardX, y, cardWidth, cardHeight);
      
      // 卡片标题
      ctx.fillStyle = item.color;
      ctx.font = 'bold 15px "Microsoft YaHei", sans-serif'; // 从16px调整为15px
      ctx.textAlign = 'center';
      ctx.fillText(item.title, cardX + cardWidth / 2, y + 20); // 从22调整为20
      
      // 主要数值
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 17px "Microsoft YaHei", sans-serif'; // 从18px调整为17px
      ctx.fillText(item.value, cardX + cardWidth / 2, y + 42); // 从46调整为42
      
      // 详细信息
      ctx.fillStyle = '#666666';
      ctx.font = '13px "Microsoft YaHei", sans-serif'; // 从14px调整为13px
      ctx.fillText(item.detail, cardX + cardWidth / 2, y + 62); // 从68调整为62
    });
    
    return y + cardHeight + 15;
  },

  // 绘制优化的货品汇总
  drawOptimizedProductSummary(ctx, canvasWidth, y, margin) {
    const { statement } = this.data;
    const products = statement.products || [];
    

    
    if (products.length === 0) {
      // 绘制标题
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('货品汇总', margin, y + 16);
      
      y += 40;
      
      // 绘制空状态提示
      ctx.fillStyle = '#999999';
      ctx.font = '14px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无货品数据', canvasWidth / 2, y + 20);
      
      return y + 40;
    }
    
    // 🔧 手机屏幕适配的字体大小
    const titleFontSize = 22; // 从24px调整为22px
    const headerFontSize = 15; // 从16px调整为15px
    const cellFontSize = 13;   // 从14px调整为13px
    
    // 标题
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold ${titleFontSize}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('货品汇总', margin, y + titleFontSize);
    
    y += titleFontSize + 15;
    
    // 🔧 绘制手机屏幕适配表格
    const tableWidth = canvasWidth - 2 * margin;
    const headerHeight = 38; // 从40调整为38
    const rowHeight = 65;    // 从70调整为65
    const totalHeight = headerHeight + products.length * rowHeight;
    
    // 表格边框
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, y, tableWidth, totalHeight);
    
    // 表头背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(margin, y, tableWidth, headerHeight);
    
    // 表头文字
    ctx.fillStyle = '#333333';
    ctx.font = `bold ${headerFontSize}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    
    // 🔧 手机屏幕适配的列宽分配
    const colWidths = [
      110,  // 图片列 从120调整为110
      145,  // 货号列 从150调整为145
      170,  // 名称列 从180调整为170
      110,  // 工序列 从120调整为110
      170,  // 发出统计列 从180调整为170
      170,  // 收回统计列 从180调整为170
      115   // 损耗率列 从120调整为115
    ];
    const headers = ['图片', '货号', '名称', '工序', '发出(数量/kg)', '收回(数量/kg)', '损耗率'];
    
    let x = margin;
    headers.forEach((header, i) => {
      ctx.fillText(header, x + colWidths[i] / 2, y + headerHeight / 2 + 4);
      // 绘制列分隔线
      if (i < headers.length - 1) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(x + colWidths[i], y);
        ctx.lineTo(x + colWidths[i], y + totalHeight);
        ctx.stroke();
      }
      x += colWidths[i];
    });
    
    y += headerHeight;
    
    // 预加载所有图片
    return new Promise((resolve) => {
      let loadedCount = 0;
      const totalProducts = products.length;
      
      // 处理每个产品的图片加载
      products.forEach((product, index) => {
        const rowY = y + index * rowHeight;
        
        // 交替行背景
        if (index % 2 === 1) {
          ctx.fillStyle = '#fafbfc';
          ctx.fillRect(margin, rowY, tableWidth, rowHeight);
        }
        
        // 行分隔线
        ctx.strokeStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(margin, rowY);
        ctx.lineTo(margin + tableWidth, rowY);
        ctx.stroke();
        
        let x = margin;
        
        // 🔧 1. 图片列 - 手机屏幕适配尺寸
        const imageWidth = 65;  // 从70调整为65
        const imageHeight = 45; // 从50调整为45
        const imageX = x + 22;  // 调整居中位置
        const imageY = rowY + 10;
        
        // 绘制图片背景框
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(imageX, imageY, imageWidth, imageHeight);
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.strokeRect(imageX, imageY, imageWidth, imageHeight);
        
        // 加载并绘制图片
        try {
          // 获取canvas实例
          const query = wx.createSelectorQuery();
          query.select('#statementCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
              if (!res[0] || !res[0].node) {
                handleImageError();
                return;
              }
              
              const canvas = res[0].node;
              const img = canvas.createImage();
              
              img.onload = () => {
                // 计算等比缩放参数
                const imgRatio = img.width / img.height;
                const containerRatio = imageWidth / imageHeight;
                
                let drawWidth = imageWidth;
                let drawHeight = imageHeight;
                let drawX = imageX;
                let drawY = imageY;
                
                if (imgRatio > containerRatio) {
                  // 图片更宽，以宽度为准
                  drawHeight = imageWidth / imgRatio;
                  drawY = imageY + (imageHeight - drawHeight) / 2;
                } else {
                  // 图片更高，以高度为准
                  drawWidth = imageHeight * imgRatio;
                  drawX = imageX + (imageWidth - drawWidth) / 2;
                }
                
                // 清除背景并绘制图片
                ctx.save();
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(imageX, imageY, imageWidth, imageHeight);
                
                // 创建圆角裁剪路径
                ctx.beginPath();
                const radius = 4;
                ctx.moveTo(imageX + radius, imageY);
                ctx.lineTo(imageX + imageWidth - radius, imageY);
                ctx.quadraticCurveTo(imageX + imageWidth, imageY, imageX + imageWidth, imageY + radius);
                ctx.lineTo(imageX + imageWidth, imageY + imageHeight - radius);
                ctx.quadraticCurveTo(imageX + imageWidth, imageY + imageHeight, imageX + imageWidth - radius, imageY + imageHeight);
                ctx.lineTo(imageX + radius, imageY + imageHeight);
                ctx.quadraticCurveTo(imageX, imageY + imageHeight, imageX, imageY + imageHeight - radius);
                ctx.lineTo(imageX, imageY + radius);
                ctx.quadraticCurveTo(imageX, imageY, imageX + radius, imageY);
                ctx.closePath();
                ctx.clip();
                
                // 绘制图片
                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                
                // 恢复上下文
                ctx.restore();
                
                // 绘制边框
                ctx.strokeStyle = '#e0e0e0';
                ctx.lineWidth = 1;
                ctx.strokeRect(imageX, imageY, imageWidth, imageHeight);
                
                loadedCount++;
                if (loadedCount === totalProducts) {
                  resolve(y + totalProducts * rowHeight + 15);
                }
              };
              
              img.onerror = (error) => {
                handleImageError();
              };
              
              const imageUrl = product.imageUrl || product.image || '';
              if (imageUrl && !imageUrl.includes('default-product')) {
                // 🔧 优化：避免重复处理已经是完整URL的图片路径
                let finalImageUrl = imageUrl;
                if (!imageUrl.startsWith('http')) {
                  finalImageUrl = imageUtil.getFullImageUrl(imageUrl);
                }
                console.log(`[Canvas图片加载] 产品:${product.productNo}, 最终URL:${finalImageUrl}`);
                img.src = finalImageUrl;
              } else {
                console.log(`[Canvas图片跳过] 产品:${product.productNo}, 原因:${!imageUrl ? '无图片URL' : '包含default-product'}`);
                handleImageError();
              }
            });
        } catch (error) {
          handleImageError();
        }
        
        function handleImageError() {
          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(imageX, imageY, imageWidth, imageHeight);
          ctx.fillStyle = '#999999';
          ctx.font = '12px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('无图', imageX + imageWidth / 2, imageY + imageHeight / 2 + 4);
          
          loadedCount++;
          if (loadedCount === totalProducts) {
            resolve(y + totalProducts * rowHeight + 15);
          }
        }
        
        x += colWidths[0];
        
        // 2. 货号
        ctx.fillStyle = '#333333';
        ctx.font = `${cellFontSize}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        const productNo = product.productNo || product.styleNo || '';
        ctx.fillText(productNo, x + colWidths[1] / 2, rowY + rowHeight / 2 + 5);
        x += colWidths[1];
        
        // 3. 名称
        const productName = product.name || product.productName || '';
        if (productName.length > 8) {
          ctx.fillText(productName.substring(0, 8) + '...', x + colWidths[2] / 2, rowY + rowHeight / 2 + 5);
        } else {
          ctx.fillText(productName, x + colWidths[2] / 2, rowY + rowHeight / 2 + 5);
        }
        x += colWidths[2];
        
        // 4. 工序
        const process = product.process || '';
        ctx.fillText(process, x + colWidths[3] / 2, rowY + rowHeight / 2 + 5);
        x += colWidths[3];
        
        // 5. 发出统计
        ctx.fillStyle = '#007aff';
        const sendStats = `${product.sendQuantity || 0}打/${product.sendWeight || '0.0'}kg`;
        ctx.fillText(sendStats, x + colWidths[4] / 2, rowY + rowHeight / 2 + 5);
        x += colWidths[4];
        
        // 6. 收回统计
        ctx.fillStyle = '#ff9500';
        const receiveStats = `${product.receiveQuantity || 0}打/${product.receiveWeight || '0.0'}kg`;
        ctx.fillText(receiveStats, x + colWidths[5] / 2, rowY + rowHeight / 2 + 5);
        x += colWidths[5];
        
        // 7. 损耗率
        const lossRate = parseFloat(product.lossRate || 0);
        if (lossRate > 5) {
          ctx.fillStyle = '#ff3b30';
        } else if (lossRate > 2) {
          ctx.fillStyle = '#ff9500';
        } else {
          ctx.fillStyle = '#34c759';
        }
        ctx.fillText(`${product.lossRate || '0.00'}%`, x + colWidths[6] / 2, rowY + rowHeight / 2 + 5);
      });
    });
  },

  // 绘制商务风格页脚
  drawBusinessFooter(ctx, canvasWidth, canvasHeight, margin) {
    const footerY = canvasHeight - 40;
    
    // 分割线
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, footerY - 20);
    ctx.lineTo(canvasWidth - margin, footerY - 20);
    ctx.stroke();
    
    // 页脚信息
    ctx.fillStyle = '#999999';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('云收发管理系统', margin, footerY);
    
    ctx.textAlign = 'right';
    ctx.fillText(`生成时间：${new Date().toLocaleString()}`, canvasWidth - margin, footerY);
    
    ctx.textAlign = 'center';
    ctx.fillText('本对账单由系统自动生成，如有疑问请联系相关负责人', canvasWidth / 2, footerY + 25);
  },

  // 导出为图片
  exportAsImage() {
    const { statement, selectedFactory } = this.data;
    
    if (!statement) {
      wx.showToast({ title: '请先生成对账单', icon: 'none' });
      return;
    }
    
    if (!selectedFactory) {
      wx.showToast({ title: '请选择工厂', icon: 'none' });
      return;
    }
    
    // 计算总订单数量
    const sendOrders = statement.sendOrders || [];
    const receiveOrders = statement.receiveOrders || [];
    const totalOrders = sendOrders.length + receiveOrders.length;
    
    if (totalOrders === 0) {
      wx.showToast({ title: '暂无收发数据可导出', icon: 'none' });
      return;
    }
    
    // 计算需要的页数（每页最多显示20条记录）
    const recordsPerPage = 20;
    const totalPages = Math.ceil(totalOrders / recordsPerPage);
    
    // 默认导出全部页面，直接进入分享
    if (totalPages === 1) {
      // 单页导出并直接分享
      this.exportSinglePageAndShare();
    } else {
      // 多页导出并直接分享
      this.exportAllPagesAndShare(totalPages, recordsPerPage);
    }
  },

  // 导出单页并直接分享
  exportSinglePageAndShare() {
    wx.showLoading({ title: '正在生成图片...' });
    
    this.renderToCanvas(1, 1)
      .then(canvas => {
        return new Promise((resolve, reject) => {
          wx.canvasToTempFilePath({
            canvas: canvas,
            success: resolve,
            fail: reject
          });
        });
      })
      .then(res => {
        wx.hideLoading();
        // 直接进入微信分享
        wx.showShareImageMenu({
          path: res.tempFilePath,
          success: () => {
            console.log('分享成功');
          },
          fail: (err) => {
            console.error('分享失败:', err);
            // 如果分享失败，提供备选方案：保存到相册
            wx.showModal({
              title: '分享失败',
              content: '是否保存图片到相册？',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  this.saveImageToAlbum(res.tempFilePath);
                }
              }
            });
          }
        });
      })
      .catch(error => {
        wx.hideLoading();
        console.error('导出图片失败:', error);
        wx.showToast({ title: '导出失败，请重试', icon: 'none' });
      });
  },

  // 导出全部页面并直接分享
  exportAllPagesAndShare(totalPages, recordsPerPage) {
    wx.showLoading({ title: `正在生成第1页...` });
    
    // 先生成第一页并直接分享
    this.renderToCanvas(1, totalPages, recordsPerPage)
      .then(canvas => {
        return new Promise((resolve, reject) => {
          wx.canvasToTempFilePath({
            canvas: canvas,
            success: (res) => resolve(res.tempFilePath),
            fail: reject
          });
        });
      })
      .then(firstPagePath => {
        wx.hideLoading();
        
        // 直接分享第一页
        wx.showShareImageMenu({
          path: firstPagePath,
          success: () => {
            console.log('第1页分享成功');
            
            // 如果有多页，询问是否继续分享其他页面
            if (totalPages > 1) {
              wx.showModal({
                title: '分享成功',
                content: `第1页已分享完成。\n\n还有${totalPages - 1}页，是否继续分享？`,
                cancelText: '完成',
                confirmText: '继续分享',
                success: (res) => {
                  if (res.confirm) {
                    this.generateAndShareRemainingPages(totalPages, recordsPerPage);
                  }
                }
              });
            }
          },
          fail: (err) => {
            console.error('第1页分享失败:', err);
            // 如果分享失败，提供备选方案
            wx.showModal({
              title: '分享失败',
              content: `第1页分享失败，是否保存到相册？\n\n共${totalPages}页对账单`,
              cancelText: '取消',
              confirmText: '保存到相册',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  this.generateAndSaveAllPages(totalPages, recordsPerPage);
                }
              }
            });
          }
        });
      })
      .catch(error => {
        wx.hideLoading();
        console.error('生成第1页失败:', error);
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      });
  },

  // 生成并分享剩余页面
  generateAndShareRemainingPages(totalPages, recordsPerPage) {
    wx.showLoading({ title: '正在生成剩余页面...' });
    
    const exportPromises = [];
    
    // 生成第2页到最后一页
    for (let page = 2; page <= totalPages; page++) {
      const promise = this.renderToCanvas(page, totalPages, recordsPerPage)
        .then(canvas => {
          return new Promise((resolve, reject) => {
            wx.canvasToTempFilePath({
              canvas: canvas,
              success: (res) => resolve({ page, path: res.tempFilePath }),
              fail: reject
            });
          });
        });
      exportPromises.push(promise);
    }
    
    Promise.all(exportPromises)
      .then(results => {
        wx.hideLoading();
        
        // 开始逐页分享剩余页面
        this.shareRemainingPages(results, 0);
      })
      .catch(error => {
        wx.hideLoading();
        console.error('生成剩余页面失败:', error);
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      });
  },

  // 逐页分享剩余页面
  shareRemainingPages(results, currentIndex) {
    if (currentIndex >= results.length) {
      wx.showToast({ title: '所有页面已分享完成', icon: 'success' });
      return;
    }
    
    const current = results[currentIndex];
    wx.showShareImageMenu({
      path: current.path,
      success: () => {
        const nextIndex = currentIndex + 1;
        if (nextIndex < results.length) {
          wx.showModal({
            title: `第${current.page}页分享完成`,
            content: `继续分享第${results[nextIndex].page}页？`,
            cancelText: '完成',
            confirmText: '继续',
            success: (res) => {
              if (res.confirm) {
                this.shareRemainingPages(results, nextIndex);
              } else {
                wx.showToast({ title: '分享已完成', icon: 'success' });
              }
            }
          });
        } else {
          wx.showToast({ title: '所有页面已分享完成', icon: 'success' });
        }
      },
      fail: (err) => {
        console.error(`第${current.page}页分享失败:`, err);
        wx.showModal({
          title: '分享失败',
          content: `第${current.page}页分享失败，是否继续下一页？`,
          cancelText: '停止',
          confirmText: '继续',
          success: (res) => {
            if (res.confirm) {
              this.shareRemainingPages(results, currentIndex + 1);
            }
          }
        });
      }
    });
  },

  // 生成并保存所有页面到相册
  generateAndSaveAllPages(totalPages, recordsPerPage) {
    wx.showLoading({ title: `正在生成全部${totalPages}页...` });
    
    const exportPromises = [];
    
    // 生成所有页面
    for (let page = 1; page <= totalPages; page++) {
      const promise = this.renderToCanvas(page, totalPages, recordsPerPage)
        .then(canvas => {
          return new Promise((resolve, reject) => {
            wx.canvasToTempFilePath({
              canvas: canvas,
              success: (res) => resolve({ page, path: res.tempFilePath }),
              fail: reject
            });
          });
        });
      exportPromises.push(promise);
    }
    
    Promise.all(exportPromises)
      .then(results => {
        wx.hideLoading();
        this.saveMultipleImages(results);
      })
      .catch(error => {
        wx.hideLoading();
        console.error('生成全部页面失败:', error);
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      });
  },

  // 保存多张图片到相册
  saveMultipleImages(results) {
    let savedCount = 0;
    let failedCount = 0;
    
    const savePromises = results.map(result => {
      return new Promise((resolve) => {
        wx.saveImageToPhotosAlbum({
          filePath: result.path,
          success: () => {
            savedCount++;
            resolve();
          },
          fail: (err) => {
            failedCount++;
            console.error(`第${result.page}页保存失败:`, err);
            resolve();
          }
        });
      });
    });
    
    Promise.all(savePromises).then(() => {
      if (failedCount === 0) {
        wx.showToast({ title: `已保存${savedCount}页到相册`, icon: 'success' });
      } else {
        wx.showModal({
          title: '保存完成',
          content: `成功保存${savedCount}页，失败${failedCount}页`,
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  // 保存图片到相册（备选方案）
  saveImageToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: () => {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      },
      fail: (err) => {
        if (err.errMsg.includes('cancel')) {
          // 用户取消保存，不显示错误提示
          console.log('用户取消保存图片到相册');
          return;
        }
        
        if (err.errMsg.includes('auth')) {
          wx.showModal({
            title: '需要授权',
            content: '需要您授权保存图片到相册',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({
                  success: (settingRes) => {
                    if (settingRes.authSetting['scope.writePhotosAlbum']) {
                      wx.saveImageToPhotosAlbum({
                        filePath: filePath,
                        success: () => {
                          wx.showToast({ title: '已保存到相册', icon: 'success' });
                        },
                        fail: (saveErr) => {
                          if (!saveErr.errMsg.includes('cancel')) {
                            console.error('保存图片失败:', saveErr);
                            wx.showToast({ title: '保存失败', icon: 'none' });
                          }
                        }
                      });
                    }
                  }
                });
              }
            }
          });
        } else {
          console.error('保存图片失败:', err);
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },

  // 导出为Excel
  exportAsExcel() {
    const { statement, selectedFactory } = this.data;
    
    if (!statement) {
      wx.showToast({ title: '请先生成对账单', icon: 'none' });
      return;
    }

    // 直接显示正在分享的提示
    wx.showLoading({ title: '正在准备分享...' });

    try {
      // 生成Excel数据
      const excelData = this.generateExcelData(statement, selectedFactory);
      
      // 通过云优先请求封装调用后端生成Excel（支持二进制）
      const request = require('../../utils/request');
      request.post('/export/excel', excelData)
        .then((res) => {
          // 二进制直传（云函数代理已内嵌下载返回base64）
          if (res && res.filePath) {
            wx.hideLoading();
            this.shareExcelFileDirectly(res.filePath);
            return;
          }

          // 兼容老返回：包含下载URL
          if (res && res.success && res.data && res.data.downloadUrl) {
            const downloadUrl = res.data.downloadUrl;
            wx.downloadFile({
              url: downloadUrl,
              header: {
                'X-App-Authorization': `Bearer ${wx.getStorageSync('token')}` // 使用自定义头避免被 CloudBase 网关拦截
              },
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

          // 其他成功返回格式（尽量容错）
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
    } catch (error) {
      wx.hideLoading();
      console.error('生成Excel数据失败:', error);
      wx.showToast({ title: '数据处理失败，请重试', icon: 'none' });
    }
  },

  // 直接分享Excel文件
  shareExcelFileDirectly(filePath) {
    const fileName = this.generateExcelFileName();
    
    // 直接调用微信分享，没有中间提示
    wx.shareFileMessage({
      filePath: filePath,
      fileName: fileName,
      success: () => {
        wx.showToast({ 
          title: '表格分享成功', 
          icon: 'success',
          duration: 2000
        });
      },
      fail: (shareErr) => {
        console.log('微信分享失败，提供备选方案:', shareErr);
        
        // 分享失败时的备选方案
        wx.showModal({
          title: '分享方式选择',
          content: '微信分享失败，请选择其他方式：',
          cancelText: '打开表格',
          confirmText: '保存到本地',
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 用户选择保存到本地（实际上是打开文档）
              this.openExcelDocument(filePath);
            } else {
              // 用户选择打开表格查看
              this.openExcelDocument(filePath);
            }
          },
          fail: () => {
            // 模态框也失败了，直接尝试打开文档
            this.openExcelDocument(filePath);
          }
        });
      }
    });
  },

  // 打开Excel文档
  openExcelDocument(filePath) {
    wx.openDocument({
      filePath: filePath,
      fileType: 'xlsx',
      success: () => {
        wx.showToast({ 
          title: '表格已打开', 
          icon: 'success',
          duration: 2000
        });
      },
      fail: (openErr) => {
        console.log('打开文档失败:', openErr);
        wx.showToast({ 
          title: '表格已生成，请在文件管理中查看', 
          icon: 'success',
          duration: 3000
        });
      }
    });
  },

  // 生成Excel数据结构
  generateExcelData(statement, selectedFactory) {
    const sendOrders = statement.sendOrders || [];
    const receiveOrders = statement.receiveOrders || [];
    const paymentRecords = statement.paymentRecords || [];
    
    // 计算统计数据
    const sendOrderCount = sendOrders.length;
    const receiveOrderCount = receiveOrders.length;
    let sendQty = 0, sendWeight = 0, receiveQty = 0, receiveWeight = 0;
    
    sendOrders.forEach(order => {
      sendQty += parseInt(order.quantity || 0);
      sendWeight += parseFloat(order.weight || 0);
    });
    
    receiveOrders.forEach(order => {
      receiveQty += parseInt(order.quantity || 0);
      receiveWeight += parseFloat(order.weight || 0);
    });
    
    const lossWeight = (sendWeight - receiveWeight).toFixed(2);
    const lossRate = sendWeight > 0 ? ((sendWeight - receiveWeight) / sendWeight * 100).toFixed(2) : '0.00';
    
    // 合并并排序所有订单
    const allOrders = [
      ...sendOrders.map(order => ({ ...order, type: 'send' })),
      ...receiveOrders.map(order => ({ ...order, type: 'receive' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const excelData = {
      // 基本信息
      basicInfo: {
        companyName: wx.getStorageSync('companyName') || '公司',
        factoryName: selectedFactory ? selectedFactory.name : '',
        dateRange: `${this.data.startDate} 至 ${this.data.endDate}`,
        generateTime: new Date().toLocaleString(),
        totalRecords: allOrders.length
      },
      
      // 对账摘要数据
      summary: {
        sendSummary: {
          title: '发出单摘要',
          orderCount: sendOrderCount,
          quantity: sendQty,
          weight: sendWeight.toFixed(2)
        },
        receiveSummary: {
          title: '收回单摘要',
          orderCount: receiveOrderCount,
          quantity: receiveQty,
          weight: receiveWeight.toFixed(2)
        },
        lossSummary: {
          title: '损耗分析',
          lossWeight: lossWeight,
          lossRate: lossRate + '%',
          productTypes: (statement.products || []).length
        },
        financialSummary: {
          title: '财务状况',
          totalAmount: parseFloat(statement.totalAmount || '0.00').toFixed(2),
          totalPayment: parseFloat(statement.totalPayment || '0.00').toFixed(2),
          finalBalance: parseFloat(statement.finalBalance || '0.00').toFixed(2)
        }
      },
      
      // 货品汇总数据
      productSummary: (statement.products || []).map(product => ({
        productNo: product.productNo || '',
        name: product.name || '',
        process: product.process || '',
        sendQuantity: product.sendQuantity || 0,
        sendWeight: product.sendWeight || '0.00',
        receiveQuantity: product.receiveQuantity || 0,
        receiveWeight: product.receiveWeight || '0.00',
        lossRate: product.lossRate || '0.00'
      })),
      
      // 结算支付明细
      paymentSummary: {
        totalAmount: parseFloat(statement.totalAmount || '0.00').toFixed(2),
        totalPayment: parseFloat(statement.totalPayment || '0.00').toFixed(2),
        finalBalance: parseFloat(statement.finalBalance || '0.00').toFixed(2)
      },
      
      // 付款记录明细 - 修复支付方式字段
      paymentRecords: paymentRecords.map(record => ({
        date: record.date || '',
        amount: parseFloat(record.amount || '0.00').toFixed(2),
        method: this.getPaymentMethodDisplayText(record.paymentMethod), // 使用正确的支付方式字段
        source: record.source === 'account' ? '工厂账户' : '收回单支付',
        remark: record.remark || ''
      })),
      
      // 收发明细数据 - 按货号分组显示
      orderDetails: this.generateGroupedOrderDetails(statement)
    };
    
    return excelData;
  },

  // 生成按货号分组的Excel明细数据
  generateGroupedOrderDetails(statement) {
    const sendOrders = statement.sendOrders || [];
    const receiveOrders = statement.receiveOrders || [];
    
    // 按货号+工序分组
    const groups = new Map();
    
    // 处理发出单
    sendOrders.forEach(order => {
      const key = `${order.productNo || ''}_${order.process || ''}`;
      if (!groups.has(key)) {
        groups.set(key, {
          productNo: order.productNo || '',
          productName: order.productName || '',
          process: order.process || '',
          sendOrders: [],
          receiveOrders: []
        });
      }
      groups.get(key).sendOrders.push(order);
    });
    
    // 处理收回单
    receiveOrders.forEach(order => {
      const key = `${order.productNo || ''}_${order.process || ''}`;
      if (!groups.has(key)) {
        groups.set(key, {
          productNo: order.productNo || '',
          productName: order.productName || '',
          process: order.process || '',
          sendOrders: [],
          receiveOrders: []
        });
      }
      groups.get(key).receiveOrders.push(order);
    });
    
    const groupedDetails = [];
    
    // 为每个分组生成Excel数据
    groups.forEach(group => {
      // 添加分组标题行
      groupedDetails.push({
        isGroupHeader: true,
        groupTitle: `货号: ${group.productNo} ${group.productName} ${group.process}`,
        type: '',
        date: '',
        orderNo: '',
        color: '',
        size: '',
        unitPrice: '',
        quantity: '',
        weight: '',
        fee: ''
      });
      
      // 发出单明细
      group.sendOrders.forEach(order => {
        if (order.details && order.details.length > 0) {
          order.details.forEach(detail => {
            groupedDetails.push({
              isGroupHeader: false,
              groupTitle: '',
              type: '发出',
              date: order.date ? order.date.substring(5, 10) : '',
              orderNo: order.orderNo || '',
              color: detail.itemColor || detail.color || '',
              size: detail.itemSize || detail.size || '',
              unitPrice: '',
              quantity: detail.itemQuantity || detail.quantity || '0',
              weight: detail.itemWeight || detail.weight || '0',
              fee: ''
            });
          });
        } else {
          groupedDetails.push({
            isGroupHeader: false,
            groupTitle: '',
            type: '发出',
            date: order.date ? order.date.substring(5, 10) : '',
            orderNo: order.orderNo || '',
            color: '',
            size: '',
            unitPrice: '',
            quantity: order.quantity || '0',
            weight: order.weight || '0',
            fee: ''
          });
        }
      });
      
      // 收回单明细
      group.receiveOrders.forEach(order => {
        if (order.details && order.details.length > 0) {
          order.details.forEach(detail => {
            groupedDetails.push({
              isGroupHeader: false,
              groupTitle: '',
              type: '收回',
              date: order.date ? order.date.substring(5, 10) : '',
              orderNo: order.orderNo || '',
              color: detail.itemColor || detail.color || '',
              size: detail.itemSize || detail.size || '',
              unitPrice: detail.unitPrice || '0',
              quantity: detail.itemQuantity || detail.quantity || '0',
              weight: detail.itemWeight || detail.weight || '0',
              fee: detail.fee || '0'
            });
          });
        } else {
          groupedDetails.push({
            isGroupHeader: false,
            groupTitle: '',
            type: '收回',
            date: order.date ? order.date.substring(5, 10) : '',
            orderNo: order.orderNo || '',
            color: '',
            size: '',
            unitPrice: order.unitPrice || '0',
            quantity: order.quantity || '0',
            weight: order.weight || '0',
            fee: order.fee || order.totalAmount || '0'
          });
        }
      });
      
      // 添加小计行
      const sendTotalQty = group.sendOrders.reduce((sum, order) => sum + (parseFloat(order.quantity) || 0), 0);
      const sendTotalWeight = group.sendOrders.reduce((sum, order) => sum + (parseFloat(order.weight) || 0), 0);
      const receiveTotalQty = group.receiveOrders.reduce((sum, order) => sum + (parseFloat(order.quantity) || 0), 0);
      const receiveTotalWeight = group.receiveOrders.reduce((sum, order) => sum + (parseFloat(order.weight) || 0), 0);
      const receiveTotalFee = group.receiveOrders.reduce((sum, order) => sum + (parseFloat(order.fee || order.totalAmount) || 0), 0);
      
      groupedDetails.push({
        isSubtotal: true,
        groupTitle: '',
        type: '小计',
        date: '',
        orderNo: '',
        color: '',
        size: '',
        unitPrice: '',
        quantity: `发出:${sendTotalQty} 收回:${receiveTotalQty}`,
        weight: `发出:${sendTotalWeight.toFixed(1)} 收回:${receiveTotalWeight.toFixed(1)}`,
        fee: `工费:${receiveTotalFee.toFixed(0)}`
      });
      
      // 添加空行分隔
      groupedDetails.push({
        isGroupHeader: false,
        groupTitle: '',
        type: '',
        date: '',
        orderNo: '',
        color: '',
        size: '',
        unitPrice: '',
        quantity: '',
        weight: '',
        fee: ''
      });
    });
    
    return groupedDetails;
  },

  // 生成Excel文件名
  generateExcelFileName() {
    const { selectedFactory } = this.data;
    const factoryName = selectedFactory ? selectedFactory.name : '工厂';
    const dateRange = `${this.data.startDate.replace(/-/g, '')}_${this.data.endDate.replace(/-/g, '')}`;
    const timestamp = new Date().getTime().toString().slice(-6); // 取时间戳后6位
    
    return `${factoryName}_对账单_${dateRange}_${timestamp}.xlsx`;
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
  // 切换货号详情的显示/隐藏
  toggleStyleDetail(e) {
    const styleNo = e.currentTarget.dataset.style;
    const { statement } = this.data;
    
    if (statement && statement.styleSummary) {
      // 更新每个货号项的 showDetail 属性
      statement.styleSummary = statement.styleSummary.map(item => {
        if (item.styleNo === styleNo) {
          // 切换当前货号的详情显示状态
          item.showDetail = !item.showDetail;
        }
        return item;
      });
      
      this.setData({ statement });
    }
  },
  
  // 选择工序
  selectProcess(e) {
    const process = e.currentTarget.dataset.process;
    this.setData({
      selectedProcess: this.data.selectedProcess === process ? null : process
    });
  },
  
  // 图片加载失败处理
  handleImageError(e) {
    const index = e.currentTarget.dataset.index;
    
    // 🔧 关键修复：防止statement为null或undefined时的错误
    if (!this.data.statement || !this.data.statement.products) {
      console.warn(`[handleImageError] statement数据不存在或products为空`);
      return;
    }
    
    const product = this.data.statement.products[index];
    
    console.log(`[handleImageError] 图片加载失败，产品索引: ${index}`, product);
    
    // 🔧 关键修复：防止无限重试
    if (!product) {
      console.warn(`[handleImageError] 产品不存在，索引: ${index}`);
      return;
    }
    
    // 如果已经标记为加载失败，直接返回，防止无限重试
    if (product.imageLoadFailed) {
      console.log(`[handleImageError] 图片已标记为加载失败，跳过重试`);
      return;
    }
    
    // 🔧 修复：限制重试次数
    const retryCount = product.imageRetryCount || 0;
    if (retryCount >= 2) {
      console.log(`[handleImageError] 达到最大重试次数(${retryCount})，停止重试`);
      this.setData({
        [`statement.products[${index}].imageLoadFailed`]: true,
        [`statement.products[${index}].imageUrl`]: '' // 清空URL，让WXML显示占位符
      });
      return;
    }
    
    // 增加重试计数
    this.setData({
      [`statement.products[${index}].imageRetryCount`]: retryCount + 1
    });
    
    // 🔧 修复：先尝试原图，但不使用会产生无限循环的默认图片
    if (product.originalImageUrl && 
        product.originalImageUrl !== product.imageUrl && 
        !product.originalImageUrl.includes('default-product') &&
        !product.originalImageUrl.includes('aiyunsf.com/uploads/default-product')) {
      
      console.log(`[handleImageError] 尝试使用原图(重试${retryCount + 1}次): ${product.originalImageUrl}`);
      this.setData({
        [`statement.products[${index}].imageUrl`]: product.originalImageUrl
      });
    } else {
      // 🔧 关键修复：不再尝试default-product.jpg，直接标记为失败
      console.log(`[handleImageError] 所有图片源都失败，标记为加载失败`);
      this.setData({
        [`statement.products[${index}].imageLoadFailed`]: true,
        [`statement.products[${index}].imageUrl`]: '' // 清空URL，显示占位符
      });
    }
  },

  // 绘制紧凑的支付明细
  drawCompactPaymentDetails(ctx, canvasWidth, y, margin) {
    const { statement } = this.data;
    
    // 支付明细标题
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 22px "Microsoft YaHei", sans-serif'; // 从24px调整为22px
    ctx.textAlign = 'left';
    ctx.fillText('结算支付明细', margin, y + 22); // 从24调整为22
    
    y += 33; // 从35调整为33
    
    // 1. 绘制汇总表格 - 手机屏幕适配
    const tableWidth = canvasWidth - 2 * margin;
    const headerHeight = 33; // 从35调整为33
    const rowHeight = 38;    // 从40调整为38
    const summaryTableHeight = headerHeight + rowHeight;
    
    // 汇总表格边框
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, y, tableWidth, summaryTableHeight);
    
    // 汇总表头背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(margin, y, tableWidth, headerHeight);
    
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 17px "Microsoft YaHei", sans-serif'; // 从18px调整为17px
    ctx.textAlign = 'center';
    
    const colWidths = [tableWidth / 3, tableWidth / 3, tableWidth / 3];
    const headers = ['总金额(¥)', '已支付(¥)', '结余(¥)'];
    
    let x = margin;
    headers.forEach((header, i) => {
      ctx.fillText(header, x + colWidths[i] / 2, y + headerHeight / 2 + 4);
      if (i < headers.length - 1) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(x + colWidths[i], y);
        ctx.lineTo(x + colWidths[i], y + summaryTableHeight);
        ctx.stroke();
      }
      x += colWidths[i];
    });
    
    y += headerHeight;
    
    // 绘制汇总数据行背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(margin, y, tableWidth, rowHeight);
    
    // 绘制汇总数据
    const totalAmount = parseFloat(statement.totalAmount || '0.00');
    const totalPayment = parseFloat(statement.totalPayment || '0.00');
    const finalBalance = parseFloat(statement.finalBalance || '0.00');
    
    ctx.font = '19px "Microsoft YaHei", sans-serif'; // 从20px调整为19px
    ctx.textAlign = 'center';
    
    x = margin;
    
    // 总金额
    ctx.fillStyle = '#333333';
    ctx.fillText(totalAmount.toFixed(2), x + colWidths[0] / 2, y + rowHeight / 2 + 4);
    x += colWidths[0];
    
    // 已支付
    ctx.fillStyle = '#34c759';
    ctx.fillText(totalPayment.toFixed(2), x + colWidths[1] / 2, y + rowHeight / 2 + 4);
    x += colWidths[1];
    
    // 结余
    ctx.fillStyle = finalBalance > 0 ? '#ff3b30' : '#34c759';
    ctx.fillText(finalBalance.toFixed(2), x + colWidths[2] / 2, y + rowHeight / 2 + 4);
    
    // 绘制汇总行分隔线
    ctx.strokeStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(margin + tableWidth, y);
    ctx.stroke();
    
    y += rowHeight + 15;
    
    // 2. 绘制付款记录明细
    const paymentRecords = statement.paymentRecords || [];
    
    if (paymentRecords.length > 0) {
      // 付款记录标题
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`付款记录明细 (${paymentRecords.length}笔)`, margin, y + 14);
      
      y += 25;
      
      // 付款记录表格
      const recordHeaderHeight = 22;
      const recordRowHeight = 20;
      const maxRecords = Math.min(paymentRecords.length, 8); // 最多显示8条记录
      const recordTableHeight = recordHeaderHeight + maxRecords * recordRowHeight;
      
      // 付款记录表格边框
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, y, tableWidth, recordTableHeight);
      
      // 付款记录表头
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(margin, y, tableWidth, recordHeaderHeight);
      
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 10px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      
      const recordColWidths = [80, 120, 80, 100, 80, 90];
      const recordHeaders = ['日期', '单号', '金额(¥)', '支付方式', '状态', '来源'];
      
      x = margin;
      recordHeaders.forEach((header, i) => {
        ctx.fillText(header, x + recordColWidths[i] / 2, y + recordHeaderHeight / 2 + 3);
        if (i < recordHeaders.length - 1) {
          ctx.strokeStyle = '#e0e0e0';
          ctx.beginPath();
          ctx.moveTo(x + recordColWidths[i], y);
          ctx.lineTo(x + recordColWidths[i], y + recordTableHeight);
          ctx.stroke();
        }
        x += recordColWidths[i];
      });
      
      y += recordHeaderHeight;
      
      // 绘制付款记录数据
      const displayRecords = paymentRecords.slice(0, maxRecords);
      displayRecords.forEach((record, index) => {
        const recordY = y + index * recordRowHeight;
        
        // 交替行背景
        if (index % 2 === 1) {
          ctx.fillStyle = '#fafbfc';
          ctx.fillRect(margin, recordY, tableWidth, recordRowHeight);
        }
        
        // 行分隔线
        ctx.strokeStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(margin, recordY);
        ctx.lineTo(margin + tableWidth, recordY);
        ctx.stroke();
        
        x = margin;
        ctx.font = '9px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        
        // 日期
        ctx.fillStyle = '#333333';
        const dateStr = record.date ? record.date.substring(5, 10) : '';
        ctx.fillText(dateStr, x + recordColWidths[0] / 2, recordY + recordRowHeight / 2 + 3);
        x += recordColWidths[0];
        
        // 单号
        const orderNo = record.orderNo || '';
        ctx.fillText(orderNo.length > 10 ? orderNo.substring(0, 10) + '...' : orderNo, x + recordColWidths[1] / 2, recordY + recordRowHeight / 2 + 3);
        x += recordColWidths[1];
        
        // 金额
        ctx.fillStyle = '#34c759';
        ctx.fillText(record.amount, x + recordColWidths[2] / 2, recordY + recordRowHeight / 2 + 3);
        x += recordColWidths[2];
        
        // 支付方式
        ctx.fillStyle = '#333333';
        const methodText = this.getPaymentMethodDisplayText(record.paymentMethod);
        ctx.fillText(methodText, x + recordColWidths[3] / 2, recordY + recordRowHeight / 2 + 3);
        x += recordColWidths[3];
        
        // 状态
        ctx.fillStyle = record.status === 'completed' ? '#34c759' : '#ff9500';
        const statusText = record.status === 'completed' ? '已完成' : '处理中';
        ctx.fillText(statusText, x + recordColWidths[4] / 2, recordY + recordRowHeight / 2 + 3);
        x += recordColWidths[4];
        
        // 来源
        ctx.fillStyle = record.source === 'account' ? '#007aff' : '#ff9500';
        const sourceText = record.source === 'account' ? '账户' : '收回单';
        ctx.fillText(sourceText, x + recordColWidths[5] / 2, recordY + recordRowHeight / 2 + 3);
      });
      
      y += maxRecords * recordRowHeight;
      
      // 如果记录数超过显示限制，显示提示
      if (paymentRecords.length > maxRecords) {
        y += 8;
        ctx.fillStyle = '#666666';
        ctx.font = '10px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`还有${paymentRecords.length - maxRecords}条付款记录，请在工厂管理中查看完整记录`, canvasWidth / 2, y + 10);
        y += 15;
      }
    } else {
      // 无付款记录提示
      ctx.fillStyle = '#999999';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('本期间暂无付款记录', canvasWidth / 2, y + 20);
      y += 30;
    }
    
    return y + 8;
  },

  // 获取支付方式显示文本
  getPaymentMethodDisplayText(method) {
    const methodMap = {
      // 英文编码映射
      'cash': '现金',
      'wechat': '微信',
      'alipay': '支付宝', 
      'bank': '银行',
      'unpaid': '未付',
      // 中文直接映射
      '现金': '现金',
      '微信': '微信',
      '微信支付': '微信',
      '支付宝': '支付宝',
      '银行': '银行',
      '银行转账': '银行',
      '未付': '未付',
      '已付': '已付' // 保持真实性：显示原始的"已付"
    };
    
    // 先检查原始值
    if (!method || method.trim() === '') {
      return '未付';
    }
    
    const normalizedMethod = method.trim();
    
    // 如果映射表中有对应值，直接返回
    if (methodMap[normalizedMethod]) {
      return methodMap[normalizedMethod];
    }
    
    // 如果没有找到映射，返回原值（可能是已经是中文的情况）
    return normalizedMethod;
  },

  // 绘制按货号分组的收发明细表格（按图片样式）
  drawCompactOrderTable(ctx, canvasWidth, y, margin, canvasHeight, currentPage = 1, totalPages = 1, recordsPerPage = 20) {
    const { statement } = this.data;
    const sendOrders = statement.sendOrders || [];
    const receiveOrders = statement.receiveOrders || [];
    
    if (sendOrders.length === 0 && receiveOrders.length === 0) {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('收发明细', margin, y + 16);
      y += 40;
      ctx.fillStyle = '#999999';
      ctx.font = '14px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无收发数据', canvasWidth / 2, y + 20);
      return y + 40;
    }
    
    // 按货号分组整理数据
    const productGroups = new Map();
    
    // 处理发出单
    sendOrders.forEach(order => {
      const productKey = `${order.styleNo || order.productNo || 'Unknown'}_${order.process || 'Unknown'}`;
      if (!productGroups.has(productKey)) {
        productGroups.set(productKey, {
          styleNo: order.styleNo || order.productNo || 'Unknown',
          productName: order.productName || '未知货品',
          process: order.process || '未知工序',
          sendOrders: [],
          receiveOrders: []
        });
      }
      productGroups.get(productKey).sendOrders.push(order);
    });
    
    // 处理收回单
    receiveOrders.forEach(order => {
      const productKey = `${order.styleNo || order.productNo || 'Unknown'}_${order.process || 'Unknown'}`;
      if (!productGroups.has(productKey)) {
        productGroups.set(productKey, {
          styleNo: order.styleNo || order.productNo || 'Unknown',
          productName: order.productName || '未知货品',
          process: order.process || '未知工序',
          sendOrders: [],
          receiveOrders: []
        });
      }
      productGroups.get(productKey).receiveOrders.push(order);
    });
    
    // 绘制标题
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    const tableTitle = `收发明细 (按货号分组显示)`;
    ctx.fillText(tableTitle, margin, y + 20); // 从24减少到20
    y += 32; // 从40减少到32，压缩上方空白
    
    const tableWidth = canvasWidth - 2 * margin;
    const headerHeight = 28; // 从25调整为28
    const rowHeight = 26; // 从22调整为26，增加行高
    
    // 遍历每个货号分组
    for (const [productKey, group] of productGroups) {
      // 绘制货号标题行
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(margin, y, tableWidth, headerHeight);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, y, tableWidth, headerHeight);
      
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 15px "Microsoft YaHei", sans-serif'; // 从14px调整为15px
      ctx.textAlign = 'left';
      ctx.fillText(`货号: ${group.styleNo}    ${group.productName}    ${group.process}`, margin + 10, y + headerHeight/2 + 4);
      y += headerHeight;
      
      // 计算发出单明细行数
      let sendDetailCount = 0;
      group.sendOrders.forEach(order => {
        if (order.details && order.details.length > 0) {
          sendDetailCount += order.details.length;
        } else {
          sendDetailCount += 1; // 至少显示一行
        }
      });
      
      // 计算收回单明细行数
      let receiveDetailCount = 0;
      group.receiveOrders.forEach(order => {
        if (order.details && order.details.length > 0) {
          receiveDetailCount += order.details.length;
        } else {
          receiveDetailCount += 1; // 至少显示一行
        }
      });
      
      const maxDetailCount = Math.max(sendDetailCount, receiveDetailCount);
      const totalRowsNeeded = maxDetailCount + 1; // +1 for header
      const sectionHeight = totalRowsNeeded * rowHeight;
      
      // 绘制主表格框架
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, y, tableWidth, sectionHeight);
      
      // 绘制中间分割线（发出单和收回单分开）
      const halfWidth = tableWidth / 2;
      ctx.beginPath();
      ctx.moveTo(margin + halfWidth, y);
      ctx.lineTo(margin + halfWidth, y + sectionHeight);
      ctx.stroke();
      
      // 绘制发出单表头
      ctx.fillStyle = '#e6f3ff';
      ctx.fillRect(margin, y, halfWidth, rowHeight);
      
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('发出单', margin + 5, y + rowHeight/2 + 3);
      
      // 发出单列标题 - 包含日期列但不显示标题
      const sendColWidths = [45, 60, 50, 45, 45, 55]; // 日期、单号、颜色、尺码、数量、重量
      const sendHeaders = ['', '单号', '颜色', '尺码', '数量(打)', '重量(kg)'];
      let sendX = margin + 50;
      for (let i = 0; i < sendHeaders.length; i++) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#2c3e50';
        ctx.fillText(sendHeaders[i], sendX + sendColWidths[i]/2, y + rowHeight/2 + 3);
        sendX += sendColWidths[i];
      }
      
      // 绘制收回单表头
      ctx.fillStyle = '#fff8e6';
      ctx.fillRect(margin + halfWidth, y, halfWidth, rowHeight);
      
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('收回单', margin + halfWidth + 5, y + rowHeight/2 + 3);
      
      // 收回单列标题 - 包含日期列但不显示标题
      const receiveColWidths = [45, 55, 45, 40, 40, 40, 45, 50]; // 日期、单号、颜色、尺码、工价、数量、重量、工费
      const receiveHeaders = ['', '单号', '颜色', '尺码', '工价', '数量(打)', '重量(kg)', '工费'];
      let receiveX = margin + halfWidth + 50;
      for (let i = 0; i < receiveHeaders.length; i++) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#2c3e50';
        ctx.fillText(receiveHeaders[i], receiveX + receiveColWidths[i]/2, y + rowHeight/2 + 3);
        receiveX += receiveColWidths[i];
      }
      
      y += rowHeight;
      
      // 绘制内部网格线
      for (let i = 1; i < maxDetailCount; i++) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(margin, y + i * rowHeight);
        ctx.lineTo(margin + tableWidth, y + i * rowHeight);
        ctx.stroke();
      }
      
      // 绘制发出单列分割线
      sendX = margin + 50;
      for (let i = 0; i < sendColWidths.length - 1; i++) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sendX + sendColWidths[i], y);
        ctx.lineTo(sendX + sendColWidths[i], y + maxDetailCount * rowHeight);
        ctx.stroke();
        sendX += sendColWidths[i];
      }
      
      // 绘制收回单列分割线
      receiveX = margin + halfWidth + 50;
      for (let i = 0; i < receiveColWidths.length - 1; i++) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(receiveX + receiveColWidths[i], y);
        ctx.lineTo(receiveX + receiveColWidths[i], y + maxDetailCount * rowHeight);
        ctx.stroke();
        receiveX += receiveColWidths[i];
      }
      
      // 绘制发出单数据
      let sendRowIndex = 0;
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#333333';
      
      group.sendOrders.forEach(order => {
        if (order.details && order.details.length > 0) {
          order.details.forEach(detail => {
            const rowY = y + sendRowIndex * rowHeight;
            sendX = margin;
            
            // 为交替行添加背景色
            if (sendRowIndex % 2 === 1) {
              ctx.fillStyle = '#fafbfc';
              ctx.fillRect(margin, rowY, halfWidth, rowHeight);
              ctx.fillStyle = '#34495e';
            } else {
              ctx.fillStyle = '#34495e';
            }
            
            ctx.textAlign = 'center';
            ctx.font = '11px "Microsoft YaHei", sans-serif';
            
            // 🔧 日期（第一列）- 改为靠左对齐，与单据类型垂直对齐
            ctx.fillStyle = '#7f8c8d';
            ctx.font = '10px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'left'; // 改为靠左对齐
            const dateStr = order.date ? order.date.substring(5, 10) : '';
            ctx.fillText(dateStr, sendX + 50 + 5, rowY + rowHeight/2 + 2); // 左侧留5px边距
            sendX += sendColWidths[0];
            
            // 单号（第二列）
            ctx.fillStyle = '#34495e';
            ctx.font = '11px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center'; // 恢复居中对齐
            const orderNo = order.orderNo || '';
            const shortOrderNo = orderNo.length > 10 ? orderNo.substring(0, 8) + '..' : orderNo;
            ctx.fillText(shortOrderNo, sendX + 50 + sendColWidths[1]/2, rowY + rowHeight/2 + 2);
            sendX += sendColWidths[1];
            
            // 颜色（第三列）
            ctx.fillText(detail.itemColor || detail.color || '', sendX + 50 + sendColWidths[2]/2, rowY + rowHeight/2 + 2);
            sendX += sendColWidths[2];
            
            // 尺码（第四列）
            ctx.fillText(detail.itemSize || detail.size || '', sendX + 50 + sendColWidths[3]/2, rowY + rowHeight/2 + 2);
            sendX += sendColWidths[3];
            
            // 🔧 数量（第五列）- 移除"打"单位
            ctx.fillStyle = '#2980b9';
            ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
            ctx.fillText(detail.itemQuantity || detail.quantity || '0', sendX + 50 + sendColWidths[4]/2, rowY + rowHeight/2 + 2);
            sendX += sendColWidths[4];
            
            // 🔧 重量（第六列）- 添加"kg"单位
            ctx.fillStyle = '#27ae60';
            ctx.fillText((detail.itemWeight || detail.weight || '0') + 'kg', sendX + 50 + sendColWidths[5]/2, rowY + rowHeight/2 + 2);
            
            sendRowIndex++;
          });
        } else {
          // 没有明细时显示汇总信息
          const rowY = y + sendRowIndex * rowHeight;
          sendX = margin;
          
          // 为交替行添加背景色
          if (sendRowIndex % 2 === 1) {
            ctx.fillStyle = '#fafbfc';
            ctx.fillRect(margin, rowY, halfWidth, rowHeight);
            ctx.fillStyle = '#34495e';
          } else {
            ctx.fillStyle = '#34495e';
          }
          
          ctx.textAlign = 'center';
          ctx.font = '11px "Microsoft YaHei", sans-serif';
          
          // 🔧 日期（第一列）- 改为靠左对齐，与单据类型垂直对齐
          ctx.fillStyle = '#7f8c8d';
          ctx.font = '10px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'left'; // 改为靠左对齐
          const dateStr = order.date ? order.date.substring(5, 10) : '';
          ctx.fillText(dateStr, sendX + 50 + 5, rowY + rowHeight/2 + 2); // 左侧留5px边距
          sendX += sendColWidths[0];
          
          // 单号（第二列）
          ctx.fillStyle = '#34495e';
          ctx.font = '11px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center'; // 恢复居中对齐
          const orderNo = order.orderNo || '';
          const shortOrderNo = orderNo.length > 10 ? orderNo.substring(0, 8) + '..' : orderNo;
          ctx.fillText(shortOrderNo, sendX + 50 + sendColWidths[1]/2, rowY + rowHeight/2 + 2);
          sendX += sendColWidths[1];
          
          ctx.fillText('', sendX + 50 + sendColWidths[2]/2, rowY + rowHeight/2 + 2);
          sendX += sendColWidths[2];
          ctx.fillText('', sendX + 50 + sendColWidths[3]/2, rowY + rowHeight/2 + 2);
          sendX += sendColWidths[3];
          
          // 🔧 数量（第五列）- 移除"打"单位
          ctx.fillStyle = '#2980b9';
          ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
          ctx.fillText((order.quantity || '0'), sendX + 50 + sendColWidths[4]/2, rowY + rowHeight/2 + 2);
          sendX += sendColWidths[4];
          
          // 🔧 重量（第六列）- 添加"kg"单位
          ctx.fillStyle = '#27ae60';
          ctx.fillText((order.weight || '0') + 'kg', sendX + 50 + sendColWidths[5]/2, rowY + rowHeight/2 + 2);
          
          sendRowIndex++;
        }
      });
      
      // 绘制收回单数据
      let receiveRowIndex = 0;
      
      group.receiveOrders.forEach(order => {
        if (order.details && order.details.length > 0) {
          order.details.forEach(detail => {
            const rowY = y + receiveRowIndex * rowHeight;
            receiveX = margin + halfWidth;
            
            // 为交替行添加背景色
            if (receiveRowIndex % 2 === 1) {
              ctx.fillStyle = '#fafbfc';
              ctx.fillRect(margin + halfWidth, rowY, halfWidth, rowHeight);
              ctx.fillStyle = '#34495e';
            } else {
              ctx.fillStyle = '#34495e';
            }
            
            ctx.textAlign = 'center';
            ctx.font = '11px "Microsoft YaHei", sans-serif';
            
            // 🔧 日期（第一列）- 改为靠左对齐，与单据类型垂直对齐
            ctx.fillStyle = '#7f8c8d';
            ctx.font = '10px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'left'; // 改为靠左对齐
            const dateStr = order.date ? order.date.substring(5, 10) : '';
            ctx.fillText(dateStr, receiveX + 50 + receiveColWidths[0]/2, rowY + rowHeight/2 + 2); // 左侧留5px边距
            receiveX += receiveColWidths[0];
            
            // 单号（第二列）
            ctx.fillStyle = '#34495e';
            ctx.font = '11px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center'; // 恢复居中对齐
            const orderNo = order.orderNo || '';
            const shortOrderNo = orderNo.length > 10 ? orderNo.substring(0, 8) + '..' : orderNo;
            ctx.fillText(shortOrderNo, receiveX + 50 + receiveColWidths[1]/2, rowY + rowHeight/2 + 2);
            receiveX += receiveColWidths[1];
            
            // 颜色（第三列）
            ctx.fillText(detail.itemColor || detail.color || '', receiveX + 50 + receiveColWidths[2]/2, rowY + rowHeight/2 + 2);
            receiveX += receiveColWidths[2];
            
            // 尺码（第四列）
            ctx.fillText(detail.itemSize || detail.size || '', receiveX + 50 + receiveColWidths[3]/2, rowY + rowHeight/2 + 2);
            receiveX += receiveColWidths[3];
            
            // 工价（第五列）
            ctx.fillStyle = '#8e44ad';
            ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
            ctx.fillText(detail.unitPrice || '0', receiveX + 50 + receiveColWidths[4]/2, rowY + rowHeight/2 + 2);
            receiveX += receiveColWidths[4];
            
            // 🔧 数量（第六列）- 移除"打"单位
            ctx.fillStyle = '#2980b9';
            ctx.fillText(detail.itemQuantity || detail.quantity || '0', receiveX + 50 + receiveColWidths[5]/2, rowY + rowHeight/2 + 2);
            receiveX += receiveColWidths[5];
            
            // 🔧 重量（第七列）- 添加"kg"单位
            ctx.fillStyle = '#27ae60';
            ctx.fillText((detail.itemWeight || detail.weight || '0') + 'kg', receiveX + 50 + receiveColWidths[6]/2, rowY + rowHeight/2 + 2);
            receiveX += receiveColWidths[6];
            
            // 工费（第八列）
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
            ctx.fillText(detail.fee || '0', receiveX + 50 + receiveColWidths[7]/2, rowY + rowHeight/2 + 2);
            
            receiveRowIndex++;
          });
        } else {
          // 没有明细时显示汇总信息
          const rowY = y + receiveRowIndex * rowHeight;
          receiveX = margin + halfWidth;
          
          // 为交替行添加背景色
          if (receiveRowIndex % 2 === 1) {
            ctx.fillStyle = '#fafbfc';
            ctx.fillRect(margin + halfWidth, rowY, halfWidth, rowHeight);
            ctx.fillStyle = '#34495e';
          } else {
            ctx.fillStyle = '#34495e';
          }
          
          ctx.textAlign = 'center';
          ctx.font = '11px "Microsoft YaHei", sans-serif';
          
          // 🔧 日期（第一列）- 改为靠左对齐，与单据类型垂直对齐
          ctx.fillStyle = '#7f8c8d';
          ctx.font = '10px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'left'; // 改为靠左对齐
          const dateStr = order.date ? order.date.substring(5, 10) : '';
          ctx.fillText(dateStr, receiveX + 50 + receiveColWidths[0]/2, rowY + rowHeight/2 + 2); // 左侧留5px边距
          receiveX += receiveColWidths[0];
          
          // 单号（第二列）
          ctx.fillStyle = '#34495e';
          ctx.font = '11px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center'; // 恢复居中对齐
          const orderNo = order.orderNo || '';
          const shortOrderNo = orderNo.length > 10 ? orderNo.substring(0, 8) + '..' : orderNo;
          ctx.fillText(shortOrderNo, receiveX + 50 + receiveColWidths[1]/2, rowY + rowHeight/2 + 2);
          receiveX += receiveColWidths[1];
          
          ctx.fillText('', receiveX + 50 + receiveColWidths[2]/2, rowY + rowHeight/2 + 2);
          receiveX += receiveColWidths[2];
          ctx.fillText('', receiveX + 50 + receiveColWidths[3]/2, rowY + rowHeight/2 + 2);
          receiveX += receiveColWidths[3];
          ctx.fillText('', receiveX + 50 + receiveColWidths[4]/2, rowY + rowHeight/2 + 2);
          receiveX += receiveColWidths[4];
          
          // 🔧 数量（第六列）- 移除"打"单位
          ctx.fillStyle = '#2980b9';
          ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
          ctx.fillText(order.quantity || '0', receiveX + 50 + receiveColWidths[5]/2, rowY + rowHeight/2 + 2);
          receiveX += receiveColWidths[5];
          
          // 🔧 重量（第七列）- 添加"kg"单位
          ctx.fillStyle = '#27ae60';
          ctx.fillText((order.weight || '0') + 'kg', receiveX + 50 + receiveColWidths[6]/2, rowY + rowHeight/2 + 2);
          receiveX += receiveColWidths[6];
          
          // 工费（第八列）
          ctx.fillStyle = '#e74c3c';
          ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
          ctx.fillText(order.fee || order.totalAmount || '0', receiveX + 50 + receiveColWidths[7]/2, rowY + rowHeight/2 + 2);
          
          receiveRowIndex++;
        }
      });
      
      y += maxDetailCount * rowHeight;
      
      // 绘制小计行
      ctx.fillStyle = '#f0f8ff';
      ctx.fillRect(margin, y, tableWidth, rowHeight);
      ctx.strokeStyle = '#007aff';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, y, tableWidth, rowHeight);
      
      // 中间分割线
      ctx.beginPath();
      ctx.moveTo(margin + halfWidth, y);
      ctx.lineTo(margin + halfWidth, y + rowHeight);
      ctx.stroke();
      
      ctx.fillStyle = '#007aff';
      ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('小计', margin + 5, y + rowHeight/2 + 3);
      
      // 发出单小计
      const sendTotalQty = group.sendOrders.reduce((sum, order) => sum + (parseFloat(order.quantity) || 0), 0);
      const sendTotalWeight = group.sendOrders.reduce((sum, order) => sum + (parseFloat(order.weight) || 0), 0);
      
      ctx.fillStyle = '#2980b9';
      ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sendTotalQty.toString() + '打', margin + 245, y + rowHeight/2 + 3);
      ctx.fillStyle = '#27ae60';
      ctx.fillText(sendTotalWeight.toFixed(1) + 'kg', margin + 300, y + rowHeight/2 + 3);
      
      // 收回单小计
      const receiveTotalQty = group.receiveOrders.reduce((sum, order) => sum + (parseFloat(order.quantity) || 0), 0);
      const receiveTotalWeight = group.receiveOrders.reduce((sum, order) => sum + (parseFloat(order.weight) || 0), 0);
      const receiveTotalFee = group.receiveOrders.reduce((sum, order) => sum + (parseFloat(order.fee || order.totalAmount) || 0), 0);
      
      ctx.fillStyle = '#2980b9';
      ctx.fillText(receiveTotalQty.toString() + '打', margin + halfWidth + 220, y + rowHeight/2 + 3);
      ctx.fillStyle = '#27ae60';
      ctx.fillText(receiveTotalWeight.toFixed(1) + 'kg', margin + halfWidth + 265, y + rowHeight/2 + 3);
      
      // 工费小计用醒目颜色
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.fillText(receiveTotalFee.toFixed(0), margin + halfWidth + 315, y + rowHeight/2 + 3);
      
      y += rowHeight + 10; // 从20减少到10，缩小组间距，给收发明细更多空间
    }
    
    return y + 10;
  },

  // 绘制手机屏幕适配格式页脚
  drawA4Footer(ctx, canvasWidth, canvasHeight, margin, bottomMargin, currentPage = 1, totalPages = 1) {
    const footerY = canvasHeight - bottomMargin + 18; // 从20调整为18
    
    // 分割线
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, footerY - 23); // 从25调整为23
    ctx.lineTo(canvasWidth - margin, footerY - 23);
    ctx.stroke();
    
    // 页脚信息
    ctx.fillStyle = '#999999';
    ctx.font = '13px "Microsoft YaHei", sans-serif'; // 从14px调整为13px
    ctx.textAlign = 'left';
    ctx.fillText('云收发', margin, footerY);
    
    ctx.textAlign = 'right';
    const timeText = totalPages > 1 
      ? `第${currentPage}/${totalPages}页 | ${new Date().toLocaleString()}` 
      : `生成时间：${new Date().toLocaleString()}`;
    ctx.fillText(timeText, canvasWidth - margin, footerY);
    
    ctx.textAlign = 'center';
    ctx.fillText('本对账单由系统自动生成，如有疑问请联系相关负责人', canvasWidth / 2, footerY + 23); // 从25调整为23
  },

  // 错误处理函数
  handleError(error, context = '') {
    console.error(`[${context}] 发生错误:`, error);
    
    let errorMessage = '操作失败，请稍后重试';
    
    if (error && error.message) {
      if (error.message.includes('网络')) {
        errorMessage = '网络连接异常，请检查网络设置';
      } else if (error.message.includes('权限')) {
        errorMessage = '权限不足，请联系管理员';
      } else if (error.message.includes('数据')) {
        errorMessage = '数据异常，请刷新页面重试';
      }
    }
    
    if (typeof wx !== 'undefined') {
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      });
    }
    
    // 记录错误日志
    this.logError(error, context);
  },

  // 错误日志记录
  logError(error, context) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      context: context,
      error: {
        message: error.message || '未知错误',
        stack: error.stack || '',
        name: error.name || 'Error'
      },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      userId: (app.globalData.userInfo && app.globalData.userInfo.id) || 'unknown',
      orgId: (app.globalData.userInfo && app.globalData.userInfo.orgId) || 'unknown'
    };
    
    console.error('[ErrorLog]', errorLog);
    
    // 可以在这里添加错误上报逻辑
    // 例如发送到错误监控服务
  },

  // 显示对账统计帮助指南
  showFinancialHelp() {
    const helpContent = `📋 对账统计帮助指南

🔍 什么是对账统计？
系统会自动检查对账单中的财务数据，确保计算准确、逻辑一致。

⚠️ 风险等级说明：
🟢 低风险：数据基本正常，可能有轻微提醒
🟡 中等风险：发现一些需要注意的问题
🟠 高风险：发现重要问题，建议立即核查
🔴 严重风险：发现严重错误，必须立即处理

🛠️ 遇到警告时如何处理？

1️⃣ 查看详细问题
   • 点击"查看详情"了解具体问题
   • 记录问题类型和影响范围

2️⃣ 核查原始数据
   • 检查发出单和收回单数据
   • 确认工厂付款记录
   • 验证金额计算是否正确

3️⃣ 联系相关人员
   • 高风险问题：立即联系财务负责人
   • 中等风险：与工厂确认相关数据
   • 数据异常：联系超级管理员

4️⃣ 处理建议
   • 重新生成对账单（数据可能已更新）
   • 导出Excel详细核查
   • 记录问题并跟进处理结果

💡 预防措施：
• 及时录入准确的订单数据
• 定期核对工厂付款记录
• 发现异常立即处理，避免累积`;

    wx.showModal({
      title: '对账统计帮助',
      content: helpContent,
      showCancel: false,
      confirmText: '我知道了',
      success: () => {}
    });
  },

  // 工厂搜索输入
  onFactorySearch(e) {
    console.log('===== 对账单工厂搜索事件触发 =====');
    const keyword = e.detail.value;
    console.log('搜索关键词:', keyword);
    console.log('当前工厂总数:', this.data.factories.length);
    console.log('当前过滤工厂数:', this.data.filteredFactories.length);
    
    this.setData({
      factorySearchKeyword: keyword
    });
    
    // 显示下拉列表
    this.showFactoryDropdown();
    
    // 实时搜索过滤
    this.filterFactories(keyword);
    
    console.log('===== 对账单工厂搜索事件处理完成 =====');
  },

  // 过滤工厂列表
  filterFactories(keyword) {
    console.log('===== 开始过滤工厂列表 =====');
    console.log('搜索关键词:', keyword);
    console.log('当前工厂总数:', this.data.factories.length);
    console.log('当前过滤工厂数:', this.data.filteredFactories.length);
    
    if (!keyword || keyword.trim() === '') {
      // 如果没有关键词，显示所有工厂
      this.setData({
        filteredFactories: this.data.factories
      });
      console.log('无关键词，显示所有工厂:', this.data.factories.length, '个');
      console.log('===== 工厂列表过滤完成（显示全部） =====');
      return;
    }

    const keywordLower = keyword.toLowerCase().trim();
    const filtered = this.data.factories.filter(factory => {
      // 简单字符串匹配：工厂名称、电话、地址
      const nameMatch = factory.name && factory.name.toLowerCase().includes(keywordLower);
      const phoneMatch = factory.phone && factory.phone.toLowerCase().includes(keywordLower);
      const addressMatch = factory.address && factory.address.toLowerCase().includes(keywordLower);
      
      const isMatch = nameMatch || phoneMatch || addressMatch;
      console.log(`检查工厂: ${factory.name} - 名称匹配:${nameMatch}, 电话匹配:${phoneMatch}, 地址匹配:${addressMatch}, 结果:${isMatch}`);
      
      return isMatch;
    });

    this.setData({
      filteredFactories: filtered
    });

    console.log(`工厂搜索结果: "${keyword}" -> ${filtered.length}个匹配`);
    if (filtered.length > 0) {
      console.log('匹配的工厂:', filtered.map(f => f.name));
    } else {
      console.log('没有找到匹配的工厂');
    }
    console.log('===== 工厂列表过滤完成 =====');
  },

  // 从下拉列表中选择工厂
  selectFactoryFromDropdown(e) {
    const factory = e.currentTarget.dataset.factory;
    console.log('选择工厂:', factory);
    
    this.setData({
      selectedFactory: factory,
      showFactoryDropdown: false,
      factorySearchKeyword: factory.name // 显示已选择的工厂名称
    });

    // 清除隐藏定时器
    if (this.data.hideDropdownTimer) {
      clearTimeout(this.data.hideDropdownTimer);
      this.setData({ hideDropdownTimer: null });
    }

    console.log('工厂选择完成:', factory.name);
  },

  // 清空工厂搜索
  clearFactorySearch() {
    this.setData({
      factorySearchKeyword: '',
      filteredFactories: this.data.factories,
      selectedFactory: null
    });
    console.log('清空工厂搜索，重置为显示所有工厂');
  },

  // 显示工厂下拉列表
  showFactoryDropdown() {
    console.log('===== 显示工厂下拉列表 =====');
    console.log('当前工厂总数:', this.data.factories.length);
    console.log('当前过滤工厂数:', this.data.filteredFactories.length);
    console.log('当前搜索关键词:', this.data.factorySearchKeyword);
    
    // 清除隐藏定时器
    if (this.data.hideDropdownTimer) {
      clearTimeout(this.data.hideDropdownTimer);
      this.setData({ hideDropdownTimer: null });
    }
    
    // 确保显示当前过滤状态的工厂列表
    // 如果没有搜索关键词，显示所有工厂
    if (!this.data.factorySearchKeyword || this.data.factorySearchKeyword.trim() === '') {
      this.setData({
        showFactoryDropdown: true,
        filteredFactories: this.data.factories // 显示所有工厂
      });
      console.log('显示所有工厂，总数:', this.data.factories.length);
    } else {
      // 如果有搜索关键词，保持当前过滤结果
      this.setData({
        showFactoryDropdown: true
      });
      console.log('保持当前过滤结果，数量:', this.data.filteredFactories.length);
    }
    
    console.log('===== 工厂下拉列表显示完成 =====');
  },

  // 隐藏工厂下拉列表（带延时）
  hideFactoryDropdownWithDelay() {
    // 设置延时隐藏，给用户点击时间
    const timer = setTimeout(() => {
      this.setData({
        showFactoryDropdown: false
      });
      console.log('延时隐藏工厂下拉列表');
    }, 200);
    
    this.setData({ hideDropdownTimer: timer });
  },

  // 立即隐藏工厂下拉列表
  hideFactoryDropdown() {
    if (this.data.hideDropdownTimer) {
      clearTimeout(this.data.hideDropdownTimer);
    }
    this.setData({
      showFactoryDropdown: false,
      hideDropdownTimer: null
    });
    console.log('立即隐藏工厂下拉列表');
  },

  // ========== 货品下拉相关方法 ==========
  
  // 货品搜索输入
  onProductSearch(e) {
    const keyword = e.detail.value;
    this.setData({
      productSearchKeyword: keyword,
      productInputValue: keyword // 同步更新输入框显示值
    });
    
    // 实时过滤货品
    this.filterProducts(keyword);
    
    // 显示下拉列表
    if (!this.data.showProductDropdown) {
      this.setData({
        showProductDropdown: true
      });
    }
  },

  // 过滤货品列表
  filterProducts(keyword) {
    console.log('开始过滤货品列表，关键词:', keyword);
    console.log('当前货品总数:', this.data.products.length);
    
    if (!keyword || keyword.trim() === '') {
      // 如果没有关键词，显示所有货品
      this.setData({
        filteredProducts: this.data.products
      });
      console.log('无关键词，显示所有货品:', this.data.products.length, '个');
      return;
    }

    const keywordLower = keyword.toLowerCase().trim();
    const filtered = this.data.products.filter(product => {
      // 简单字符串匹配：货品编号、名称、工艺
      const codeMatch = (product.productNo || product.code || '').toLowerCase().includes(keywordLower);
      const nameMatch = (product.name || '').toLowerCase().includes(keywordLower);
      const processMatch = (product.process || '').toLowerCase().includes(keywordLower);
      
      console.log(`检查货品: ${product.productNo || product.code} - 编号匹配:${codeMatch}, 名称匹配:${nameMatch}, 工艺匹配:${processMatch}`);
      
      return codeMatch || nameMatch || processMatch;
    });

    this.setData({
      filteredProducts: filtered
    });

    console.log(`货品搜索: "${keyword}" -> ${filtered.length}个结果`);
    if (filtered.length > 0) {
      console.log('匹配的货品:', filtered.map(f => f.productNo || f.code));
    }
  },

  // 从下拉列表中选择货品
  selectProductFromDropdown(e) {
    const selectedProduct = e.currentTarget.dataset.product;
    
    console.log('===== 对账单选择货品事件触发 =====');
    console.log('选择的货品:', selectedProduct);
    
    // 更新选中的货品
    this.setData({
      selectedProduct: selectedProduct,
      productSearchKeyword: '',
      productInputValue: selectedProduct ? (selectedProduct.productNo || selectedProduct.code) : '全部货品', // 更新输入框显示值
      showProductDropdown: false
    });
    
    // 清除定时器
    if (this.data.hideProductDropdownTimer) {
      clearTimeout(this.data.hideProductDropdownTimer);
      this.setData({
        hideProductDropdownTimer: null
      });
    }
    
    console.log('货品选择完成，当前选中货品:', this.data.selectedProduct);
    console.log('===== 对账单选择货品事件处理完成 =====');
  },

  // 清空货品搜索
  clearProductSearch() {
    this.setData({
      productSearchKeyword: '',
      filteredProducts: this.data.products,
      selectedProduct: null
    });
    console.log('清空货品搜索，重置为显示所有货品');
  },

  // 显示货品下拉列表
  showProductDropdown() {
    // 清除隐藏定时器
    if (this.data.hideProductDropdownTimer) {
      clearTimeout(this.data.hideProductDropdownTimer);
      this.setData({ hideProductDropdownTimer: null });
    }
    
    // 确保显示当前过滤状态的货品列表
    // 如果没有搜索关键词，显示所有货品
    if (!this.data.productSearchKeyword || this.data.productSearchKeyword.trim() === '') {
      this.setData({
        showProductDropdown: true,
        filteredProducts: this.data.products // 显示所有货品
      });
    } else {
      // 如果有搜索关键词，保持当前过滤结果
      this.setData({
        showProductDropdown: true
      });
    }
    
    console.log('显示货品下拉列表，当前过滤货品数量:', this.data.filteredProducts.length);
  },

  // 隐藏货品下拉列表（带延时）
  hideProductDropdownWithDelay() {
    // 设置延时隐藏，给用户点击时间
    const timer = setTimeout(() => {
      this.setData({
        showProductDropdown: false
      });
      console.log('延时隐藏货品下拉列表');
    }, 200);
    
    this.setData({ hideProductDropdownTimer: timer });
  },

  // 立即隐藏货品下拉列表
  hideProductDropdown() {
    if (this.data.hideProductDropdownTimer) {
      clearTimeout(this.data.hideProductDropdownTimer);
    }
    this.setData({
      showProductDropdown: false,
      hideProductDropdownTimer: null
    });
    console.log('立即隐藏货品下拉列表');
  },

  // 货品输入框获取焦点时清空
  onProductInputFocus() {
    this.setData({
      productInputValue: '',
      productSearchKeyword: '',
      showProductDropdown: true,
      filteredProducts: this.data.products // 显示所有货品
    });
    console.log('货品输入框获取焦点，显示所有货品');
  },

  // 工厂输入框获取焦点时的处理
  onFactoryInputFocus() {
    console.log('===== 工厂输入框获取焦点 =====');
    console.log('当前工厂总数:', this.data.factories.length);
    console.log('当前过滤工厂数:', this.data.filteredFactories.length);
    
    // 确保显示所有工厂，不进行任何过滤
    this.setData({
      showFactoryDropdown: true,
      filteredFactories: this.data.factories, // 显示所有工厂
      factorySearchKeyword: '' // 清空搜索关键词
    });
    
    console.log('工厂输入框聚焦处理完成，显示工厂数:', this.data.factories.length);
    console.log('===== 工厂输入框获取焦点处理完成 =====');
  },

  // 获取付款记录
  async fetchPaymentRecords() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'api',
        data: {
          action: 'getFactoryAccounts',
          factoryId: this.data.selectedFactory.id,
          startDate: this.data.startDate,
          endDate: this.data.endDate
        }
      });

      if (result && result.result && result.result.success) {
        let paymentRecords = result.result.data || [];
        if (!Array.isArray(paymentRecords)) {
          paymentRecords = [];
        }
        
        // 过滤日期范围内的付款记录
        const filteredPayments = paymentRecords.filter(record => {
          const recordDate = new Date(record.date || record.createTime);
          const start = new Date(this.data.startDate);
          const end = new Date(this.data.endDate);
          return recordDate >= start && recordDate <= end;
        });
        
        return filteredPayments;
      }
      
      return [];
    } catch (error) {
      console.warn('获取付款记录失败:', error);
      return [];
    }
  },

});