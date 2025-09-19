// API标准化更新脚本
// 用于批量更新所有处理函数文件，确保使用统一的API响应格式

const fs = require('fs')
const path = require('path')

/**
 * 需要更新的响应格式映射
 */
const responsePatterns = [
  // 成功响应格式
  {
    pattern: /return\s*{\s*success:\s*true,\s*data:\s*([^}]+)\s*}/g,
    replacement: 'return ApiResponse.success($1, \'操作成功\')'
  },
  {
    pattern: /return\s*{\s*success:\s*true,\s*message:\s*['"]([^'"]+)['"],\s*data:\s*([^}]+)\s*}/g,
    replacement: 'return ApiResponse.success($2, \'$1\')'
  },
  
  // 错误响应格式
  {
    pattern: /return\s*{\s*success:\s*false,\s*error:\s*['"]([^'"]+)['"]\s*}/g,
    replacement: 'return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, \'$1\')'
  },
  {
    pattern: /return\s*createErrorResponse\(ErrorTypes\.([A-Z_]+),\s*['"]([^'"]+)['"]\)/g,
    replacement: 'return ApiResponse.error(BusinessErrorCodes.$1_ERROR, \'$2\')'
  },
  {
    pattern: /return\s*createSuccessResponse\(([^)]+)\)/g,
    replacement: 'return ApiResponse.success($1)'
  },
  
  // 分页响应格式
  {
    pattern: /return\s*{\s*success:\s*true,\s*data:\s*{\s*([a-zA-Z_]+):\s*([^,]+),\s*total:\s*([^,]+),\s*page:\s*([^,]+),\s*limit:\s*([^}]+)\s*}\s*}/g,
    replacement: 'return ApiResponse.paginated($2, $3, $4, $5)'
  }
]

/**
 * 需要添加的导入语句
 */
const requiredImports = [
  "const { ApiResponse, BusinessErrorCodes } = require('../config/apiStandards')"
]

/**
 * 错误码映射
 */
const errorCodeMapping = {
  'VALIDATION': 'INVALID_PARAMETER',
  'DATABASE': 'DATABASE_ERROR',
  'AUTHENTICATION': 'UNAUTHORIZED',
  'AUTHORIZATION': 'FORBIDDEN',
  'NOT_FOUND': 'RESOURCE_NOT_FOUND',
  'DUPLICATE': 'DUPLICATE_RESOURCE',
  'RATE_LIMIT': 'RATE_LIMIT_EXCEEDED'
}

/**
 * 更新单个文件
 * @param {string} filePath 文件路径
 * @returns {Promise<Object>} 更新结果
 */
async function updateFile(filePath) {
  try {
    console.log(`正在更新文件: ${filePath}`)
    
    let content = fs.readFileSync(filePath, 'utf8')
    let modified = false
    
    // 检查是否已经导入了API标准
    const hasApiStandardsImport = content.includes('ApiResponse') || content.includes('BusinessErrorCodes')
    
    // 添加必要的导入语句
    if (!hasApiStandardsImport) {
      const importIndex = content.indexOf('} = require(\'../utils/common\')')
      if (importIndex !== -1) {
        const insertPoint = importIndex + '} = require(\'../utils/common\')'.length
        content = content.slice(0, insertPoint) + 
                 '\nconst { ApiResponse, BusinessErrorCodes } = require(\'../config/apiStandards\')' + 
                 content.slice(insertPoint)
        modified = true
      }
    }
    
    // 应用响应格式更新
    let updateCount = 0
    for (const { pattern, replacement } of responsePatterns) {
      const matches = content.match(pattern)
      if (matches) {
        content = content.replace(pattern, replacement)
        updateCount += matches.length
        modified = true
      }
    }
    
    // 更新错误码
    for (const [oldCode, newCode] of Object.entries(errorCodeMapping)) {
      const oldPattern = new RegExp(`ErrorTypes\.${oldCode}`, 'g')
      if (oldPattern.test(content)) {
        content = content.replace(oldPattern, `BusinessErrorCodes.${newCode}`)
        modified = true
        updateCount++
      }
    }
    
    // 写入更新后的内容
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8')
      console.log(`✓ 文件更新成功: ${path.basename(filePath)} (${updateCount} 处更改)`)
      return {
        success: true,
        file: path.basename(filePath),
        changes: updateCount,
        modified: true
      }
    } else {
      console.log(`- 文件无需更新: ${path.basename(filePath)}`)
      return {
        success: true,
        file: path.basename(filePath),
        changes: 0,
        modified: false
      }
    }
    
  } catch (error) {
    console.error(`✗ 更新文件失败: ${filePath}`, error.message)
    return {
      success: false,
      file: path.basename(filePath),
      error: error.message
    }
  }
}

