const fs = require('fs');
const path = require('path');

// 修复语法错误的函数
function fixSyntaxErrors(content) {
  let fixed = content;
  
  // 修复 ApiResponse.success({ id, ...updateData , '操作成功') 类型的错误
  fixed = fixed.replace(/ApiResponse\.success\(\{([^}]+)\s*,\s*'操作成功'\)/g, 
    "ApiResponse.success({$1}, '操作成功')");
  
  // 修复 limit: parseInt(limit), '操作成功') 类型的错误
  fixed = fixed.replace(/(\w+:\s*[^,}]+),\s*'操作成功'\)/g, 
    "$1}, '操作成功')");
  
  // 修复 , '操作成功') 前面缺少右括号的情况
  fixed = fixed.replace(/([^}])\s*,\s*'操作成功'\)/g, 
    "$1}, '操作成功')");
  
  // 修复 ApiResponse.success({ id , '操作成功') 类型的错误
  fixed = fixed.replace(/ApiResponse\.success\(\{([^}]+?)\s*,\s*'操作成功'\)/g, 
    "ApiResponse.success({$1}, '操作成功')");
  
  // 修复多层嵌套的括号问题
  fixed = fixed.replace(/ApiResponse\.success\(([^{]*\{[^}]*)}\s*}\s*,\s*'操作成功'\)/g, 
    "ApiResponse.success($1}, '操作成功')");
  
  return fixed;
}

// 处理handlers目录下的所有JS文件
const handlersDir = path.join(__dirname, 'handlers');
const files = fs.readdirSync(handlersDir).filter(file => file.endsWith('.js'));

console.log('开始修复语法错误...');

files.forEach(file => {
  const filePath = path.join(handlersDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const fixedContent = fixSyntaxErrors(content);
  
  if (content !== fixedContent) {
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log(`✓ 修复了 ${file}`);
  } else {
    console.log(`- ${file} 无需修复`);
  }
});

console.log('语法修复完成!');

// 验证修复结果
console.log('\n验证修复结果:');
files.forEach(file => {
  const filePath = path.join(handlersDir, file);
  try {
    require(filePath);
    console.log(`✓ ${file} 语法正确`);
  } catch (e) {
    console.log(`✗ ${file} 仍有语法错误: ${e.message}`);
  }
});