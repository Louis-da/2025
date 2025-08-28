// 对账单相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path'); // 添加path模块引用
const fs = require('fs'); // 添加fs模块引用
const { processImageUrl, processImageUrlSync } = require('../utils/imageProcessor');
const { authenticate } = require('../middleware/auth'); // 添加认证中间件
const ExcelJS = require('exceljs');
const { validateFinancialData } = require('../utils/financialValidator');

// 应用认证中间件到所有路由
router.use(authenticate);

/**
 * 获取对账单数据
 * GET /api/statement
 * 参数：orgId, factoryName, startDate, endDate, productId (这里的productId是货品ID，用于筛选)
 */
router.get('/', async (req, res) => {
  const { factoryName, startDate, endDate, productId: filterProductId } = req.query; // 移除orgId从这里获取
  
  // 强制使用当前登录用户的组织ID
  const orgId = req.user.orgId;

  console.log('对账单查询参数:', { orgId, factoryName, startDate, endDate, filterProductId });

  if (!factoryName || !startDate || !endDate) { // 移除 orgId 的必填校验，因为强制使用当前用户orgId
    return res.status(400).json({ success: false, error: '缺少必要的查询参数 (factoryName, startDate, endDate)' });
  }

  try {
    // 1. 获取工厂ID - 使用当前用户组织ID过滤
    const factoryResult = await db.executeQuery('SELECT id FROM factories WHERE orgId = ? AND name = ?', [orgId, factoryName]);
    if (!factoryResult || factoryResult.length === 0) { // 检查是否找到工厂
      return res.status(404).json({ success: false, error: '未找到指定工厂' });
    }
    const factoryId = factoryResult[0].id; // 获取工厂ID

    // 2. 构建发出单明细查询
    let sendItemsSql = `
      SELECT 
        soi.id AS orderItemId,
        so.id AS orderId,
        soi.product_id AS productId,
        soi.quantity AS itemQuantity,
        soi.weight AS itemWeight,
        soi.color_code AS itemColor,
        soi.size_code AS itemSize,
        COALESCE(p.code, CONCAT('产品ID:', IFNULL(soi.product_id, 'N/A'))) AS styleNo,
        COALESCE(p.name, '未知产品') AS productName,
        COALESCE(p.image, '') AS productImage,
        p.processes AS productProcesses,
        so.order_no AS orderNo,
        DATE_FORMAT(so.created_at, '%Y-%m-%d') AS orderDate,
        'send' AS orderType,
        COALESCE(pr.name, '未知工序') AS orderProcess,
        so.total_weight AS orderTotalWeight,
        so.total_quantity AS orderTotalQuantity,
        0 AS orderFee,
        0 AS orderPaymentAmount,
        NULL AS orderPaymentMethod
      FROM send_orders so
      JOIN send_order_items soi ON so.id = soi.send_order_id
      LEFT JOIN products p ON soi.product_id = p.id
      LEFT JOIN processes pr ON so.process_id = pr.id
      WHERE so.orgId = ?
        AND so.factory_id = ?
        AND DATE(so.created_at) BETWEEN ? AND ?
        AND so.status = 1
    `;

    // 3. 构建收回单明细查询
    let receiveItemsSql = `
      SELECT 
        roi.id AS orderItemId,
        ro.id AS orderId,
        roi.product_id AS productId,
        roi.quantity AS itemQuantity,
        roi.weight AS itemWeight,
        roi.fee AS itemFee,
        roi.color_code AS itemColor,
        roi.size_code AS itemSize,
        COALESCE(p.code, CONCAT('产品ID:', IFNULL(roi.product_id, 'N/A'))) AS styleNo,
        COALESCE(p.name, '未知产品') AS productName,
        COALESCE(p.image, '') AS productImage,
        p.processes AS productProcesses,
        ro.order_no AS orderNo,
        DATE_FORMAT(ro.created_at, '%Y-%m-%d') AS orderDate,
        'receive' AS orderType,
        COALESCE(pr.name, '未知工序') AS orderProcess,
        ro.total_weight AS orderTotalWeight,
        ro.total_quantity AS orderTotalQuantity,
        ro.total_fee AS orderFee,
        ro.payment_amount AS orderPaymentAmount,
        ro.payment_method AS orderPaymentMethod
      FROM receive_orders ro
      JOIN receive_order_items roi ON ro.id = roi.receive_order_id
      LEFT JOIN products p ON roi.product_id = p.id
      LEFT JOIN processes pr ON ro.process_id = pr.id
      WHERE ro.orgId = ?
        AND ro.factory_id = ?
        AND DATE(ro.created_at) BETWEEN ? AND ?
        AND ro.status = 1
    `;

    const params = [orgId, factoryId, startDate, endDate]; // 使用强制的 orgId 和获取的 factoryId

    // 4. 如果指定了productId，添加产品过滤条件
    if (filterProductId && filterProductId !== 'null' && filterProductId !== 'undefined') {
      sendItemsSql += ' AND soi.product_id = ?';
      receiveItemsSql += ' AND roi.product_id = ?';
      params.push(filterProductId);
    }

    // 5. 添加排序
    sendItemsSql += ' ORDER BY so.created_at, so.id, soi.id';
    receiveItemsSql += ' ORDER BY ro.created_at, ro.id, roi.id';

    // 6. 执行查询
    const sendItems = await db.executeQuery(sendItemsSql, params);
    const receiveItems = await db.executeQuery(receiveItemsSql, params);
    
    // 🔧 日志记录：查询结果统计
    console.log(`[statement] 查询结果: 发出单明细=${sendItems.length}条, 收回单明细=${receiveItems.length}条`);

    // 处理图片URL - 将异步改为同步处理
    const processImageUrls = (items) => {
      return items.map(item => {
        try {
          // 使用同步版本的函数，保持与send-orders.js一致
          const { thumbnailUrl, originalImageUrl } = processImageUrlSync(item.productImage, 'Statement');
          return {
            ...item,
            productImage: thumbnailUrl,
            imageUrl: thumbnailUrl,
            originalImageUrl: originalImageUrl
          };
        } catch (error) {
          console.error('[Statement] 处理图片URL时出错:', error, '商品信息:', item);
          return {
            ...item,
            productImage: '/images/default-product.png',
            imageUrl: '/images/default-product.png',
            originalImageUrl: '/images/default-product.png'
          };
        }
      });
    };

    // 同步调用处理函数
    const processedSendItems = processImageUrls(sendItems);
    const processedReceiveItems = processImageUrls(receiveItems);
    const detailedItems = [...processedSendItems, ...processedReceiveItems];

    console.log(`[statement] 处理结果: 共${detailedItems.length}条明细记录`);

    // 7. 初始化汇总变量
    let totalSendWeight = 0;
    let totalReceiveWeight = 0;
    let totalFee = 0;
    const processMap = {};
    const styleMap = {};
    const processedOrders = new Set(); // 🔧 关键修复：用于订单去重

    // 统计订单类型分布（生产环境监控）
    const sendCount = detailedItems.filter(item => item.orderType === 'send').length;
    const receiveCount = detailedItems.filter(item => item.orderType === 'receive').length;
    console.log(`[statement] 订单分布: 发出单${sendCount}条, 收回单${receiveCount}条`);

    // 8. 遍历明细记录，构建汇总数据
    detailedItems.forEach(item => {
      const weight = parseFloat(item.orderTotalWeight || 0);
      if (item.orderType === 'send') {
        totalSendWeight += weight;
      } else if (item.orderType === 'receive') {
        totalReceiveWeight += weight;
        
        // 🔧 核心逻辑：按订单去重累加工费，避免重复计算
        const orderKey = `receive_${item.orderId}`;
        if (!processedOrders.has(orderKey)) {
          const orderFeeValue = parseFloat(item.orderFee || 0);
          totalFee += orderFeeValue;
          processedOrders.add(orderKey);
        }
      }

      // 工序对比分析
      const process = item.orderProcess || '未知工序';
      if (!processMap[process]) {
        processMap[process] = { sendWeight: 0, receiveWeight: 0 };
      }
      if (item.orderType === 'send') {
        processMap[process].sendWeight += weight;
      } else if (item.orderType === 'receive') {
        processMap[process].receiveWeight += weight;
      }

      // 按货号汇总
      const styleNo = item.styleNo;
      if (!styleMap[styleNo]) {
        styleMap[styleNo] = {
          styleNo: styleNo,
          productName: item.productName,
          productImage: item.productImage,
          imageUrl: item.imageUrl,
          originalImageUrl: item.originalImageUrl,
          process: item.orderProcess,
          sendQuantity: 0,
          sendWeight: 0,
          receiveQuantity: 0,
          receiveWeight: 0,
          fee: 0,
          paymentAmount: 0,
          paymentMethod: '未付'
        };
      }

      const itemQty = parseInt(item.itemQuantity || 0);
      const itemWt = parseFloat(item.itemWeight || 0);

      if (item.orderType === 'send') {
        styleMap[styleNo].sendQuantity += itemQty;
        styleMap[styleNo].sendWeight += itemWt;
      } else if (item.orderType === 'receive') {
        styleMap[styleNo].receiveQuantity += itemQty;
        styleMap[styleNo].receiveWeight += itemWt;
        
        // 🔧 重要修复：货品汇总使用明细级工费，避免订单级工费重复计算
        // 直接累加明细工费，这是最准确的方式
        styleMap[styleNo].fee += parseFloat(item.itemFee || 0);
        
        // 直接使用数据库中的真实支付方式，不再临时生成"已付"
        if (item.orderPaymentMethod && item.orderPaymentMethod !== '未付') {
          styleMap[styleNo].paymentMethod = item.orderPaymentMethod;
        }
      }

      // 发出单不显示工价
      if (item.orderType === 'send') {
        item.priceDisplay = '';
      } else if (item.orderType === 'receive') {
        // 🔧 重要修复：使用itemFee而不是fee字段
        item.priceDisplay = (item.itemFee !== undefined && item.itemFee !== null && item.itemFee !== '' && Number(item.itemFee) > 0)
          ? Number(item.itemFee).toFixed(2)
          : '';
      }
    });

    // --- 新增：合并工厂付款记录 ---
    // 🔧 重要修复：与工厂账户API保持收回单排除逻辑一致，但对账单需要日期过滤
    let paymentRecords = [];
    try {
      // 🔧 修复：先查询收回单号用于排除，与工厂账户API保持一致
      const receiveOrderNos = await db.executeQuery(`
        SELECT DISTINCT order_no FROM receive_orders 
        WHERE factory_id = ? AND orgId = ?
      `, [factoryId, orgId]);
      
      const excludeOrderNos = receiveOrderNos.map(row => row.order_no);
      
      // 🔧 关键修复：对账单API需要日期过滤，与工厂账户API的业务逻辑不同
      let paymentQuery = `
        SELECT 
          id, payment_no AS orderNo, amount, payment_method, remark, createTime AS date
        FROM factory_payments
        WHERE orgId = ? AND factory_id = ? AND status = 1
        AND DATE(createTime) BETWEEN ? AND ?
      `;
      let paymentParams = [orgId, factoryId, startDate, endDate];
      
      // 如果有收回单号需要排除，添加NOT IN条件
      if (excludeOrderNos.length > 0) {
        const placeholders = excludeOrderNos.map(() => '?').join(',');
        paymentQuery += ` AND payment_no NOT IN (${placeholders})`;
        paymentParams.push(...excludeOrderNos);
      }
      
      paymentRecords = await db.executeQuery(paymentQuery, paymentParams);
      
      console.log(`[statement] 工厂付款记录: 总计${paymentRecords.length}条（已排除收回单关联，日期范围：${startDate} ~ ${endDate}）`);
      
      // 🔧 新增：详细记录每条工厂付款
      paymentRecords.forEach((record, index) => {
        console.log(`[statement] 工厂付款${index + 1}: 单号=${record.orderNo}, 金额=${record.amount}, 日期=${record.date}`);
      });
    } catch (err) {
      console.warn('[statement] 查询factory_payments失败:', err.message);
      paymentRecords = [];
    }
    
    // 🔧 重要修复：收回单支付去重 - 按单据号而不是按明细行
    // 合并收回单支付和工厂付款，去重（按单号+金额+日期）
    const paidSet = new Set();
    let mergedPaidAmount = 0;
    
    console.log(`[statement] 🔍 开始支付金额计算调试...`);
    
    // 1. 先处理收回单支付 - 按单据号去重，避免多条明细重复计算
    const receiveOrderPayments = new Map(); // 用于收回单支付去重
    console.log(`[statement] 📝 第1步：处理收回单支付`);
    receiveItems.forEach(item => {
      const orderNo = item.orderNo || '';
      const paymentAmount = parseFloat(item.orderPaymentAmount || 0);
      const orderDate = item.orderDate;
      
      // 🔧 关键修复：按收回单号去重，而不是按明细行
      if (paymentAmount > 0 && orderNo) {
        if (!receiveOrderPayments.has(orderNo)) {
          receiveOrderPayments.set(orderNo, {
            amount: paymentAmount,
            date: orderDate,
            method: item.orderPaymentMethod
          });
          
          const key = `receive_${orderNo}_${paymentAmount}_${orderDate}`;
          if (!paidSet.has(key)) {
            console.log(`[statement] ✅ 收回单支付累加: ${orderNo}, 金额=${paymentAmount}, 累计=${mergedPaidAmount} + ${paymentAmount} = ${mergedPaidAmount + paymentAmount}`);
            mergedPaidAmount += paymentAmount;
            paidSet.add(key);
          } else {
            console.log(`[statement] ⚠️ 收回单支付重复跳过: ${orderNo}, 金额=${paymentAmount}`);
          }
        } else {
          console.log(`[statement] ⚠️ 收回单订单号重复跳过: ${orderNo}, 金额=${paymentAmount}`);
        }
      }
    });
    
    console.log(`[statement] 📊 收回单支付处理完成: 累计金额=${mergedPaidAmount}, 收回单数量=${receiveOrderPayments.size}`);
    
    // 2. 再加工厂付款记录，排除已通过收回单计算的支付
    console.log(`[statement] 📝 第2步：处理工厂付款记录`);
    paymentRecords.forEach((record, index) => {
      const paymentAmount = parseFloat(record.amount || 0);
      const orderNo = record.orderNo || '';
      const paymentDate = record.date;
      
      console.log(`[statement] 🔍 检查工厂付款${index + 1}: 单号=${orderNo}, 金额=${paymentAmount}`);
      
      // 🔧 重要修复：不再通过单号匹配排除，因为查询时已经排除了收回单关联的付款记录
      if (paymentAmount > 0) {
        const key = `payment_${orderNo}_${paymentAmount}_${paymentDate}`;
        if (!paidSet.has(key)) {
          console.log(`[statement] ✅ 工厂付款累加: ${orderNo}, 金额=${paymentAmount}, 累计=${mergedPaidAmount} + ${paymentAmount} = ${mergedPaidAmount + paymentAmount}`);
          mergedPaidAmount += paymentAmount;
          paidSet.add(key);
        } else {
          console.log(`[statement] ⚠️ 工厂付款重复跳过: ${orderNo}, 金额=${paymentAmount}`);
        }
      } else {
        console.log(`[statement] ℹ️ 工厂付款排除（金额为0）: ${orderNo}, 金额=${paymentAmount}`);
      }
    });
    
    console.log(`[statement] 📊 工厂付款处理完成: 最终累计金额=${mergedPaidAmount}`);
    console.log(`[statement] 支付汇总: 总计${mergedPaidAmount.toFixed(2)}元, 收回单支付${receiveOrderPayments.size}笔, 工厂付款${paymentRecords.length}笔`);

    // 🔧 修复：在去重处理完成后，正确填充货品汇总中的支付金额
    // 为每个货号分配对应的去重后支付金额
    receiveOrderPayments.forEach((paymentInfo, orderNo) => {
      // 找到该收回单对应的所有明细项
      const orderItems = receiveItems.filter(item => item.orderNo === orderNo);
      
      if (orderItems.length > 0) {
        // 按货号分组，每个货号按比例分配支付金额
        const styleGroups = {};
        orderItems.forEach(item => {
          const styleNo = item.styleNo;
          if (!styleGroups[styleNo]) {
            styleGroups[styleNo] = [];
          }
          styleGroups[styleNo].push(item);
        });
        
        // 🔧 关键修复：计算该收回单的总工费，避免重复累加订单级工费
        // orderItems中每个明细都有相同的orderFee，所以只取第一个即可
        const orderTotalFee = orderItems.length > 0 ? parseFloat(orderItems[0].orderFee || 0) : 0;
        
        // 为每个货号分配支付金额
        Object.keys(styleGroups).forEach(styleNo => {
          if (styleMap[styleNo]) {
            const styleItems = styleGroups[styleNo];
            // 🔧 关键修复：按明细工费计算货号在该订单中的占比，而不是重复累加订单级工费
            const styleFeeInThisOrder = styleItems.reduce((sum, item) => sum + parseFloat(item.itemFee || 0), 0);
            
                    // 🔧 支付金额分配：按工费比例或平均分配，确保边界安全
        const stylePaymentAmount = orderTotalFee > 0 
          ? (paymentInfo.amount * styleFeeInThisOrder / orderTotalFee)
          : (Object.keys(styleGroups).length > 0 ? paymentInfo.amount / Object.keys(styleGroups).length : 0);
            
            styleMap[styleNo].paymentAmount += stylePaymentAmount;
          }
        });
      }
    });

    // 9. 计算衍生数据
    const lossRate = totalSendWeight > 0 ? ((totalSendWeight - totalReceiveWeight) / totalSendWeight * 100).toFixed(2) : '0.00';
    const unpaidAmount = (totalFee - mergedPaidAmount).toFixed(2); // 用合并后的已付金额
    
    // 核心财务数据验证日志
    console.log(`[statement] 财务计算: 总工费=${totalFee.toFixed(2)}元, 已付=${mergedPaidAmount.toFixed(2)}元, 未付=${unpaidAmount}元, 去重订单=${processedOrders.size}个`);

    // 10. 处理工序对比数据
    const processComparison = Object.entries(processMap).map(([processName, item]) => ({
      process: processName,
      sendWeight: item.sendWeight.toFixed(1),
      receiveWeight: item.receiveWeight.toFixed(1),
      lossRate: item.sendWeight > 0 ? ((item.sendWeight - item.receiveWeight) / item.sendWeight * 100).toFixed(2) : '0.00'
    }));

    // 11. 处理按货号汇总数据
    const styleSummary = Object.values(styleMap)
      .filter(item => (
        item.sendQuantity !== 0 ||
        item.sendWeight !== 0 ||
        item.receiveQuantity !== 0 ||
        item.receiveWeight !== 0
      ))
      .map(item => {
        return {
          ...item,
          sendWeight: item.sendWeight.toFixed(1),
          receiveWeight: item.receiveWeight.toFixed(1),
          fee: item.fee.toFixed(2),
          paymentAmount: item.paymentAmount.toFixed(2)
        };
      });
    
    // 数据一致性验证
    const styleTotalFee = styleSummary.reduce((sum, item) => sum + parseFloat(item.fee || 0), 0);
    if (Math.abs(styleTotalFee - totalFee) > 0.01) {
      console.warn(`[statement] 数据一致性警告: 货品汇总=${styleTotalFee.toFixed(2)}元, 订单总工费=${totalFee.toFixed(2)}元, 差异=${(styleTotalFee - totalFee).toFixed(2)}元`);
    }

    // 12. 财务数据验证与审计 - 后端专业验证机制
    // const financialValidation = validateFinancialData({
    //   totalFee,
    //   totalPaidAmount: mergedPaidAmount,
    //   unpaidAmount,
    //   detailedItems,
    //   styleSummary,
    //   factoryName,
    //   startDate,
    //   endDate,
    //   orgId
    // });

    // 13. 组装返回数据
    const responseData = {
      factoryName: factoryName,
      startDate: startDate,
      endDate: endDate,
      sendWeight: totalSendWeight.toFixed(1),
      receiveWeight: totalReceiveWeight.toFixed(1),
      lossRate: lossRate,
      totalFee: totalFee.toFixed(2),
      paidAmount: mergedPaidAmount.toFixed(2), // 用合并后的已付金额
      unpaidAmount: unpaidAmount,
      processComparison: processComparison,
      styleSummary: styleSummary,
      orders: detailedItems
      // 不再返回financialValidation
    };

    res.json({ success: true, data: responseData });

  } catch (error) {
    console.error('获取对账单数据时出错:', error);
    res.status(500).json({ success: false, error: '服务器内部错误，无法获取对账单数据' });
  }
});

