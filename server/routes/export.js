const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Excel导出API
router.post('/excel', async (req, res) => {
  try {
    // 验证用户认证和组织权限
    if (!req.user || !req.user.orgId) {
      return res.status(401).json({ 
        success: false, 
        message: '认证失败或缺少组织信息' 
      });
    }

    const { basicInfo, summary, productSummary, paymentSummary, paymentRecords, orderDetails } = req.body;
    
    if (!basicInfo) {
      return res.status(400).json({ success: false, message: '缺少基本信息' });
    }

    console.log(`用户 ${req.user.username} (组织ID: ${req.user.orgId}) 请求导出Excel对账单`);

    // 创建Excel工作簿
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '云收发管理系统';
    workbook.created = new Date();
    
    // 创建工作表
    const worksheet = workbook.addWorksheet('工厂对账单', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait',
        margins: {
          left: 0.7,
          right: 0.7,
          top: 0.75,
          bottom: 0.75,
          header: 0.3,
          footer: 0.3
        }
      }
    });

    // 设置列宽 - 优化为11列，增加支付金额列宽度
    worksheet.columns = [
      { width: 8 },  // A - 类型
      { width: 18 }, // B - 单号
      { width: 12 }, // C - 日期
      { width: 12 }, // D - 工序
      { width: 8 },  // E - 数量
      { width: 10 }, // F - 重量
      { width: 10 }, // G - 工价
      { width: 12 }, // H - 金额
      { width: 15 }, // I - 支付金额（增加宽度）
      { width: 15 }, // J - 支付方式（增加宽度）
      { width: 15 }  // K - 备注
    ];

    let currentRow = 1;

    // 1. 标题部分
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = `${basicInfo.companyName}收发对账单`;
    titleCell.font = { size: 20, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 2;

    // 2. 基本信息
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = `工厂：${basicInfo.factoryName}`;
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    
    worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
    worksheet.getCell(`E${currentRow}`).value = `统计期间：${basicInfo.dateRange}`;
    
    worksheet.mergeCells(`H${currentRow}:K${currentRow}`);
    worksheet.getCell(`H${currentRow}`).value = `生成时间：${basicInfo.generateTime}`;
    currentRow += 2;

    // 3. 对账摘要部分
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const summaryTitleCell = worksheet.getCell(`A${currentRow}`);
    summaryTitleCell.value = '对账摘要';
    summaryTitleCell.font = { size: 16, bold: true };
    summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
    currentRow++;

    // 摘要表头
    const summaryHeaders = ['项目', '单据数量', '数量/重量', '金额'];
    summaryHeaders.forEach((header, index) => {
      const colLetter = String.fromCharCode(65 + index * 2 + 1); // B, D, F, H
      if (index === 0) {
        worksheet.getCell(`A${currentRow}`).value = header;
      } else {
        worksheet.mergeCells(`${colLetter}${currentRow}:${String.fromCharCode(colLetter.charCodeAt(0) + 1)}${currentRow}`);
        worksheet.getCell(`${colLetter}${currentRow}`).value = header;
      }
      worksheet.getCell(index === 0 ? `A${currentRow}` : `${colLetter}${currentRow}`).font = { bold: true };
      worksheet.getCell(index === 0 ? `A${currentRow}` : `${colLetter}${currentRow}`).fill = { 
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } 
      };
    });
    currentRow++;

    // 摘要数据行
    const summaryRows = [
      {
        name: summary.sendSummary.title,
        count: `${summary.sendSummary.orderCount}单`,
        quantity: `${summary.sendSummary.weight}kg`,
        amount: '-'
      },
      {
        name: summary.receiveSummary.title,
        count: `${summary.receiveSummary.orderCount}单`,
        quantity: `${summary.receiveSummary.weight}kg`,
        amount: '-'
      },
      {
        name: summary.lossSummary.title,
        count: `${summary.lossSummary.productTypes}种货品`,
        quantity: `损耗${summary.lossSummary.lossWeight}kg`,
        amount: `损耗率${summary.lossSummary.lossRate}`
      },
      {
        name: summary.financialSummary.title,
        count: '-',
        quantity: `已付款¥${summary.financialSummary.totalPayment}`,
        amount: `结余¥${summary.financialSummary.finalBalance}`
      }
    ];

    summaryRows.forEach((row) => {
      worksheet.getCell(`A${currentRow}`).value = row.name;
      worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
      worksheet.getCell(`B${currentRow}`).value = row.count;
      worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
      worksheet.getCell(`D${currentRow}`).value = row.quantity;
      worksheet.mergeCells(`G${currentRow}:K${currentRow}`);
      worksheet.getCell(`G${currentRow}`).value = row.amount;
      currentRow++;
    });
    currentRow++;

    // 4. 货品汇总部分
    if (productSummary && productSummary.length > 0) {
      worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
      const productTitleCell = worksheet.getCell(`A${currentRow}`);
      productTitleCell.value = `货品汇总 (${productSummary.length}种货品)`;
      productTitleCell.font = { size: 16, bold: true };
      productTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAEBCD' } };
      currentRow++;

      // 货品汇总表头
      const productHeaders = ['货品编号', '货品名称', '工序', '发出数量(打)', '发出重量', '收回数量(打)', '收回重量', '损耗率'];
      productHeaders.forEach((header, index) => {
        const colLetter = String.fromCharCode(65 + index);
        worksheet.getCell(`${colLetter}${currentRow}`).value = header;
        worksheet.getCell(`${colLetter}${currentRow}`).font = { bold: true };
        worksheet.getCell(`${colLetter}${currentRow}`).fill = { 
          type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } 
        };
      });
      currentRow++;

      // 货品数据
      productSummary.forEach((product) => {
        worksheet.getCell(`A${currentRow}`).value = product.productNo;
        worksheet.getCell(`B${currentRow}`).value = product.name;
        worksheet.getCell(`C${currentRow}`).value = product.process;
        worksheet.getCell(`D${currentRow}`).value = product.sendQuantity;
        worksheet.getCell(`E${currentRow}`).value = product.sendWeight;
        worksheet.getCell(`F${currentRow}`).value = product.receiveQuantity;
        worksheet.getCell(`G${currentRow}`).value = product.receiveWeight;
        worksheet.getCell(`H${currentRow}`).value = product.lossRate + '%';
        
        // 损耗率超过5%标红
        if (parseFloat(product.lossRate) > 5) {
          worksheet.getCell(`H${currentRow}`).font = { color: { argb: 'FFFF0000' }, bold: true };
        }
        currentRow++;
      });
      currentRow++;
    }

    // 5. 结算支付明细
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const paymentTitleCell = worksheet.getCell(`A${currentRow}`);
    paymentTitleCell.value = '结算支付明细';
    paymentTitleCell.font = { size: 16, bold: true };
    paymentTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } };
    currentRow++;

    // 支付汇总
    const paymentSummaryData = [
      ['总金额(¥)', '已支付(¥)', '结余(¥)'],
      [paymentSummary.totalAmount, paymentSummary.totalPayment, paymentSummary.finalBalance]
    ];

    paymentSummaryData.forEach((rowData, rowIndex) => {
      rowData.forEach((value, colIndex) => {
        const colStart = String.fromCharCode(65 + colIndex * 3);
        const colEnd = String.fromCharCode(65 + colIndex * 3 + 2);
        worksheet.mergeCells(`${colStart}${currentRow}:${colEnd}${currentRow}`);
        const cell = worksheet.getCell(`${colStart}${currentRow}`);
        cell.value = value;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        if (rowIndex === 0) {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
        } else if (colIndex === 2) {
          // 结余金额根据正负显示颜色
          cell.font = { color: { argb: parseFloat(value) > 0 ? 'FFFF0000' : 'FF008000' } };
        }
      });
      currentRow++;
    });
    currentRow++;

    // 6. 付款记录明细
    if (paymentRecords && paymentRecords.length > 0) {
      worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
      const recordTitleCell = worksheet.getCell(`A${currentRow}`);
      recordTitleCell.value = `付款记录明细 (${paymentRecords.length}笔)`;
      recordTitleCell.font = { size: 14, bold: true };
      currentRow++;

      // 付款记录表头
      const recordHeaders = ['付款日期', '付款金额', '支付方式', '来源', '备注'];
      recordHeaders.forEach((header, index) => {
        const colLetter = String.fromCharCode(65 + index * 2);
        worksheet.mergeCells(`${colLetter}${currentRow}:${String.fromCharCode(colLetter.charCodeAt(0) + 1)}${currentRow}`);
        worksheet.getCell(`${colLetter}${currentRow}`).value = header;
        worksheet.getCell(`${colLetter}${currentRow}`).font = { bold: true };
        worksheet.getCell(`${colLetter}${currentRow}`).fill = { 
          type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } 
        };
      });
      currentRow++;

      // 付款记录数据
      paymentRecords.forEach((record) => {
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = record.date;
        worksheet.mergeCells(`C${currentRow}:D${currentRow}`);
        worksheet.getCell(`C${currentRow}`).value = record.amount;
        worksheet.mergeCells(`E${currentRow}:F${currentRow}`);
        worksheet.getCell(`E${currentRow}`).value = record.method;
        worksheet.mergeCells(`G${currentRow}:H${currentRow}`);
        worksheet.getCell(`G${currentRow}`).value = record.source;
        worksheet.mergeCells(`I${currentRow}:J${currentRow}`);
        worksheet.getCell(`I${currentRow}`).value = record.remark;
        currentRow++;
      });
      currentRow++;
    }

    // 7. 收发明细表格
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const orderTitleCell = worksheet.getCell(`A${currentRow}`);
    orderTitleCell.value = `收发明细 (共${basicInfo.totalRecords}条记录)`;
    orderTitleCell.font = { size: 16, bold: true };
    orderTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E1' } };
    currentRow++;

    // 收发明细表头 - 添加支付金额列
    const orderHeaders = ['类型', '单号', '日期', '工序', '数量(打)', '重量', '工价', '金额', '支付金额', '支付方式', '备注'];
    orderHeaders.forEach((header, index) => {
      const colLetter = String.fromCharCode(65 + index);
      worksheet.getCell(`${colLetter}${currentRow}`).value = header;
      worksheet.getCell(`${colLetter}${currentRow}`).font = { bold: true };
      worksheet.getCell(`${colLetter}${currentRow}`).fill = { 
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } 
      };
    });
    currentRow++;

    // 收发明细数据 - 添加支付金额列
    orderDetails.forEach((order, index) => {
      worksheet.getCell(`A${currentRow}`).value = order.type;
      worksheet.getCell(`B${currentRow}`).value = order.orderNo;
      worksheet.getCell(`C${currentRow}`).value = order.date;
      worksheet.getCell(`D${currentRow}`).value = order.process;
      worksheet.getCell(`E${currentRow}`).value = order.quantity;
      worksheet.getCell(`F${currentRow}`).value = order.weight;
      worksheet.getCell(`G${currentRow}`).value = order.unitPrice;
      worksheet.getCell(`H${currentRow}`).value = order.totalAmount;
      
      // 支付金额列处理 - 确保正确显示
      let paymentAmountValue = '';
      if (order.paymentAmount !== undefined && order.paymentAmount !== null && order.paymentAmount !== '') {
        if (parseFloat(order.paymentAmount) > 0) {
          paymentAmountValue = parseFloat(order.paymentAmount).toFixed(2);
        } else {
          paymentAmountValue = order.type === '收回' ? '0.00' : '-';
        }
      } else {
        paymentAmountValue = order.type === '收回' ? '0.00' : '-';
      }
      worksheet.getCell(`I${currentRow}`).value = paymentAmountValue;
      
      worksheet.getCell(`J${currentRow}`).value = order.paymentMethod;
      worksheet.getCell(`K${currentRow}`).value = order.remark;

      // 发出和收回用不同颜色
      if (order.type === '发出') {
        worksheet.getCell(`A${currentRow}`).font = { color: { argb: 'FF007AFF' } };
      } else {
        worksheet.getCell(`A${currentRow}`).font = { color: { argb: 'FFFF9500' } };
        // 收回单的支付金额用绿色显示
        if (paymentAmountValue && paymentAmountValue !== '-' && parseFloat(paymentAmountValue) > 0) {
          worksheet.getCell(`I${currentRow}`).font = { color: { argb: 'FF34C759' }, bold: true };
        }
      }

      // 隔行变色
      if (index % 2 === 1) {
        for (let col = 0; col < 11; col++) {
          const colLetter = String.fromCharCode(65 + col);
          worksheet.getCell(`${colLetter}${currentRow}`).fill = { 
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFBFC' } 
          };
        }
      }
      currentRow++;
    });

    // 添加边框到所有使用的单元格
    for (let row = 1; row <= currentRow - 1; row++) {
      for (let col = 1; col <= 11; col++) {
        const cell = worksheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }

    // 自动调整列宽以确保内容显示完整
    worksheet.columns.forEach((column, index) => {
      let maxLength = 0;
      const columnLetter = String.fromCharCode(65 + index);
      
      // 遍历该列的所有单元格，找到最长的内容
      for (let row = 1; row <= currentRow - 1; row++) {
        const cell = worksheet.getCell(`${columnLetter}${row}`);
        if (cell.value) {
          const cellLength = cell.value.toString().length;
          if (cellLength > maxLength) {
            maxLength = cellLength;
          }
        }
      }
      
      // 设置最小宽度和最大宽度限制
      const minWidth = column.width || 8;
      const maxWidth = 25;
      const calculatedWidth = Math.max(minWidth, Math.min(maxWidth, maxLength + 2));
      
      column.width = calculatedWidth;
    });

    // 生成临时文件
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 文件名包含组织ID，确保数据隔离
    const fileName = `对账单_org${req.user.orgId}_${crypto.randomBytes(8).toString('hex')}.xlsx`;
    const filePath = path.join(tempDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    // 返回下载链接
    const downloadUrl = `https://aiyunsf.com/api/export/download/${fileName}`;
    
    console.log(`组织 ${req.user.orgId} 的Excel文件生成成功: ${fileName}`);
    
    res.json({
      success: true,
      message: '导出成功',
      downloadUrl,
      fileName
    });

  } catch (error) {
    console.error('Excel导出失败:', error);
    res.status(500).json({
      success: false,
      message: '导出失败，请稍后重试'
    });
  }
});

// 文件下载API
router.get('/download/:fileName', (req, res) => {
  try {
    // 验证用户认证
    if (!req.user || !req.user.orgId) {
      return res.status(401).json({ 
        success: false, 
        message: '认证失败，无法下载文件' 
      });
    }

    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, '..', 'temp', fileName);
    
    console.log(`用户 ${req.user.username} (组织ID: ${req.user.orgId}) 请求下载文件: ${fileName}`);
    
    // 验证文件名中的组织ID，确保数据隔离
    const orgPattern = new RegExp(`对账单_org${req.user.orgId}_[a-f0-9]+\\.xlsx$`);
    if (!orgPattern.test(fileName)) {
      console.warn(`用户 ${req.user.username} 尝试下载非本组织文件: ${fileName}`);
      return res.status(403).json({ 
        success: false, 
        message: '无权访问该文件' 
      });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    // 创建读取流并管道到响应
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // 文件发送完成后删除临时文件
    fileStream.on('end', () => {
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }, 5000); // 5秒后删除
    });

  } catch (error) {
    console.error('文件下载失败:', error);
    res.status(500).json({ success: false, message: '下载失败' });
  }
});

module.exports = router; 