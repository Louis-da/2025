/**
 * 财务数据验证与审计工具
 * 
 * 功能：
 * 1. 财务数据完整性验证
 * 2. 计算准确性验证
 * 3. 异常数据检测
 * 4. 审计日志记录
 * 5. 风险评估
 * 
 * @author 云收发系统
 * @version 1.0.0
 */

const logger = require('../logger');

/**
 * 财务数据验证主函数
 * @param {Object} data - 财务数据对象
 * @returns {Object} 验证结果
 */
function validateFinancialData(data) {
  const {
    totalFee,
    totalPaidAmount,
    unpaidAmount,
    detailedItems,
    styleSummary,
    factoryName,
    startDate,
    endDate,
    orgId
  } = data;

  const validationResult = {
    isValid: true,
    warnings: [],
    errors: [],
    summary: {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      warningChecks: 0
    },
    details: {},
    auditLog: [],
    riskLevel: 'low', // low, medium, high, critical
    timestamp: new Date().toISOString()
  };

  try {
    // 1. 基础数据完整性验证
    validateDataIntegrity(data, validationResult);

    // 2. 财务计算准确性验证
    validateCalculationAccuracy(data, validationResult);

    // 3. 业务逻辑一致性验证
    validateBusinessLogic(data, validationResult);

    // 4. 异常数据检测
    detectAnomalies(data, validationResult);

    // 5. 风险评估
    assessRisk(validationResult);

    // 6. 生成审计日志
    generateAuditLog(data, validationResult);

    // 7. 计算验证统计
    calculateValidationStats(validationResult);

    logger.info('[Financial Validation] 财务验证完成', {
      orgId,
      factoryName,
      period: `${startDate} - ${endDate}`,
      result: {
        isValid: validationResult.isValid,
        riskLevel: validationResult.riskLevel,
        totalChecks: validationResult.summary.totalChecks,
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length
      }
    });

  } catch (error) {
    logger.error('[Financial Validation] 财务验证过程中发生错误', {
      error: error.message,
      stack: error.stack,
      orgId,
      factoryName
    });

    validationResult.isValid = false;
    validationResult.errors.push({
      code: 'VALIDATION_ERROR',
      message: '财务验证过程中发生系统错误',
      severity: 'critical',
      timestamp: new Date().toISOString()
    });
    validationResult.riskLevel = 'critical';
  }

  return validationResult;
}

/**
 * 基础数据完整性验证
 */
function validateDataIntegrity(data, result) {
  const { totalFee, totalPaidAmount, unpaidAmount, detailedItems } = data;

  // 检查必要字段是否存在
  const requiredFields = [
    { field: 'totalFee', value: totalFee, name: '总金额' },
    { field: 'totalPaidAmount', value: totalPaidAmount, name: '已付金额' },
    { field: 'unpaidAmount', value: unpaidAmount, name: '未付金额' },
    { field: 'detailedItems', value: detailedItems, name: '明细数据' }
  ];

  requiredFields.forEach(({ field, value, name }) => {
    result.summary.totalChecks++;
    
    if (value === undefined || value === null) {
      result.errors.push({
        code: 'MISSING_FIELD',
        field: field,
        message: `缺少必要的财务字段: ${name}`,
        severity: 'high',
        timestamp: new Date().toISOString()
      });
      result.summary.failedChecks++;
      result.isValid = false;
    } else {
      result.summary.passedChecks++;
    }
  });

  // 检查数值类型
  const numericFields = [
    { field: 'totalFee', value: totalFee, name: '总金额' },
    { field: 'totalPaidAmount', value: totalPaidAmount, name: '已付金额' },
    { field: 'unpaidAmount', value: unpaidAmount, name: '未付金额' }
  ];

  numericFields.forEach(({ field, value, name }) => {
    result.summary.totalChecks++;
    
    if (isNaN(parseFloat(value))) {
      result.errors.push({
        code: 'INVALID_NUMBER',
        field: field,
        message: `${name}不是有效的数值: ${value}`,
        severity: 'high',
        timestamp: new Date().toISOString()
      });
      result.summary.failedChecks++;
      result.isValid = false;
    } else {
      result.summary.passedChecks++;
    }
  });

  // 检查明细数据完整性
  if (Array.isArray(detailedItems)) {
    result.summary.totalChecks++;
    
    const invalidItems = detailedItems.filter(item => 
      !item.orderId || 
      !item.orderType || 
      (item.orderType === 'receive' && (isNaN(parseFloat(item.orderFee))))
    );

    if (invalidItems.length > 0) {
      result.warnings.push({
        code: 'INCOMPLETE_ITEMS',
        message: `发现${invalidItems.length}条不完整的明细记录`,
        severity: 'medium',
        details: invalidItems.slice(0, 5), // 只记录前5条
        timestamp: new Date().toISOString()
      });
      result.summary.warningChecks++;
    } else {
      result.summary.passedChecks++;
    }
  }
}

