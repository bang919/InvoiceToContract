import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { InvoiceData } from '../components/InvoiceExtractor';
import mammoth from 'mammoth';
import * as docx from 'docx';

// 定义合同生成的数据结构
export interface ContractData {
  buyerName: string;
  buyerTaxID: string;
  projectName: string;
  projectAddress: string;
  sellerName: string;
  sellerTaxID: string;
  sellerBank: string;
  sellerBankAccount: string;
  invoiceItems: any[];
  totalAmount: string;
  totalTax: string;
  totalWithTax: string;
  date: string;
  buyerBank?: string;
  buyerBankAccount?: string;
}

// 从发票中提取合同所需数据
export function extractContractDataFromInvoices(invoices: InvoiceData[]): ContractData | null {
  if (!invoices || invoices.length === 0) {
    console.error('没有有效的发票数据');
    return null;
  }

  // 使用第一张发票的买方、卖方和项目信息
  const firstInvoice = invoices[0];
  
  // 输出整个发票对象以查看所有可用字段
  console.log("发票完整数据:", JSON.stringify(firstInvoice, null, 2));
  
  // 从fullText中提取信息
  let buyerName = '';
  let sellerName = '';
  let buyerTaxID = '';
  let sellerTaxID = '';
  let projectInfo = '';
  let projectAddress = '';
  let sellerBank = '';
  let sellerBankAccount = '';
  
  if (firstInvoice.fullText) {
    const fullText = firstInvoice.fullText;
    
    // 提取买方名称
    const buyerMatch = fullText.match(/购\s*名称[：:]\s*([^\n销]+)/);
    if (buyerMatch && buyerMatch[1]) {
      buyerName = cleanValue(buyerMatch[1]);
      console.log("从fullText中提取到买方名称:", buyerName);
    }
    
    // 提取卖方名称
    const sellerMatch = fullText.match(/销\s*名称[：:]\s*([^\n]+)/);
    if (sellerMatch && sellerMatch[1]) {
      sellerName = cleanValue(sellerMatch[1]);
      console.log("从fullText中提取到卖方名称:", sellerName);
    }
    
    // 提取买方税号
    const buyerTaxMatch = fullText.match(/买[\s\S]{0,30}统一社会信用代码\/纳税人识别号[：:]\s*([A-Za-z0-9]+)/);
    if (buyerTaxMatch && buyerTaxMatch[1]) {
      buyerTaxID = cleanValue(buyerTaxMatch[1]);
      console.log("从fullText中提取到买方税号:", buyerTaxID);
    }
    
    // 提取卖方税号
    const sellerTaxMatch = fullText.match(/售[\s\S]{0,30}统一社会信用代码\/纳税人识别号[：:]\s*([A-Za-z0-9]+)/);
    if (sellerTaxMatch && sellerTaxMatch[1]) {
      sellerTaxID = cleanValue(sellerTaxMatch[1]);
      console.log("从fullText中提取到卖方税号:", sellerTaxID);
    }
    
    // 提取项目信息
    const projectMatch = fullText.match(/工程名称[：:]\s*([^\n]+)/);
    if (projectMatch && projectMatch[1]) {
      projectInfo = cleanValue(projectMatch[1]);
      console.log("从fullText中提取到项目名称:", projectInfo);
    }
    
    // 提取工程地址
    const addressMatch = fullText.match(/工程地址[：:]\s*([^\n]+)/);
    if (addressMatch && addressMatch[1]) {
      projectAddress = cleanValue(addressMatch[1]);
      console.log("从fullText中提取到工程地址:", projectAddress);
    }
    
    // 提取银行信息
    const bankMatch = fullText.match(/销方开户银行[：:][^;；]+[;；]/);
    if (bankMatch && bankMatch[0]) {
      sellerBank = cleanValue(bankMatch[0].replace(/销方开户银行[：:]/, '').replace(/[;；].*/, ''));
      console.log("从fullText中提取到银行信息:", sellerBank);
    }
    
    // 提取银行账号
    const accountMatch = fullText.match(/银行账号[：:][^;；\n]+/);
    if (accountMatch && accountMatch[0]) {
      sellerBankAccount = cleanValue(accountMatch[0].replace(/银行账号[：:]/, ''));
      console.log("从fullText中提取到银行账号:", sellerBankAccount);
    }
  }
  
  // 打印提取到的主要信息用于调试
  console.log("提取的关键信息:");
  console.log("买方名称:", buyerName);
  console.log("卖方名称:", sellerName);
  console.log("买方税号:", buyerTaxID);
  console.log("卖方税号:", sellerTaxID);
  console.log("项目名称:", projectInfo);
  console.log("银行信息:", sellerBank);
  console.log("银行账号:", sellerBankAccount);
  
  // 收集所有发票的商品项
  const allItems: any[] = [];
  
  // 总金额（不含税）
  let totalAmountValue = 0;
  // 总税额
  let totalTaxValue = 0;
  
  // 处理每个发票的商品项
  invoices.forEach(invoice => {
    if (invoice.itemsTable) {
      const items = parseItemsTable(invoice.itemsTable);
      items.forEach(item => {
        // 添加到总商品列表
        allItems.push(item);
        
        // 累加不含税金额
        if (item.amount) {
          const amount = parseFloat(item.amount.replace(/[^\d.]/g, ''));
          if (!isNaN(amount)) {
            totalAmountValue += amount;
          }
        }
        
        // 累加税额
        if (item.tax) {
          const tax = parseFloat(item.tax.replace(/[^\d.]/g, ''));
          if (!isNaN(tax)) {
            totalTaxValue += tax;
          }
        }
      });
    }
  });
  
  // 计算含税总金额
  const totalWithTaxValue = totalAmountValue + totalTaxValue;
  
  // 格式化金额
  const totalAmount = totalAmountValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const totalTax = totalTaxValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const totalWithTax = totalWithTaxValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // 获取当前日期
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const day = currentDate.getDate().toString().padStart(2, '0');
  const dateStr = `${year}年${month}月${day}日`;
  
  const contractData = {
    buyerName,
    buyerTaxID,
    projectName: projectInfo,
    projectAddress,
    sellerName,
    sellerTaxID,
    sellerBank,
    sellerBankAccount,
    invoiceItems: allItems,
    totalAmount,
    totalTax,
    totalWithTax,
    date: dateStr
  };
  
  console.log("生成的合同数据:", contractData);
  
  // 返回合同数据
  return contractData;
}

