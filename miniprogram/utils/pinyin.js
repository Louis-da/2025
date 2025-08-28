/**
 * 拼音首字母匹配工具
 * 用于工厂名称搜索
 */

// 拼音首字母映射表（常用汉字）
const pinyinMap = {
  'a': '阿啊哎唉埃',
  'b': '八百白败拜班般板版办半帮包保报抱背北被本比必变别宾不步部',
  'c': '才材财采参餐残产长常场厂车称成城承程吃持出初除处传创春词此次',
  'd': '大带待代当到道的得地第点电调定东动都度对多',
  'e': '二而',
  'f': '发法反方防放费分风服福府富父',
  'g': '该改干感刚高告个给根跟工公共关管广规国过',
  'h': '还海行好合和很后护花华化话怀环回会活货',
  'j': '机积基及极集几技记际继加家价间简建江交叫教接结解进今金经九就局举具',
  'k': '开看可科空口',
  'l': '来老了理离力立利联连量料六龙楼路论',
  'm': '马买卖满慢忙么没美每门面民明名',
  'n': '那内能你年女',
  'p': '排盘片平品',
  'q': '其期七起气千前钱强青清情请去全权群',
  'r': '人日如',
  's': '三色山商上设施时实使始是事手受数说思司四送',
  't': '他她它台太田天条听通同头图土',
  'w': '外完万王为位文我无五物',
  'x': '西系下先现线小新心信星行学许',
  'y': '要也一医以用友有又于预月',
  'z': '在早造则怎增张章长着这正之只中重主住注子作做'
};

/**
 * 获取汉字的拼音首字母
 * @param {string} str 汉字字符串
 * @returns {string} 拼音首字母
 */
function getFirstLetter(str) {
  if (!str) return '';
  
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str.charAt(i);
    
    // 如果是英文字母，直接转为小写
    if (/[a-zA-Z]/.test(char)) {
      result += char.toLowerCase();
      continue;
    }
    
    // 如果是数字，直接添加
    if (/[0-9]/.test(char)) {
      result += char;
      continue;
    }
    
    // 查找汉字对应的拼音首字母
    let found = false;
    for (const letter in pinyinMap) {
      if (pinyinMap[letter].indexOf(char) !== -1) {
        result += letter;
        found = true;
        break;
      }
    }
    
    // 如果没找到，跳过该字符
    if (!found) {
      // console.log('未找到字符的拼音:', char);
    }
  }
  
  return result;
}

/**
 * 搜索匹配函数
 * @param {string} keyword 搜索关键词
 * @param {string} text 被搜索的文本
 * @returns {boolean} 是否匹配
 */
function searchMatch(keyword, text) {
  if (!keyword || !text) return true;
  
  const keywordLower = keyword.toLowerCase().trim();
  const textLower = text.toLowerCase();
  
  // 1. 直接包含匹配（中文或英文）
  if (textLower.includes(keywordLower)) {
    return true;
  }
  
  // 2. 拼音首字母匹配
  const textPinyin = getFirstLetter(text);
  if (textPinyin.includes(keywordLower)) {
    return true;
  }
  
  // 3. 模糊匹配（关键词的每个字符都在文本中出现）
  let textIndex = 0;
  for (let i = 0; i < keywordLower.length; i++) {
    const char = keywordLower[i];
    const foundIndex = textLower.indexOf(char, textIndex);
    if (foundIndex === -1) {
      return false;
    }
    textIndex = foundIndex + 1;
  }
  
  return true;
}

module.exports = {
  getFirstLetter,
  searchMatch
}; 