/**
 * 财务计算准确性验证
 */
function validateCalculationAccuracy(data, result) {
  const { totalFee, totalPaidAmount, unpaidAmount, detailedItems } = data;

  // 验证收回单总金额计算
  result.summary.totalChecks++;
  
  const receiveItems = detailedItems.filter(item => item.orderType === 'receive');
  const calculatedTotalFee = receiveItems.reduce((sum, item) => {
    return sum + parseFloat(item.orderFee || 0);
  }, 0);

  const tolerance = 0.01; // 1分钱容差
  const feeDiscrepancy = Math.abs(calculatedTotalFee - parseFloat(totalFee));

  if (feeDiscrepancy > tolerance) {
    result.errors.push({
      code: 'FEE_CALCULATION_ERROR',
      message: `总金额计算不匹配`,
      severity: 'high',
      details: {
        calculated: calculatedTotalFee.toFixed(2),
        reported: parseFloat(totalFee).toFixed(2),
        discrepancy: feeDiscrepancy.toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
    result.summary.failedChecks++;
    result.isValid = false;
  } else {
    result.summary.passedChecks++;
  }

  // 验证已付金额计算
  result.summary.totalChecks++;
  
  const calculatedPaidAmount = receiveItems.reduce((sum, item) => {
    return sum + parseFloat(item.orderPaymentAmount || 0);
  }, 0);

  const paidDiscrepancy = Math.abs(calculatedPaidAmount - parseFloat(totalPaidAmount));

  if (paidDiscrepancy > tolerance) {
    result.warnings.push({
      code: 'PAYMENT_CALCULATION_WARNING',
      message: `已付金额计算存在差异`,
      severity: 'medium',
      details: {
        calculated: calculatedPaidAmount.toFixed(2),
        reported: parseFloat(totalPaidAmount).toFixed(2),
        discrepancy: paidDiscrepancy.toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
    result.summary.warningChecks++;
  } else {
    result.summary.passedChecks++;
  }

  // 验证未付金额计算
  result.summary.totalChecks++;
  
  const calculatedUnpaidAmount = parseFloat(totalFee) - parseFloat(totalPaidAmount);
  const unpaidDiscrepancy = Math.abs(calculatedUnpaidAmount - parseFloat(unpaidAmount));

  if (unpaidDiscrepancy > tolerance) {
    result.errors.push({
      code: 'UNPAID_CALCULATION_ERROR',
      message: `未付金额计算不匹配`,
      severity: 'high',
      details: {
        calculated: calculatedUnpaidAmount.toFixed(2),
        reported: parseFloat(unpaidAmount).toFixed(2),
        discrepancy: unpaidDiscrepancy.toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
    result.summary.failedChecks++;
    result.isValid = false;
  } else {
    result.summary.passedChecks++;
  }

  // 记录计算详情
  result.details.calculations = {
    totalFee: {
      calculated: calculatedTotalFee.toFixed(2),
      reported: parseFloat(totalFee).toFixed(2),
      discrepancy: feeDiscrepancy.toFixed(2),
      isValid: feeDiscrepancy <= tolerance
    },
    paidAmount: {
      calculated: calculatedPaidAmount.toFixed(2),
      reported: parseFloat(totalPaidAmount).toFixed(2),
      discrepancy: paidDiscrepancy.toFixed(2),
      isValid: paidDiscrepancy <= tolerance
    },
    unpaidAmount: {
      calculated: calculatedUnpaidAmount.toFixed(2),
      reported: parseFloat(unpaidAmount).toFixed(2),
      discrepancy: unpaidDiscrepancy.toFixed(2),
      isValid: unpaidDiscrepancy <= tolerance
    }
  };
}

/**
 * 业务逻辑一致性验证
 */
function validateBusinessLogic(data, result) {
  const { totalFee, totalPaidAmount, detailedItems } = data;

  // 检查负数金额
  result.summary.totalChecks++;
  
  const negativeAmounts = [
    { name: '总金额', value: parseFloat(totalFee) },
    { name: '已付金额', value: parseFloat(totalPaidAmount) }
  ].filter(item => item.value < 0);

  if (negativeAmounts.length > 0) {
    result.warnings.push({
      code: 'NEGATIVE_AMOUNTS',
      message: `发现负数金额`,
      severity: 'medium',
      details: negativeAmounts,
      timestamp: new Date().toISOString()
    });
    result.summary.warningChecks++;
  } else {
    result.summary.passedChecks++;
  }

  // 检查超额支付
  result.summary.totalChecks++;
  
  if (parseFloat(totalPaidAmount) > parseFloat(totalFee) * 1.1) { // 允许10%的超额支付
    result.warnings.push({
      code: 'OVERPAYMENT',
      message: `已付金额超过总金额较多`,
      severity: 'medium',
      details: {
        totalFee: parseFloat(totalFee).toFixed(2),
        paidAmount: parseFloat(totalPaidAmount).toFixed(2),
        overpayment: (parseFloat(totalPaidAmount) - parseFloat(totalFee)).toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
    result.summary.warningChecks++;
  } else {
    result.summary.passedChecks++;
  }

  // 检查订单数据一致性
  result.summary.totalChecks++;
  
  const orderGroups = {};
  detailedItems.forEach(item => {
    const key = `${item.orderType}_${item.orderId}`;
    if (!orderGroups[key]) {
      orderGroups[key] = [];
    }
    orderGroups[key].push(item);
  });

  const inconsistentOrders = Object.entries(orderGroups).filter(([key, items]) => {
    if (items.length <= 1) return false;
    
    const firstItem = items[0];
    return items.some(item => 
      item.orderNo !== firstItem.orderNo ||
      item.orderDate !== firstItem.orderDate ||
      (item.orderType === 'receive' && item.orderFee !== firstItem.orderFee)
    );
  });

  if (inconsistentOrders.length > 0) {
    result.warnings.push({
      code: 'INCONSISTENT_ORDERS',
      message: `发现${inconsistentOrders.length}个订单的明细数据不一致`,
      severity: 'medium',
      details: inconsistentOrders.slice(0, 3).map(([key]) => key),
      timestamp: new Date().toISOString()
    });
    result.summary.warningChecks++;
  } else {
    result.summary.passedChecks++;
  }
}

/**
 * 异常数据检测
 */
function detectAnomalies(data, result) {
  const { detailedItems, totalFee, totalPaidAmount } = data;

  // 检测异常大额订单
  result.summary.totalChecks++;
  
  const receiveItems = detailedItems.filter(item => item.orderType === 'receive');
  const amounts = receiveItems.map(item => parseFloat(item.orderFee || 0));
  
  if (amounts.length > 0) {
    const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);
    
    // 如果最大金额超过平均金额的5倍，标记为异常
    if (maxAmount > avgAmount * 5 && maxAmount > 1000) {
      result.warnings.push({
        code: 'LARGE_AMOUNT_ANOMALY',
        message: `发现异常大额订单`,
        severity: 'medium',
        details: {
          maxAmount: maxAmount.toFixed(2),
          avgAmount: avgAmount.toFixed(2),
          ratio: (maxAmount / avgAmount).toFixed(2)
        },
        timestamp: new Date().toISOString()
      });
      result.summary.warningChecks++;
    } else {
      result.summary.passedChecks++;
    }
  } else {
    result.summary.passedChecks++;
  }

  // 检测支付比例异常
  result.summary.totalChecks++;
  
  const paymentRatio = parseFloat(totalPaidAmount) / parseFloat(totalFee);
  
  if (paymentRatio > 1.2) { // 支付超过120%
    result.warnings.push({
      code: 'HIGH_PAYMENT_RATIO',
      message: `支付比例异常偏高`,
      severity: 'medium',
      details: {
        paymentRatio: (paymentRatio * 100).toFixed(1) + '%',
        totalFee: parseFloat(totalFee).toFixed(2),
        paidAmount: parseFloat(totalPaidAmount).toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
    result.summary.warningChecks++;
  } else if (paymentRatio < 0.1 && parseFloat(totalFee) > 100) { // 支付低于10%且总额大于100
    result.warnings.push({
      code: 'LOW_PAYMENT_RATIO',
      message: `支付比例异常偏低`,
      severity: 'low',
      details: {
        paymentRatio: (paymentRatio * 100).toFixed(1) + '%',
        totalFee: parseFloat(totalFee).toFixed(2),
        paidAmount: parseFloat(totalPaidAmount).toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
    result.summary.warningChecks++;
  } else {
    result.summary.passedChecks++;
  }
}

/**
 * 风险评估
 */
function assessRisk(result) {
  const { errors, warnings } = result;
  
  let riskScore = 0;
  
  // 错误权重
  errors.forEach(error => {
    switch (error.severity) {
      case 'critical': riskScore += 100; break;
      case 'high': riskScore += 50; break;
      case 'medium': riskScore += 20; break;
      case 'low': riskScore += 5; break;
    }
  });
  
  // 警告权重
  warnings.forEach(warning => {
    switch (warning.severity) {
      case 'high': riskScore += 25; break;
      case 'medium': riskScore += 10; break;
      case 'low': riskScore += 2; break;
    }
  });
  
  // 确定风险等级
  if (riskScore >= 100) {
    result.riskLevel = 'critical';
  } else if (riskScore >= 50) {
    result.riskLevel = 'high';
  } else if (riskScore >= 20) {
    result.riskLevel = 'medium';
  } else {
    result.riskLevel = 'low';
  }
  
  result.riskScore = riskScore;
}

/**
 * 生成审计日志
 */
function generateAuditLog(data, result) {
  const { factoryName, startDate, endDate, orgId } = data;
  
  result.auditLog.push({
    action: 'FINANCIAL_VALIDATION',
    orgId: orgId,
    factoryName: factoryName,
    period: `${startDate} - ${endDate}`,
    result: {
      isValid: result.isValid,
      riskLevel: result.riskLevel,
      errorCount: result.errors.length,
      warningCount: result.warnings.length
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * 计算验证统计
 */
function calculateValidationStats(result) {
  const { summary } = result;
  
  summary.successRate = summary.totalChecks > 0 ? 
    ((summary.passedChecks / summary.totalChecks) * 100).toFixed(1) + '%' : '0%';
  
  summary.failureRate = summary.totalChecks > 0 ? 
    ((summary.failedChecks / summary.totalChecks) * 100).toFixed(1) + '%' : '0%';
  
  summary.warningRate = summary.totalChecks > 0 ? 
    ((summary.warningChecks / summary.totalChecks) * 100).toFixed(1) + '%' : '0%';
}

module.exports = {
  validateFinancialData
}; 