// Excel导出路由
router.post('/export-excel', async (req, res) => {
  try {
    const { factoryName, startDate, endDate, exportData } = req.body;
    const orgId = req.user.orgId; // 从认证中间件获取组织ID

    // 创建新的工作簿
    const workbook = new ExcelJS.Workbook();
    
    // 创建对账单工作表
    const worksheet = workbook.addWorksheet('工厂对账单');
    
    // 设置页面设置
    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      margins: {
        left: 0.7, right: 0.7, top: 0.75, bottom: 0.75,
        header: 0.3, footer: 0.3
      }
    };

    // 设置标题
    worksheet.mergeCells('A1:M3');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${factoryName} - 工厂对账单`;
    titleCell.font = { 
      name: 'Arial Unicode MS', 
      size: 18, 
      bold: true,
      color: { argb: 'FF000000' }
    };
    titleCell.alignment = { 
      vertical: 'middle', 
      horizontal: 'center' 
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' }
    };

    // 添加日期信息
    worksheet.mergeCells('A4:M4');
    const dateCell = worksheet.getCell('A4');
    dateCell.value = `统计期间：${startDate} 至 ${endDate}`;
    dateCell.font = { 
      name: 'Arial Unicode MS', 
      size: 12, 
      bold: true 
    };
    dateCell.alignment = { 
      vertical: 'middle', 
      horizontal: 'center' 
    };

    // 添加汇总信息
    let currentRow = 6;
    
    // 汇总数据标题
    worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
    const summaryTitleCell = worksheet.getCell(`A${currentRow}`);
    summaryTitleCell.value = '对账汇总';
    summaryTitleCell.font = { 
      name: 'Arial Unicode MS', 
      size: 14, 
      bold: true 
    };
    summaryTitleCell.alignment = { 
      vertical: 'middle', 
      horizontal: 'center' 
    };
    summaryTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F2FF' }
    };
    currentRow++;

    // 汇总数据行
    const summaryData = [
      ['项目', '发出单', '收回单', '损耗分析', '财务状况'],
      ['单据数量', `${exportData.summary.sendOrderCount}单`, `${exportData.summary.receiveOrderCount}单`, `损耗重量：${exportData.summary.lossWeight}kg`, `总金额：¥${exportData.summary.totalAmount}`],
      ['重量', `${exportData.summary.totalSendWeight.toFixed(2)}kg`, `${exportData.summary.totalReceiveWeight.toFixed(2)}kg`, `损耗率：${exportData.summary.lossRate}%`, `已付款：¥${exportData.summary.totalPayment}`],
      ['', '', '', `货品种类：${exportData.productSummary.length}种`, `期末结余：¥${exportData.summary.finalBalance}`]
    ];

    summaryData.forEach((row, index) => {
      const rowNum = currentRow + index;
      row.forEach((cellValue, colIndex) => {
        const cell = worksheet.getCell(rowNum, colIndex + 1);
        cell.value = cellValue;
        cell.font = { 
          name: 'Arial Unicode MS', 
          size: 10,
          bold: index === 0
        };
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: 'center' 
        };
        if (index === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F8F8' }
          };
        }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    currentRow += summaryData.length + 2;

    // 传统对账单表格
    worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
    const tableTitleCell = worksheet.getCell(`A${currentRow}`);
    tableTitleCell.value = '对账单明细';
    tableTitleCell.font = { 
      name: 'Arial Unicode MS', 
      size: 14, 
      bold: true 
    };
    tableTitleCell.alignment = { 
      vertical: 'middle', 
      horizontal: 'center' 
    };
    tableTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F2FF' }
    };
    currentRow++;

    // 表头
    const headers = [
      '日期', '单号', '制单人', '工序', '发出(重量)', 
      '收回(重量)', '本单合计', '支付金额', '支付方式', '累计结余', '备注'
    ];
    
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(currentRow, index + 1);
      cell.value = header;
      cell.font = { 
        name: 'Arial Unicode MS', 
        size: 11, 
        bold: true,
        color: { argb: 'FF000000' }
      };
      cell.alignment = { 
        vertical: 'middle', 
        horizontal: 'center' 
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8F8F8' }
      };
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });
    currentRow++;

    // 添加数据行
    exportData.traditionalTable.forEach((row, index) => {
      const rowData = [
        row.date,
        row.orderNo,
        row.creator,
        row.process,
        row.sendQuantity === '-' ? '-' : `${row.sendWeight}kg`,
        row.receiveQuantity === '-' ? '-' : `${row.receiveWeight}kg`,
        row.totalAmount,
        row.paymentAmount,
        row.paymentMethod,
        row.balance,
        row.remark
      ];

      rowData.forEach((cellValue, colIndex) => {
        const cell = worksheet.getCell(currentRow, colIndex + 1);
        cell.value = cellValue;
        cell.font = { 
          name: 'Arial Unicode MS', 
          size: 10 
        };
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: 'center' 
        };
        
        // 根据类型设置背景色
        if (row.type === '发出单') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDAE3F3' } // 蓝色背景
          };
        } else if (row.type === '收回单') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8CBAD' } // 橙色背景
          };
        }
        
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      currentRow++;
    });

    // 合计行
    const totalRowData = [
      '合计', '', '', '',
      `${exportData.summary.totalSendWeight.toFixed(2)}kg`,
      `${exportData.summary.totalReceiveWeight.toFixed(2)}kg`,
      exportData.summary.totalAmount,
      exportData.summary.totalPayment,
      '',
      exportData.summary.finalBalance,
      ''
    ];

    totalRowData.forEach((cellValue, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1);
      cell.value = cellValue;
      cell.font = { 
        name: 'Arial Unicode MS', 
        size: 11, 
        bold: true 
      };
      cell.alignment = { 
        vertical: 'middle', 
        horizontal: 'center' 
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' }
      };
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });
    currentRow += 2;

    // 货品汇总表
    if (exportData.productSummary && exportData.productSummary.length > 0) {
      worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
      const productTitleCell = worksheet.getCell(`A${currentRow}`);
      productTitleCell.value = '货品汇总';
      productTitleCell.font = { 
        name: 'Arial Unicode MS', 
        size: 14, 
        bold: true 
      };
      productTitleCell.alignment = { 
        vertical: 'middle', 
        horizontal: 'center' 
      };
      productTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F2FF' }
      };
      currentRow++;

      // 货品表头
      const productHeaders = [
        '货号', '名称', '工序', '发出(重量)', 
        '收回(重量)', '损耗率'
      ];
      
      productHeaders.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.font = { 
          name: 'Arial Unicode MS', 
          size: 11, 
          bold: true 
        };
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: 'center' 
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F7FA' }
        };
        cell.border = {
          top: { style: 'medium' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' }
        };
      });
      currentRow++;

      // 货品数据
      exportData.productSummary.forEach((product) => {
        const productRowData = [
          product.productNo,
          product.name,
          product.process,
          `${product.sendWeight}kg`,
          `${product.receiveWeight}kg`,
          `${product.lossRate}%`
        ];

        productRowData.forEach((cellValue, colIndex) => {
          const cell = worksheet.getCell(currentRow, colIndex + 1);
          cell.value = cellValue;
          cell.font = { 
            name: 'Arial Unicode MS', 
            size: 10 
          };
          cell.alignment = { 
            vertical: 'middle', 
            horizontal: 'center' 
          };
          
          // 损耗率超过5%标红
          if (colIndex === 5 && parseFloat(product.lossRate || 0) > 5) {
            cell.font.color = { argb: 'FFFF0000' };
            cell.font.bold = true;
          }
          
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
        currentRow++;
      });
    }

    // 添加财务验证报告（如果存在）
    if (exportData.financialValidation) {
      currentRow += 2;
      
      // 财务验证报告标题
      worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
      const validationTitleCell = worksheet.getCell(`A${currentRow}`);
      validationTitleCell.value = '财务验证报告';
      validationTitleCell.font = { 
        name: 'Arial Unicode MS', 
        size: 14, 
        bold: true 
      };
      validationTitleCell.alignment = { 
        vertical: 'middle', 
        horizontal: 'center' 
      };
      validationTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFE6E6' }
      };
      currentRow++;

      // 验证摘要
      const validation = exportData.financialValidation;
      const validationSummary = [
        ['验证项目', '验证结果', '详细说明'],
        ['验证状态', validation.isValid ? '✓ 通过' : '✗ 未通过', `风险等级: ${validation.riskLevel}`],
        ['检查统计', `${validation.summary.totalChecks}项检查`, `通过率: ${validation.summary.successRate}`],
        ['错误数量', `${validation.errors.length}个错误`, validation.errors.length > 0 ? '需要立即处理' : '无错误'],
        ['警告数量', `${validation.warnings.length}个警告`, validation.warnings.length > 0 ? '建议关注' : '无警告']
      ];

      validationSummary.forEach((row, index) => {
        const rowNum = currentRow + index;
        row.forEach((cellValue, colIndex) => {
          const cell = worksheet.getCell(rowNum, colIndex + 1);
          cell.value = cellValue;
          cell.font = { 
            name: 'Arial Unicode MS', 
            size: 10,
            bold: index === 0
          };
          cell.alignment = { 
            vertical: 'middle', 
            horizontal: 'center' 
          };
          
          // 根据验证结果设置颜色
          if (index > 0) {
            if (cellValue.includes('✗') || cellValue.includes('错误') && !cellValue.includes('无错误')) {
              cell.font.color = { argb: 'FFFF0000' };
            } else if (cellValue.includes('✓') || cellValue.includes('无错误') || cellValue.includes('无警告')) {
              cell.font.color = { argb: 'FF008000' };
            }
          }
          
          if (index === 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF5F5F5' }
            };
          }
          
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
      currentRow += validationSummary.length + 1;

      // 详细问题列表
      if (validation.errors.length > 0 || validation.warnings.length > 0) {
        worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
        const issuesTitleCell = worksheet.getCell(`A${currentRow}`);
        issuesTitleCell.value = '发现的问题详情';
        issuesTitleCell.font = { 
          name: 'Arial Unicode MS', 
          size: 12, 
          bold: true 
        };
        issuesTitleCell.alignment = { 
          vertical: 'middle', 
          horizontal: 'center' 
        };
        currentRow++;

        // 错误列表
        if (validation.errors.length > 0) {
          validation.errors.forEach((error, index) => {
            const errorRow = [
              `错误${index + 1}`,
              error.message,
              error.severity,
              error.code || '未知',
              error.timestamp ? new Date(error.timestamp).toLocaleString() : ''
            ];
            
            errorRow.forEach((cellValue, colIndex) => {
              const cell = worksheet.getCell(currentRow, colIndex + 1);
              cell.value = cellValue;
              cell.font = { 
                name: 'Arial Unicode MS', 
                size: 9,
                color: { argb: 'FFFF0000' }
              };
              cell.alignment = { 
                vertical: 'middle', 
                horizontal: 'left' 
              };
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            });
            currentRow++;
          });
        }

        // 警告列表
        if (validation.warnings.length > 0) {
          validation.warnings.forEach((warning, index) => {
            const warningRow = [
              `警告${index + 1}`,
              warning.message,
              warning.severity,
              warning.code || '未知',
              warning.timestamp ? new Date(warning.timestamp).toLocaleString() : ''
            ];
            
            warningRow.forEach((cellValue, colIndex) => {
              const cell = worksheet.getCell(currentRow, colIndex + 1);
              cell.value = cellValue;
              cell.font = { 
                name: 'Arial Unicode MS', 
                size: 9,
                color: { argb: 'FFFF8C00' }
              };
              cell.alignment = { 
                vertical: 'middle', 
                horizontal: 'left' 
              };
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            });
            currentRow++;
          });
        }
      }
    }

    // 设置列宽
    worksheet.columns = [
      { width: 12 }, // 日期
      { width: 15 }, // 单号
      { width: 10 }, // 制单人
      { width: 10 }, // 工序
      { width: 18 }, // 发出(重量)
      { width: 18 }, // 收回(重量)
      { width: 12 }, // 本单合计
      { width: 12 }, // 支付金额
      { width: 10 }, // 支付方式
      { width: 12 }, // 累计结余
      { width: 15 }  // 备注
    ];

    // 生成文件名
    const fileName = `工厂对账单_${factoryName}_${startDate}_${endDate}_${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, '../uploads', fileName);

    // 确保uploads目录存在
    const uploadsDir = path.dirname(filePath);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 保存文件
    await workbook.xlsx.writeFile(filePath);

    // 返回下载链接
    const downloadUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
    
    res.json({
      success: true,
      data: {
        downloadUrl: downloadUrl,
        fileName: fileName
      },
      message: 'Excel文件生成成功'
    });

  } catch (error) {
    console.error('导出Excel失败:', error);
    res.status(500).json({
      success: false,
      message: '导出Excel失败：' + error.message
    });
  }
});

module.exports = router; 