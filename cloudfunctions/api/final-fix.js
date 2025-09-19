const fs = require('fs')
const path = require('path')

function fixApiResponseSyntax(content) {
  let fixed = content
  
  // 修复 totalPages: Math.ceil(countResult.total / limit), '操作成功')
  fixed = fixed.replace(
    /(totalPages:\s*Math\.ceil\([^)]+\)),\s*'操作成功'\)/g,
    '$1\n      }, \'操作成功\')'
  )
  
  // 修复 message: '心跳成功', '操作成功')
  fixed = fixed.replace(
    /(message:\s*'[^']+'),\s*'操作成功'\)/g,
    '$1\n      }, \'操作成功\')'
  )
  
  // 修复 ...sizeData, '操作成功')
  fixed = fixed.replace(
    /(\.\.\.\w+Data),\s*'操作成功'\)/g,
    '$1\n      }, \'操作成功\')'
  )
  
  // 修复 ...factoryData, '操作成功')
  fixed = fixed.replace(
    /(\.\.\.factoryData),\s*'操作成功'\)/g,
    '$1\n      }, \'操作成功\')'
  )
  
  // 修复 ...orgData, '操作成功')
  fixed = fixed.replace(
    /(\.\.\.orgData),\s*'操作成功'\)/g,
    '$1\n      }, \'操作成功\')'
  )
  
  // 修复 ...processData, '操作成功')
  fixed = fixed.replace(
    /(\.\.\.processData),\s*'操作成功'\)/g,
    '$1\n      }, \'操作成功\')'
  )
  
  // 修复 totalQuantity, '操作成功')
  fixed = fixed.replace(
    /(totalQuantity),\s*'操作成功'\)/g,
    '$1\n      }, \'操作成功\')'
  )
  
  // 修复缺少的右括号问题
  fixed = fixed.replace(
    /(\s+}\s*)$/gm,
    '$1'
  )
  
  return fixed
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const fixed = fixApiResponseSyntax(content)
    
    if (content !== fixed) {
      fs.writeFileSync(filePath, fixed, 'utf8')
      console.log(`✓ 修复了 ${path.basename(filePath)} 的语法错误`)
    } else {
      console.log(`- ${path.basename(filePath)} 无需修复`)
    }
  } catch (error) {
    console.error(`✗ 处理 ${path.basename(filePath)} 时出错:`, error.message)
  }
}

// 处理所有 handlers 文件
const handlersDir = path.join(__dirname, 'handlers')
const files = fs.readdirSync(handlersDir)
  .filter(file => file.endsWith('.js'))
  .map(file => path.join(handlersDir, file))

console.log('开始修复语法错误...')
files.forEach(processFile)
console.log('修复完成！')

// 只检查语法，不加载模块
console.log('\n验证修复结果...')
const { spawn } = require('child_process')

files.forEach(filePath => {
  try {
    const result = spawn('node', ['-c', filePath], { stdio: 'pipe' })
    result.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ ${path.basename(filePath)} 语法正确`)
      } else {
        console.error(`✗ ${path.basename(filePath)} 仍有语法错误`)
      }
    })
  } catch (error) {
    console.error(`✗ 检查 ${path.basename(filePath)} 时出错:`, error.message)
  }
})