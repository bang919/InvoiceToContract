// 发票数据接口
export interface InvoiceData {
  invoiceNumber: string;
  invoiceCode?: string;
  date: string;
  amount: string;
  items: string;
  itemsTable: string;
  fullText: string;
  issuer: string;
  amountInWords?: string;
  buyer?: string;
  buyerTaxID?: string;
  seller?: string;
  sellerTaxID?: string;
  project?: string;
  projectAddress?: string;
  sellerBank?: string;
  sellerBankAccount?: string;
  fileName?: string;
  content?: string;
}

// 商品项目的结构
interface InvoiceItem {
  name: string;       // 项目名称
  spec: string;       // 规格型号
  unit: string;       // 单位
  quantity: string;   // 数量
  price: string;      // 单价
  amount: string;     // 金额
  taxRate: string;    // 税率
  tax: string;        // 税额
}

// 从发票中提取关键信息 - 只使用坐标提取方式
export const extractInvoiceDetails = (text: string, textItems: any[] = []): InvoiceData => {
  // 初始化返回对象
  const details: InvoiceData = {
    invoiceNumber: '',
    date: '',
    amount: '',
    items: '',
    itemsTable: '',
    fullText: text,
    issuer: ''
  };
  
  // 调试日志
  console.log("原始文本用于提取:", text);
  
  // 辅助函数：根据X坐标识别列内容
  const identifyColumnByX = (nameItem: any, sameRowItems: any[]): InvoiceItem => {
    const result: InvoiceItem = {
      name: nameItem.text,
      spec: '',
      unit: '',
      quantity: '',
      price: '',
      amount: '',
      taxRate: '',
      tax: ''
    };
    
    // 根据X坐标位置大致判断各列内容
    sameRowItems.forEach((rowItem) => {
      if (rowItem === nameItem) return; // 跳过名称项本身
      
      // 根据X坐标范围粗略判断列
      if (rowItem.x > 100 && rowItem.x < 150) {
        result.spec = rowItem.text; // 规格型号通常在第二列
      } else if (rowItem.x > 180 && rowItem.x < 220) {
        result.unit = rowItem.text; // 单位通常在第三列
      } else if (rowItem.x > 250 && rowItem.x < 290) {
        result.quantity = rowItem.text; // 数量通常在第四列
      } else if (rowItem.x > 290 && rowItem.x < 380) {
        result.price = rowItem.text; // 单价通常在第五列
      } else if (rowItem.x > 380 && rowItem.x < 450) {
        result.amount = rowItem.text; // 金额通常在第六列
      } else if (rowItem.x > 450 && rowItem.x < 530) {
        result.taxRate = rowItem.text; // 税率通常在第七列
      } else if (rowItem.x > 530) {
        result.tax = rowItem.text; // 税额通常在第八列
      }
    });
    
    return result;
  };
  
  // 辅助函数：找出同一行的文本项
  const findSameRowItems = (allTextItems: any[], itemY: number, yTolerance = 5) => {
    return allTextItems.filter(item => 
      Math.abs(item.y - itemY) <= yTolerance
    ).sort((a, b) => a.x - b.x);
  };
  
  // 辅助函数：检查是否为商品项(不是合计、备注等)
  const isProductItem = (text: string): boolean => {
    const nonProductKeywords = ['合计', '价税', '备注', '工程', '开票'];
    // 不要错误地将电压等级识别为商品项
    const isVoltageLevel = /^\d+\.?\d*\/\d+\.?\d*[KV|kv|Kv|kV]+$/.test(text);
    return !nonProductKeywords.some(keyword => text.includes(keyword)) && !isVoltageLevel;
  };
  
  // 辅助函数：处理可能的续行项（如规格型号或项目名称的下一行内容）
  const processContinuationLines = (allTextItems: any[], rows: InvoiceItem[]) => {
    // 按Y坐标排序所有文本项
    const sortedItems = [...allTextItems].sort((a, b) => a.y - b.y);
    
    // 跟踪已使用的电压等级和续行文本项，避免重复添加
    const usedTextItems: Set<any> = new Set();
    
    // 对每一个已识别的商品项，查找它的下一行是否是续行
    for (let i = 0; i < rows.length; i++) {
      const currentItem = rows[i];
      
      // 查找当前商品项名称对应的文本项
      const nameTextItem = sortedItems.find(item => item.text === currentItem.name);
      if (!nameTextItem) continue;
      
      // 查找可能的续行（Y坐标接近但稍大，X坐标较小的项）
      const potentialContinuations = sortedItems.filter(item => 
        item.y > nameTextItem.y && 
        item.y < nameTextItem.y + 25 && // 降低Y间距以减少错误匹配
        item.x < 100 && // 续行通常在左侧位置
        !isProductItem(item.text) && // 不是另一个商品项
        item.text.length > 0 && // 允许单个字符，因为可能是数字或单位
        !rows.some(r => r.name === item.text) && // 不是已识别的商品项
        !usedTextItems.has(item) // 确保没有被其他项目使用过
      );
      
      // 查找可能的规格型号续行（X坐标在规格型号列范围内）
      const specContinuations = sortedItems.filter(item => 
        item.y > nameTextItem.y && 
        item.y < nameTextItem.y + 25 && // 降低Y间距以减少错误匹配
        item.x > 100 && item.x < 180 && // 规格型号列的X坐标范围
        item.text.length > 0 &&
        !rows.some(r => r.spec === item.text) && // 不是已识别的规格型号
        !usedTextItems.has(item) // 确保没有被其他项目使用过
      );
      
      // 合并项目名称的续行
      if (potentialContinuations.length > 0) {
        // 按Y坐标排序，确保按顺序添加
        potentialContinuations.sort((a, b) => a.y - b.y);
        
        // 将可能的电压等级信息追加到项目名称
        currentItem.name += ' ' + potentialContinuations.map(item => item.text).join(' ');
        // 去除多余空格
        currentItem.name = currentItem.name.replace(/\s+/g, ' ').trim();
        console.log(`合并项目名称续行: ${currentItem.name}`);
        
        // 标记已使用的文本项
        potentialContinuations.forEach(item => usedTextItems.add(item));
      }
      
      // 合并规格型号的续行
      if (specContinuations.length > 0) {
        // 按Y坐标排序，确保按顺序添加
        specContinuations.sort((a, b) => a.y - b.y);
        
        // 将规格型号的续行追加到当前规格型号
        currentItem.spec += ' ' + specContinuations.map(item => item.text).join(' ');
        // 去除多余空格和特殊字符之间的空格
        currentItem.spec = currentItem.spec.replace(/\s+/g, ' ').trim();
        currentItem.spec = currentItem.spec.replace(/(\d+)\s*\*\s*(\d+)/g, '$1*$2');
        console.log(`合并规格型号续行: ${currentItem.spec}`);
        
        // 标记已使用的文本项
        specContinuations.forEach(item => usedTextItems.add(item));
      }
    }
    
    // ===== 改进的电压等级处理逻辑 =====
    console.log("开始匹配电压等级文本项到商品项...");
    
    // 1. 收集所有电压等级文本项
    const voltageItems = sortedItems.filter(item =>
      /^\d+\.?\d*\/\d+\.?\d*[KV|kv|Kv|kV]+$/.test(item.text) && // 匹配电压等级格式(如0.6/1KV)
      !usedTextItems.has(item) // 确保没有被其他项目使用过
    );
    
    console.log(`找到 ${voltageItems.length} 个未匹配的电压等级文本项`);
    
    // 2. 获取所有商品项的名称文本项
    const itemNameTextItems = rows.map(row => {
      return {
        row,
        textItem: sortedItems.find(item => item.text === row.name)
      };
    }).filter(item => item.textItem); // 过滤掉找不到文本项的商品项
    
    // 3. 按Y坐标顺序处理每个电压等级
    voltageItems.sort((a, b) => a.y - b.y);
    
    for (const voltageItem of voltageItems) {
      // 找到这个电压等级之前的最近商品项（Y坐标上最接近的前一个商品项）
      const itemsBeforeVoltage = itemNameTextItems.filter(item => 
        item.textItem.y < voltageItem.y
      );
      
      if (itemsBeforeVoltage.length === 0) continue;
      
      // 按Y坐标距离排序，找出距离电压等级最近的上方商品项
      itemsBeforeVoltage.sort((a, b) => 
        (voltageItem.y - a.textItem.y) - (voltageItem.y - b.textItem.y)
      );
      
      const closestItem = itemsBeforeVoltage[0];
      const distance = voltageItem.y - closestItem.textItem.y;
      
      // 只匹配距离在合理范围内的项（避免错误匹配太远的商品项）
      if (distance < 30) {
        console.log(`匹配电压等级 ${voltageItem.text} 到商品项 "${closestItem.row.name}",` + 
                    ` Y坐标距离: ${distance}`);
        
        // 确保尚未包含电压等级
        if (!closestItem.row.name.includes(voltageItem.text)) {
          closestItem.row.name += ' ' + voltageItem.text;
          closestItem.row.name = closestItem.row.name.replace(/\s+/g, ' ').trim();
          
          // 标记此电压等级已使用
          usedTextItems.add(voltageItem);
        }
      }
    }
    
    // 4. 对同类型商品统一电压等级
    const itemGroups: {[key: string]: InvoiceItem[]} = {};
    
    // 按基本名称（不含电压等级）分组
    for (const row of rows) {
      // 提取基本名称（移除可能的电压等级部分）
      const basicName = row.name.replace(/\s+\d+\.?\d*\/\d+\.?\d*[KV|kv|Kv|kV]+$/, '').trim();
      
      if (!itemGroups[basicName]) {
        itemGroups[basicName] = [];
      }
      itemGroups[basicName].push(row);
    }
    
    // 对每个分组，应用一致的电压等级
    for (const groupName in itemGroups) {
      const group = itemGroups[groupName];
      
      if (group.length <= 1) continue;
      
      // 查找组内任何带有电压等级的项目
      const itemWithVoltage = group.find(item => 
        /\d+\.?\d*\/\d+\.?\d*[KV|kv|Kv|kV]+/.test(item.name)
      );
      
      if (!itemWithVoltage) continue;
      
      // 提取电压等级
      const voltageMatch = itemWithVoltage.name.match(/(\d+\.?\d*\/\d+\.?\d*[KV|kv|Kv|kV]+)/);
      if (!voltageMatch) continue;
      
      const voltage = voltageMatch[1];
      
      // 为组内所有项目统一添加相同的电压等级
      for (const item of group) {
        if (!item.name.includes(voltage)) {
          // 移除可能已有的其他电压等级
          const nameWithoutVoltage = item.name.replace(/\s+\d+\.?\d*\/\d+\.?\d*[KV|kv|Kv|kV]+$/, '').trim();
          item.name = `${nameWithoutVoltage} ${voltage}`;
          console.log(`统一电压等级: ${item.name}`);
        }
      }
    }
    
    return rows;
  };
  
  // 辅助函数：从文本项数组提取商品项
  const extractItemsFromTextItems = (nameItems: any[], allTextItems: any[], prefix = ''): { items: InvoiceItem[], rawLines: string[] } => {
    const recognizedItems: InvoiceItem[] = [];
    const rawLines: string[] = [];
    
    // 过滤出真正的商品项（排除合计行等）
    const productNameItems = nameItems.filter(item => isProductItem(item.text));
    
    // 对于每个可能的商品名称项，查找同一行的其他文本项
    productNameItems.forEach(nameItem => {
      const sameRowItems = findSameRowItems(allTextItems, nameItem.y);
      
      console.log(`与 "${nameItem.text}" 同一行的文本项:`, 
        sameRowItems.map(item => `"${item.text}"(x:${item.x})`).join(', '));
      
      // 构建商品项对象  
      const item = identifyColumnByX(nameItem, sameRowItems);
      
      // 如果至少有名称和一些其他信息，则认为是有效的商品项
      if (item.name && (item.spec || item.unit || item.quantity || item.price || item.amount)) {
        recognizedItems.push(item);
        console.log(`成功识别${prefix}商品项: ${item.name}, 规格: ${item.spec}, 单位: ${item.unit}, 数量: ${item.quantity}, 单价: ${item.price}, 金额: ${item.amount}`);
      }
      
      // 收集原始行文本
      const rawLine = sameRowItems.map(i => i.text).join(' ');
      if (rawLine.trim().length > 0) {
        rawLines.push(rawLine);
      }
    });
    
    // 处理可能的跨行内容
    const enhancedItems = processContinuationLines(allTextItems, recognizedItems);
    
    return { items: enhancedItems, rawLines };
  };
  
  // 辅助函数：生成表格文本和设置details对象
  const generateTableAndSetDetails = (items: InvoiceItem[], rawLines: string[]): void => {
    if (items.length === 0) return;
    
    // 处理每个商品项，确保规格型号没有多余空格
    items.forEach(item => {
      // 处理规格型号中*号两侧的空格
      if (item.spec) {
        item.spec = item.spec.replace(/(\d+)\s*\*\s*(\d+)/g, '$1*$2');
        item.spec = item.spec.trim();
      }
      
      // 确保项目名称已包含电压等级
      if (item.name) {
        item.name = item.name.trim();
      }
    });
    
    // 创建表头
    let tableText = '项目名称\t规格型号\t单位\t数量\t单价\t金额\t税率\t税额\n';
    
    // 添加数据行
    items.forEach(item => {
      tableText += `${item.name || ''}\t${item.spec || ''}\t${item.unit || ''}\t${item.quantity || ''}\t${item.price || ''}\t${item.amount || ''}\t${item.taxRate || ''}\t${item.tax || ''}\n`;
    });
    
    details.items = rawLines.join('\n');
    details.itemsTable = tableText.trim();
    console.log(`成功生成商品明细表格，包含${items.length}个商品项`);
  };
  
  // 辅助函数：找到可能的商品名称项
  const findPotentialItemNameItems = (textItems: any[], headerItems: any[]) => {
    return textItems.filter((item: any) => {
      // 如果有表头，则使用表头的项目名称列X坐标范围
      if (headerItems.length > 0) {
        const itemNameHeader = headerItems.find((h: any) => h.text.includes('项目名称'));
        if (itemNameHeader) {
          // 假设项目名称通常在左侧的第一列
          return item.x < 100 && item.y > itemNameHeader.y;
        }
      }
      
      // 如果没有找到表头或项目名称列，返回false
      return false;
    });
  };
  
  // 辅助函数：尝试使用不同方法提取商品项
  const tryExtractItemsByDifferentMethods = () => {
    // 搜索包含"项目名称"的文本项作为可能的表头
    const headerItems = textItems.filter(item => 
      item.text.includes('项目名称') || 
      item.text.includes('规格型号') || 
      item.text.includes('单位') || 
      item.text.includes('数量')
    );
    
    console.log("可能的表头项:", headerItems.map(item => `"${item.text}"(x:${item.x},y:${item.y})`).join(', '));
    
    // 搜索包含"合计"的文本项
    const totalItems = textItems.filter(item => 
      item.text.includes('合计') || 
      item.text.includes('合 计')
    );
    
    console.log("可能的合计项:", totalItems.map(item => `"${item.text}"(x:${item.x},y:${item.y})`).join(', '));
    
    // 方法1: 基于位置识别商品项
    const potentialItemNameItems = findPotentialItemNameItems(textItems, headerItems);
    
    console.log("可能的商品名称项数量:", potentialItemNameItems.length);
    if (potentialItemNameItems.length > 0) {
      console.log("可能的商品名称项:", potentialItemNameItems.map(item => `"${item.text}"(x:${item.x},y:${item.y})`).join(', '));
      
      // 从位置特征识别的项中提取商品项
      const { items: recognizedItems, rawLines: itemsLines } = extractItemsFromTextItems(potentialItemNameItems, textItems);
      
      // 生成表格并设置details
      if (recognizedItems.length > 0) {
        generateTableAndSetDetails(recognizedItems, itemsLines);
        return true;
      }
    }    
    return false;
  };
  
  // 提取函数：匹配两个关键字之间的内容
  const extractBetween = (startKey: string, endKey: string, defaultEndKey = '\n') => {
    const startIndex = text.indexOf(startKey);
    if (startIndex === -1) return '';
    
    const actualEndKey = text.indexOf(endKey, startIndex + startKey.length) !== -1 ? endKey : defaultEndKey;
    const endIndex = text.indexOf(actualEndKey, startIndex + startKey.length);
    
    if (endIndex === -1) {
      return text.substring(startIndex + startKey.length).trim();
    }
    
    return text.substring(startIndex + startKey.length, endIndex).trim();
  };
  
  // 尝试直接从文本中提取关键信息
  try {
    // 1. 发票号码 - 查找"发票号码:"和"开票日期"之间的内容
    const invoiceNumRaw = extractBetween('发票号码', '开票日期');
    if (invoiceNumRaw) {
      // 提取数字部分
      const matches = invoiceNumRaw.match(/(\d+)/);
      if (matches) details.invoiceNumber = matches[1];
    }
    
    // 2. 开票日期
    const dateRaw = extractBetween('开票日期', '购');
    if (dateRaw) {
      // 清理日期格式，去除多余的冒号
      details.date = dateRaw.replace(/：|:/g, '').trim();
    }
    
    // 3. 购买方信息 - 更精确的提取方法
    if (text.includes('购 名称')) {
      // 购买方名称提取 - 确保只提取购买方名称
      const buyerSection = text.match(/购\s+名称[：:]\s*([^销]+)/i);
      if (buyerSection && buyerSection[1]) {
        details.buyer = buyerSection[1].trim();
      }
    }
    
    // 同时提取购买方和销售方税号
    // 查找包含两个税号的行
    const taxLinePattern = /统一社会信用代码\/纳税人识别号[：:]\s*([A-Za-z0-9]+)[\s\S]*统一社会信用代码\/纳税人识别号[：:]\s*([A-Za-z0-9]+)/i;
    const taxLineMatch = text.match(taxLinePattern);
    
    if (taxLineMatch && taxLineMatch.length >= 3) {
      // 第一个匹配是购买方税号，第二个是销售方税号
      details.buyerTaxID = taxLineMatch[1].trim();
      details.sellerTaxID = taxLineMatch[2].trim();
    }
    
    // 4. 销售方信息 - 更精确的提取方法
    if (text.includes('销 名称')) {
      // 销售方名称提取
      const sellerSection = text.match(/销\s+名称[：:]\s*([^\n]+)/i);
      if (sellerSection && sellerSection[1]) {
        details.seller = sellerSection[1].trim();
      }
    }
    
    // 5. 金额信息
    // 查找小写金额
    const amountSmallMatch = text.match(/[（\(]小写[）\)][:：]?\s*([¥￥]\s*[\d,.]+)/i);
    if (amountSmallMatch && amountSmallMatch[1]) {
      details.amount = amountSmallMatch[1].trim();
    }
    
    // 查找大写金额
    const amountLargeMatch = text.match(/[（\(]大写[）\)][:：]?\s*([^（\(]+)/i);
    if (amountLargeMatch && amountLargeMatch[1]) {
      details.amountInWords = amountLargeMatch[1].trim();
    }
    
    // 6. 项目名称/工程名称
    if (text.includes('工程名称')) {
      const projectMatch = text.match(/工程名称[：:]\s*([^\n]+)/i);
      if (projectMatch && projectMatch[1]) {
        details.project = projectMatch[1].trim();
      }
    } else if (text.includes('项目名称')) {
      const projectMatch = text.match(/项目名称[：:]\s*([^\n]+)/i);
      if (projectMatch && projectMatch[1]) {
        details.project = projectMatch[1].trim();
      }
    }
    
    // 提取工程地址
    if (text.includes('工程地址')) {
      const addressMatch = text.match(/工程地址[：:]\s*([^\n]+)/i);
      if (addressMatch && addressMatch[1]) {
        details.projectAddress = addressMatch[1].trim();
      }
    }
    
    // 提取销方开户银行和银行账号
    if (text.includes('销方开户银行')) {
      const bankInfoMatch = text.match(/销方开户银行[：:]\s*([^;]+);?\s*银行账号[：:]\s*([^;]+)/i);
      if (bankInfoMatch && bankInfoMatch.length >= 3) {
        details.sellerBank = bankInfoMatch[1].trim();
        details.sellerBankAccount = bankInfoMatch[2].trim();
      } else {
        // 单独提取银行信息
        const bankMatch = text.match(/销方开户银行[：:]\s*([^\n;]+)/i);
        if (bankMatch && bankMatch[1]) {
          details.sellerBank = bankMatch[1].trim();
        }
        
        // 单独提取账号信息
        const accountMatch = text.match(/银行账号[：:]\s*([^\n;]+)/i);
        if (accountMatch && accountMatch[1]) {
          details.sellerBankAccount = accountMatch[1].trim();
        }
      }
    }
    
    // 添加开票人提取逻辑
    if (text.includes('开票人')) {
      const issuerMatch = text.match(/开票人[：:]\s*([^\n]+)/i);
      if (issuerMatch && issuerMatch[1]) {
        details.issuer = issuerMatch[1].trim();
      }
    }
    
    // 7. 商品明细提取 - 增强版
    const lines = text.split('\n');
    
    // 直接识别表格区域 - 查找表头行和合计行之间的内容
    let headerLineIndex = -1;
    let totalLineIndex = -1;
    
    // 查找表头行 - 查找包含"项目名称"和"税额"的行
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('项目名称') && (line.includes('规格') || line.includes('型号')) && 
          line.includes('单位') && line.includes('数量') && 
          line.includes('金额') && (line.includes('税率') || line.includes('税额'))) {
        headerLineIndex = i;
        break;
      }
    }
    
    // 查找合计行
    if (headerLineIndex >= 0) {
      for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('合计') || line.includes('合 计')) {
          totalLineIndex = i;
          break;
        }
      }
    }
    
    // 如果找到了表头和合计行，提取它们之间的内容作为商品明细
    if (headerLineIndex >= 0 && totalLineIndex > headerLineIndex && textItems && textItems.length > 0) {
      console.log("找到表头行和合计行，表头行索引:", headerLineIndex, "合计行索引:", totalLineIndex);
      console.log("表头行内容:", lines[headerLineIndex]);
      console.log("合计行内容:", lines[totalLineIndex]);
      console.log("textItems总数量:", textItems.length);
      
      // 尝试提取表头行对应的textItems，用于确定各列的X坐标范围
      const headerTextItems = textItems.filter((item: any) => {
        // 查找包含表头关键字的文本项
        return item.text.includes('项目名称') || 
               item.text.includes('规格型号') || 
               item.text.includes('单位') || 
               item.text.includes('数量') || 
               item.text.includes('单价') || 
               item.text.includes('金额') || 
               item.text.includes('税率') || 
               item.text.includes('税额');
      });
      
      console.log("找到的表头文本项数量:", headerTextItems.length);
      console.log("表头文本项:", headerTextItems.map(item => `${item.text}(x:${item.x},y:${item.y})`).join(', '));
      
      // 查找表格内所有文本项（在表头和合计行之间）
      const tableTextItems = textItems.filter((item: any) => {
        // 找到表头行和合计行对应的Y坐标范围
        const headerItems = headerTextItems.length > 0 ? 
          headerTextItems : textItems.filter((i: any) => i.text.includes('项目名称'));
        
        const totalItems = textItems.filter((i: any) => i.text.includes('合计') || i.text.includes('合 计'));
        
        if (headerItems.length === 0 || totalItems.length === 0) return false;
        
        const headerY = Math.min(...headerItems.map(i => i.y));
        const totalY = Math.min(...totalItems.map(i => i.y));
        
        // 文本项在表头和合计行之间
        return item.y > headerY && item.y < totalY;
      });
      
      console.log("表格区域内的文本项数量:", tableTextItems.length);
      
      if (tableTextItems.length === 0) {
        // 如果无法通过表头和合计行确定表格区域，尝试其他方法
        console.log("未能通过表头和合计行确定表格区域，尝试其他方法");
        tryExtractItemsByDifferentMethods();
      } else {
        // 使用识别出的表格区域提取商品项
        console.log("使用识别出的表格区域提取商品项");
        
        // 根据表头项的X坐标确定各列的范围
        type ColumnInfo = {name: string, minX: number, maxX: number};
        const columns: ColumnInfo[] = [];
        
        // 定义表头列名及其可能的变体
        const columnDefinitions = [
          {key: 'name', variants: ['项目名称', '货物名称']},
          {key: 'spec', variants: ['规格型号', '规格', '型号']},
          {key: 'unit', variants: ['单位', '单 位']},
          {key: 'quantity', variants: ['数量', '数 量']},
          {key: 'price', variants: ['单价', '单 价']},
          {key: 'amount', variants: ['金额']},
          {key: 'taxRate', variants: ['税率', '税率/征收率']},
          {key: 'tax', variants: ['税额', '税 额']}
        ];
        
        // 遍历表头项，确定各列的X坐标范围
        columnDefinitions.forEach(colDef => {
          // 查找匹配的表头项
          const matchingItems = headerTextItems.filter((item: any) => 
            colDef.variants.some(variant => item.text.includes(variant))
          );
          
          if (matchingItems.length > 0) {
            // 计算该列的X坐标范围
            const minX = Math.min(...matchingItems.map(item => item.x));
            const maxX = Math.max(...matchingItems.map(item => item.x + item.width));
            
            columns.push({
              name: colDef.key,
              minX,
              maxX
            });
            console.log(`找到列 ${colDef.key}, 范围: ${minX}-${maxX}`);
          } else {
            console.log(`未找到列 ${colDef.key} 的表头项`);
          }
        });
        
        // 对列按X坐标排序
        columns.sort((a, b) => a.minX - b.minX);
        console.log("排序后的列:", columns.map(col => `${col.name}(${col.minX}-${col.maxX})`).join(', '));
        
        // 调整列的范围，确保覆盖整个表格宽度
        for (let i = 0; i < columns.length - 1; i++) {
          // 当前列的结束位置是下一列的开始位置
          columns[i].maxX = columns[i+1].minX;
        }
        
        console.log("调整后的列范围:", columns.map(col => `${col.name}(${col.minX}-${col.maxX})`).join(', '));
        
        // 按Y坐标分组，识别同一行的文本项
        const yTolerance = 8; // Y坐标容差，同一行的文本项Y坐标差异不会超过这个值
        const tableRows: any[][] = [];
        let currentRow: any[] = [];
        let currentY = -1;
        
        // 按Y坐标排序
        const sortedTableItems = [...tableTextItems].sort((a, b) => a.y - b.y);
        
        // 分组为行
        sortedTableItems.forEach(item => {
          if (currentY === -1 || Math.abs(item.y - currentY) <= yTolerance) {
            // 同一行
            currentRow.push(item);
            currentY = (currentY === -1) ? item.y : Math.min(currentY, item.y);
          } else {
            // 新行
            if (currentRow.length > 0) {
              // 对当前行按X坐标排序
              currentRow.sort((a, b) => a.x - b.x);
              tableRows.push(currentRow);
            }
            currentRow = [item];
            currentY = item.y;
          }
        });
        
        // 添加最后一行
        if (currentRow.length > 0) {
          currentRow.sort((a, b) => a.x - b.x);
          tableRows.push(currentRow);
        }
        
        console.log("识别出的表格行数:", tableRows.length);
        
        // 处理每一行，构建商品项
        const tableItems: InvoiceItem[] = [];
        
        tableRows.forEach((row, rowIndex) => {
          // 创建新的商品项
          const item: InvoiceItem = {
            name: '',
            spec: '',
            unit: '',
            quantity: '',
            price: '',
            amount: '',
            taxRate: '',
            tax: ''
          };
          
          console.log(`处理第${rowIndex+1}行, 包含${row.length}个文本项`);
          
          // 根据X坐标将文本项分配到对应的列
          row.forEach(textItem => {
            // 查找文本项所在的列
            let foundColumn = false;
            for (const column of columns) {
              if (textItem.x >= column.minX && textItem.x < column.maxX) {
                // 文本项属于该列
                foundColumn = true;
                
                if (column.name === 'name' && !item.name) {
                  item.name = textItem.text;
                } else if (column.name === 'name' && item.name) {
                  // 如果项目名称已有内容，可能是跨行的情况，追加内容
                  item.name += textItem.text;
                } else if (column.name === 'spec' && !item.spec) {
                  item.spec = textItem.text;
                } else if (column.name === 'spec' && item.spec) {
                  // 规格型号可能跨行，追加内容
                  item.spec += textItem.text;
                } else if (column.name === 'unit') {
                  item.unit = textItem.text;
                } else if (column.name === 'quantity') {
                  item.quantity = textItem.text;
                } else if (column.name === 'price') {
                  item.price = textItem.text;
                } else if (column.name === 'amount') {
                  item.amount = textItem.text;
                } else if (column.name === 'taxRate') {
                  item.taxRate = textItem.text;
                } else if (column.name === 'tax') {
                  item.tax = textItem.text;
                }
                break; // 找到列后不再继续查找
              }
            }
          });
          
          // 检查是否是有效的商品项
          if (item.name || item.spec) {
            // 如果当前行没有足够的信息，可能是上一个商品项的延续
            if (!item.unit && !item.quantity && !item.price && tableItems.length > 0) {
              // 将内容追加到上一个商品项
              const lastItem = tableItems[tableItems.length - 1];
              if (item.name) lastItem.name += ' ' + item.name;
              if (item.spec) lastItem.spec += ' ' + item.spec;
              console.log(`将内容追加到上一个商品项: ${lastItem.name}`);
            } else {
              // 添加为新的商品项
              tableItems.push(item);
              console.log(`添加新商品项: ${item.name}, 规格: ${item.spec}, 单位: ${item.unit}, 数量: ${item.quantity}`);
            }
          }
        });
        
        // 处理跨行内容
        const enhancedTableItems = processContinuationLines(textItems, tableItems);
        
        // 如果成功提取了商品项，生成表格
        if (enhancedTableItems.length > 0) {
          // 使用提取的原始行内容
          const rawLines = lines.slice(headerLineIndex, totalLineIndex + 1);
          generateTableAndSetDetails(enhancedTableItems, rawLines);
        }
      }
    } else {
      console.log("未找到完整的表格结构，headerLineIndex:", headerLineIndex, "totalLineIndex:", totalLineIndex, "textItems是否存在:", !!textItems);
      
      // 尝试其他方法提取商品项
      if (textItems && textItems.length > 0) {
        tryExtractItemsByDifferentMethods();
      }
    }
  } catch (err) {
    console.error('提取发票详情时出错:', err);
  }
  
  // 检查提取结果
  console.log('最终提取的发票信息:', details);
  
  return details;
}; 