// 辅助函数：清理值，去除前后空格和标点符号
function cleanValue(value: string | null): string {
  if (!value) return '';
  
  // 去除前后的空格和标点符号
  return value.trim().replace(/^[:：\s]+|[:：;\s]+$/g, '');
}

// 辅助函数：从文本中提取字段信息
function extractField(text: string, startKey: string, endKey: string): string | null {
  if (!text) return null;
  
  const startIndex = text.indexOf(startKey);
  if (startIndex === -1) return null;
  
  const valueStartIndex = startIndex + startKey.length;
  const endIndex = text.indexOf(endKey, valueStartIndex);
  
  if (endIndex === -1) {
    return text.substring(valueStartIndex).trim();
  }
  
  return text.substring(valueStartIndex, endIndex).trim();
}

// 解析商品明细表
function parseItemsTable(itemsTable: string): any[] {
  const rows = itemsTable.trim().split('\n');
  if (rows.length < 2) return [];
  
  const headers = rows[0].split('\t');
  const items = [];
  
  // 遍历数据行
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].split('\t');
    
    // 跳过合计行
    if (cells[0].includes('合计') || cells[0].includes('价税合计')) {
      continue;
    }
    
    const item: any = {};
    
    // 映射表头到字段
    for (let j = 0; j < headers.length; j++) {
      if (j < cells.length) {
        const header = headers[j].trim();
        const value = cells[j].trim();
        
        // 根据表头映射字段
        switch (header) {
          case '项目名称':
            item.name = value;
            break;
          case '规格型号':
            item.spec = value;
            break;
          case '单位':
            item.unit = value;
            break;
          case '数量':
            item.quantity = value;
            break;
          case '单价':
            item.price = value;
            break;
          case '金额':
            item.amount = value;
            break;
          case '税率':
            item.taxRate = value;
            break;
          case '税额':
            item.tax = value;
            break;
          default:
            item[header] = value;
        }
      }
    }
    
    // 只添加有名称的项目
    if (item.name) {
      items.push(item);
    }
  }
  
  return items;
}

// 查看word模板内容（用于调试）
export async function readTemplateContent(templatePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(templatePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('读取模板失败:', error);
    return '无法读取模板内容';
  }
}

// 分析合同模板
export async function analyzeTemplate(templatePath: string): Promise<{content: string, variables: string[]}> {
  try {
    // 读取模板文本内容
    const content = await readTemplateContent(templatePath);
    
    // 提取模板中的变量 (格式如 {{变量名}})
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      variables.push(match[1]);
    }
    
    return {
      content,
      variables: Array.from(new Set(variables)) // 使用Array.from替代展开操作符
    };
  } catch (error) {
    console.error('分析模板失败:', error);
    return {
      content: '无法读取模板内容',
      variables: []
    };
  }
}