/**
 * 获取所有处理函数文件
 * @param {string} handlersDir 处理函数目录
 * @returns {Array<string>} 文件路径列表
 */
function getHandlerFiles(handlersDir) {
  try {
    const files = fs.readdirSync(handlersDir)
    return files
      .filter(file => file.endsWith('.js') && file.includes('Handler'))
      .map(file => path.join(handlersDir, file))
  } catch (error) {
    console.error('读取处理函数目录失败:', error.message)
    return []
  }
}

/**
 * 验证API响应格式
 * @param {string} filePath 文件路径
 * @returns {Object} 验证结果
 */
function validateApiFormat(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const issues = []
    
    // 检查是否还有旧的响应格式
    const oldPatterns = [
      /return\s*{\s*success:\s*(true|false)/g,
      /createErrorResponse\(/g,
      /createSuccessResponse\(/g,
      /ErrorTypes\./g
    ]
    
    oldPatterns.forEach((pattern, index) => {
      const matches = content.match(pattern)
      if (matches) {
        issues.push({
          type: ['旧成功/错误格式', '旧错误响应', '旧成功响应', '旧错误类型'][index],
          count: matches.length,
          examples: matches.slice(0, 3)
        })
      }
    })
    
    // 检查是否使用了新的API标准
    const hasNewFormat = content.includes('ApiResponse.') && content.includes('BusinessErrorCodes.')
    
    return {
      file: path.basename(filePath),
      hasNewFormat,
      issues,
      isCompliant: issues.length === 0 && hasNewFormat
    }
    
  } catch (error) {
    return {
      file: path.basename(filePath),
      error: error.message,
      isCompliant: false
    }
  }
}

/**
 * 主函数 - 批量更新API标准
 */
async function main() {
  console.log('=== API标准化更新开始 ===')
  
  const handlersDir = path.join(__dirname, '../handlers')
  const handlerFiles = getHandlerFiles(handlersDir)
  
  if (handlerFiles.length === 0) {
    console.log('未找到处理函数文件')
    return { success: false, error: '未找到处理函数文件' }
  }
  
  console.log(`找到 ${handlerFiles.length} 个处理函数文件`)
  
  // 1. 更新所有文件
  console.log('\n1. 更新API响应格式...')
  const updateResults = []
  
  for (const filePath of handlerFiles) {
    const result = await updateFile(filePath)
    updateResults.push(result)
  }
  
  // 2. 验证更新结果
  console.log('\n2. 验证API格式合规性...')
  const validationResults = []
  
  for (const filePath of handlerFiles) {
    const result = validateApiFormat(filePath)
    validationResults.push(result)
    
    if (result.isCompliant) {
      console.log(`✓ ${result.file} - 格式合规`)
    } else {
      console.log(`✗ ${result.file} - 需要手动检查`)
      if (result.issues) {
        result.issues.forEach(issue => {
          console.log(`  - ${issue.type}: ${issue.count} 处`)
        })
      }
    }
  }
  
  // 3. 生成汇总报告
  const summary = {
    totalFiles: handlerFiles.length,
    updatedFiles: updateResults.filter(r => r.modified).length,
    totalChanges: updateResults.reduce((sum, r) => sum + (r.changes || 0), 0),
    compliantFiles: validationResults.filter(r => r.isCompliant).length,
    failedFiles: updateResults.filter(r => !r.success).length,
    updateResults,
    validationResults
  }
  
  console.log('\n=== 更新汇总 ===')
  console.log(`总文件数: ${summary.totalFiles}`)
  console.log(`已更新文件: ${summary.updatedFiles}`)
  console.log(`总更改数: ${summary.totalChanges}`)
  console.log(`格式合规文件: ${summary.compliantFiles}`)
  console.log(`更新失败文件: ${summary.failedFiles}`)
  
  if (summary.failedFiles > 0) {
    console.log('\n失败的文件:')
    updateResults.filter(r => !r.success).forEach(r => {
      console.log(`- ${r.file}: ${r.error}`)
    })
  }
  
  const needsManualReview = validationResults.filter(r => !r.isCompliant && !r.error)
  if (needsManualReview.length > 0) {
    console.log('\n需要手动检查的文件:')
    needsManualReview.forEach(r => {
      console.log(`- ${r.file}`)
    })
  }
  
  console.log('\n=== API标准化更新完成 ===')
  
  return {
    success: summary.failedFiles === 0,
    summary
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().then(result => {
    console.log('\n脚本执行完成')
    process.exit(result.success ? 0 : 1)
  }).catch(error => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
}

module.exports = {
  updateFile,
  validateApiFormat,
  main
}