// 生成合同文件
export async function generateContract(
  templateBuffer: Buffer | ArrayBuffer,
  data: ContractData,
  outputPath: string
): Promise<string> {
  try {
    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 准备合同模板数据 - 直接构建与模板变量匹配的对象
    const templateData = {
      // 基础信息
      buyerName: data.buyerName || '',
      sellerName: data.sellerName || '',
      buyerTaxID: data.buyerTaxID || '',
      sellerTaxID: data.sellerTaxID || '',
      projectName: data.projectName || '',
      projectAddress: data.projectAddress || '',
      
      // 银行信息
      sellerBank: data.sellerBank || '',
      sellerBankAccount: data.sellerBankAccount || '',
      buyerBank: data.buyerBank || '',
      buyerBankAccount: data.buyerBankAccount || '',
      
      // 日期和编号
      contractDate: new Date().toLocaleDateString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit'}).replace(/\//g, '年') + '日',
      contractNo: `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      
      // 金额信息
      totalAmount: data.totalAmount || '0.00',
      amountInWords: convertToChineseAmount(data.totalAmount || '0'),
      
      // 税额信息
      totalTax: data.totalTax || '0.00',
      taxInWords: convertToChineseAmount(data.totalTax || '0'),
      
      // 含税总金额
      totalWithTax: data.totalWithTax || '0.00',
      totalWithTaxInWords: convertToChineseAmount(data.totalWithTax || '0'),
      
      // 表格数据 - 结构化为数组对象，用于docxtemplater循环
      items: (data.invoiceItems || []).map((item, index) => ({
        index: index + 1,
        name: (item.name || ''),
        spec: item.spec || '',
        unit: item.unit || '',
        quantity: item.quantity || '',
        price: item.price || '',
        amount: item.amount || '',
        taxRate: item.taxRate || '',
        tax: item.tax || ''
      }))
    };
    
    console.log('正在使用模板生成合同，模板数据:', JSON.stringify(templateData, null, 2));
    
    try {
      // 使用docxtemplater处理Word模板
      // 1. 加载模板
      const zip = new PizZip(templateBuffer);
      
      // 2. 创建docxtemplater实例并配置
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true
      });
      
      // 3. 直接渲染文档
      doc.render(templateData);
      
      // 4. 生成输出文档
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE'
      });
      
      // 写入生成的文件
      fs.writeFileSync(outputPath, buffer);
      console.log(`合同文件已生成: ${outputPath}`);
      
      return outputPath;
    } catch (templateError: any) {
      console.error('模板处理失败:', templateError);
      throw templateError;
    }
  } catch (error) {
    console.error('生成合同文件时出错:', error);
    throw error;
  }
}

// 数字金额转换为中文大写金额
function convertToChineseAmount(amount: string | number): string {
  // 确保输入为数字
  const num = typeof amount === 'string' 
    ? parseFloat(amount.replace(/[^\d.]/g, '')) 
    : amount;

  if (isNaN(num) || num === 0) {
    return '零元整';
  }

  const fraction = ['角', '分'];
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const unit = [
    ['元', '万', '亿'],
    ['', '拾', '佰', '仟']
  ];

  // 处理小数点之后的小数部分
  let head = Math.floor(num);
  let tail = '';
  const numStr = num.toString();
  const dotIndex = numStr.indexOf('.');
  
  if (dotIndex !== -1) {
    const cents = numStr.substring(dotIndex + 1);
    if (cents.length > 0) {
      // 处理小数，只取前两位
      for (let i = 0; i < Math.min(2, cents.length); i++) {
        if (cents[i] !== '0') {
          tail += digit[parseInt(cents[i])] + fraction[i];
        }
      }
    }
  }

  // 处理整数部分
  let headText = '';
  let i = 0;
  
  // 将整数部分转换为 4 位分组，从个位开始计算
  while (head > 0) {
    let p = '';
    // 处理每组的 4 位数
    for (let j = 0; j < 4; j++) {
      // 当前位的值
      const digit_value = head % 10;
      // 减掉这一位
      head = Math.floor(head / 10);
      
      // 处理每一位
      if (digit_value !== 0) {
        // 数字 + 单位（佰，拾等）
        p = digit[digit_value] + unit[1][j] + p;
      } else {
        // 使用"零"占位，但不连续使用"零"
        if (j === 0) {
          // skip
        } else if (p.charAt(0) !== '零') {
          p = '零' + p;
        }
      }
    }
    
    // 加上万亿等单位
    if (p !== '') {
      headText = p + unit[0][i] + headText;
    }
    
    i++;
  }

  // 整数部分为 0 时特殊处理
  if (headText === '') {
    headText = '零元';
  }
  
  // 如果没有小数部分，增加"整"字
  if (tail === '') {
    tail = '整';
  }

  return headText + tail;
}

// 根据发票数据生成合同文件
export async function generateContractFromInvoices(
  invoices: InvoiceData[],
  templateBuffer: Buffer | ArrayBuffer,
  outputDir: string = 'output'
): Promise<string[]> {
  // 验证输入
  if (!invoices || invoices.length === 0) {
    throw new Error('没有有效的发票数据');
  }
  
  if (!templateBuffer) {
    throw new Error('没有有效的合同模板');
  }
  
  try {
    // 按项目名称和买卖方税号分组
    const invoiceGroups = groupInvoicesByProject(invoices);
    const generatedFiles: string[] = [];
    
    // 为每个分组生成一份合同
    for (const groupKey of Object.keys(invoiceGroups)) {
      const groupInvoices = invoiceGroups[groupKey];
      
      // 提取该组的合同数据
      const contractData = extractContractDataFromInvoices(groupInvoices);
      
      if (contractData) {
        // 构造输出文件名（使用项目名称）
        const sanitizedProjectName = (contractData.projectName || 'unknown')
          .replace(/[\\/:*?"<>|]/g, '_')
          .replace(/^\s*[:：]\s*/, '') // 移除开头的冒号和空格
          .replace(/\s+/g, ' ')       // 将多个空格替换为单个空格
          .trim()
          .substring(0, 50); // 限制长度
        
        const outputPath = path.join(outputDir, `${sanitizedProjectName}-合同.docx`);
        
        // 生成合同
        await generateContract(templateBuffer, contractData, outputPath);
        generatedFiles.push(outputPath);
        console.log(`使用模板生成合同: ${outputPath}`);
      }
    }
    
    return generatedFiles;
  } catch (error) {
    console.error('生成合同文件失败:', error);
    throw error;
  }
}

// 按项目和买卖方税号对发票分组
function groupInvoicesByProject(invoices: InvoiceData[]): { [key: string]: InvoiceData[] } {
  const groups: { [key: string]: InvoiceData[] } = {};
  
  for (const invoice of invoices) {
    // 提取关键信息作为分组键
    const project = invoice.project || '';
    const buyerTaxID = invoice.buyerTaxID || '';
    const sellerTaxID = invoice.sellerTaxID || '';
    
    // 组合键
    const groupKey = `${project}_${buyerTaxID}_${sellerTaxID}`;
    
    // 添加到对应分组
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    
    groups[groupKey].push(invoice);
  }
  
  return groups;
}

// 准备合同模板数据
function prepareContractData(data: ContractData): Record<string, string> {
  // 格式化日期
  const currentDate = new Date();
  const year = currentDate.getFullYear().toString();
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const day = currentDate.getDate().toString().padStart(2, '0');
  
  // 确保所有数据字段都存在
  const templateData: Record<string, string> = {
    // 基本信息
    buyerName: data.buyerName || '',
    buyerTaxID: data.buyerTaxID || '',
    sellerName: data.sellerName || '',
    sellerTaxID: data.sellerTaxID || '',
    
    // 银行信息
    sellerBank: data.sellerBank || '',
    sellerBankAccount: data.sellerBankAccount || '',
    
    // 项目信息
    projectName: data.projectName || '',
    projectAddress: data.projectAddress || '',
    
    // 合同专用信息
    contractNo: `${year}${month}${day}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    contractDate: `${year}年${month}月${day}日`,
    deliveryDate: `${year}年${Number(month) + 1 > 12 ? '01' : (Number(month) + 1).toString().padStart(2, '0')}月${day}日`,
    contractYear: year.toString(),
    contractMonth: month,
    contractDay: day,
    
    // 金额信息
    totalAmount: data.totalAmount || '0.00',
    
    // 日期信息
    year: year,
    month: month,
    day: day,
    currentDate: `${year}年${month}月${day}日`,
    
    // 表格内容
    productTable: formatProductTable(data.invoiceItems || []),
  };
  
  // 添加变量别名，以便支持不同的模板格式
  templateData['buyer'] = templateData.buyerName;
  templateData['seller'] = templateData.sellerName;
  templateData['project'] = templateData.projectName;
  templateData['amount'] = templateData.totalAmount;
  templateData['amountInWords'] = convertToChineseAmount(data.totalAmount || '0');
  templateData['date'] = templateData.currentDate;
  
  // 为商品项添加JSON字符串表示，以便在模板中使用
  templateData['itemsJson'] = JSON.stringify(data.invoiceItems || []);
  
  return templateData;
}

// 格式化产品表格
function formatProductTable(items: any[]): string {
  if (!items || items.length === 0) {
    return '';
  }
  
  let table = '';
  
  // 格式化表格内容
  items.forEach((item, index) => {
    table += `${index + 1}. ${item.name || ''} ${item.spec || ''} ${item.quantity || ''} ${item.unit || ''} ${item.price || ''} ${item.amount || ''}\n`;
  });
  
  return table;
} 