'use client';

import { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import * as pdfLib from 'pdf-lib';
import * as docx from 'docx';
import JSZip from 'jszip';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { extractInvoiceDetails } from './InvoiceExtractor';
import { extractContractDataFromInvoices } from '../services/ContractService';
// 删除全局导入
// import * as pdfjsLib from 'pdfjs-dist';

// 删除全局设置
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

type Project = {
  name: string;
  invoices: File[];
};

type ContractGeneratorProps = {
  project: Project;
};

// 定义发票物品项目接口
interface InvoiceItem {
  name: string;
  spec: string;
  unit: string;
  quantity: string;
  price: string;
  amount: string;
  taxRate: string;
  tax: string;
}

// 定义自己的InvoiceData接口，避免冲突
interface LocalInvoiceData {
  fileName?: string;
  invoiceNumber?: string;
  buyer?: string;
  buyerTaxID?: string;
  seller?: string;
  sellerTaxID?: string;
  sellerBank?: string;
  sellerBankAccount?: string;
  project?: string;
  projectAddress?: string;
  date?: string;
  itemsTable?: InvoiceItem[];
  fullText?: string;
  content?: string;
  issuer?: string;
}

export default function ContractGenerator({ project }: ContractGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceDataList, setInvoiceDataList] = useState<LocalInvoiceData[]>([]);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [templateContent, setTemplateContent] = useState<ArrayBuffer | null>(null);
  const [pdfjs, setPdfjs] = useState<any>(null);
  const [generatedContracts, setGeneratedContracts] = useState<string[]>([]);
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);
  const [projectNames, setProjectNames] = useState<string[]>([]);

  // 动态导入 PDF.js (仅客户端)
  useEffect(() => {
    const loadPdfJs = async () => {
      if (typeof window !== 'undefined') {
        try {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
          setPdfjs(pdfjsLib);
        } catch (error) {
          console.error('加载PDF.js库失败:', error);
        }
      }
    };
    
    loadPdfJs();
  }, []);

  // 加载合同模板
  useEffect(() => {
    const loadTemplate = async () => {
      console.log('开始加载合同模板...');
      try {
        // 尝试从公共目录加载Word模板
        let response = await fetch('/contract-template.docx');
        
        if (!response.ok) {
          console.warn('无法从根路径加载模板，尝试从public目录加载');
          // 尝试从public目录加载
          response = await fetch('/public/contract-template.docx');
        }
        
        if (!response.ok) {
          throw new Error(`合同模板获取失败: ${response.status} ${response.statusText}`);
        }
        
        const templateData = await response.arrayBuffer();
        console.log('合同模板加载成功', templateData.byteLength, '字节');
        setTemplateContent(templateData);
      } catch (error: any) {
        console.error('加载合同模板失败:', error);
        alert(`加载合同模板失败: ${error.message}`);
      }
    };

    loadTemplate();
  }, []);

  // 从PDF中提取文本 - 优化文本提取顺序，text是所有文本，textItems是带坐标文本
  const extractTextFromPDF = async (file: File): Promise<{text: string}> => {
    if (!pdfjs) {
      return {text: `[PDF处理库尚未加载]`};
    }
    
    try {
      // 将文件转换为ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // 加载PDF文档
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      // 初始化一个数组来存储所有页面的文本项
      const allTextItems: any[] = [];
      
      console.log(`开始处理PDF: ${file.name}, 共${pdf.numPages}页`);
      
      // 循环读取每一页
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });
        
        // 获取页面尺寸
        const pageWidth = viewport.width;
        const pageHeight = viewport.height;
        
        console.log(`处理第${i}页, 页面尺寸: ${pageWidth}x${pageHeight}, 文本项数量: ${textContent.items.length}`);
        
        // 收集所有文本项，保留完整的位置信息
        const pageTextItems: any[] = [];
        textContent.items.forEach((item: any) => {
          if (item.str && item.str.trim().length > 0) {
            // 保存文本项及其完整的位置信息
            const textItem = {
              text: item.str.trim(),
              x: item.transform[4],
              y: pageHeight - item.transform[5], // 转换Y坐标，使其从上到下递增
              width: item.width || 0,
              height: item.height || 0,
              // 保存原始变换矩阵，用于更精确的位置判断
              transform: [...item.transform]
            };
            pageTextItems.push(textItem);
          }
        });
        
        // 按行分组（基于Y坐标，允许小误差）
        const yTolerance = 5; // Y坐标容差
        const rows: any[] = [];//带有坐标
        let currentRow: any[] = [];//带有坐标
        
        // 按Y坐标排序
        pageTextItems.sort((a, b) => a.y - b.y);
        
        let currentY = pageTextItems.length > 0 ? pageTextItems[0].y : 0;
        
        // 按Y坐标分组
        pageTextItems.forEach((item: any) => {
          if (Math.abs(item.y - currentY) > yTolerance) {
            // 新行
            if (currentRow.length > 0) {
              // 对当前行按X坐标排序
              currentRow.sort((a, b) => a.x - b.x);
              rows.push(currentRow);
            }
            currentRow = [item];
            currentY = item.y;
          } else {
            currentRow.push(item);
          }
        });
        
        // 添加最后一行
        if (currentRow.length > 0) {
          currentRow.sort((a, b) => a.x - b.x);
          rows.push(currentRow);
        }
        
        console.log(`第${i}页识别出${rows.length}行文本`);
        
        // 处理发票特定结构
        let isInItemsSection = false;
        let itemsText = '';
        
        // 遍历所有行
        for (let j = 0; j < rows.length; j++) {
          if(j >= rows.length){//可能已经被删了几行
            break;
          }
          let row = rows[j];
          let rowText = row.map((item: any) => item.text).join(' ');

          console.log(`第${i}页第【${j+1}】行文本: ${rowText}`);
          
          // 检测是否进入商品明细区域
          if (rowText.includes('项目名称') && rowText.includes('规格型号')) {
            isInItemsSection = true;
            itemsText += '【商品明细开始】\n';
            itemsText += rowText + '\n';
            console.log(`------------第${i}页第${j+1}行识别为商品明细表头: ${rowText}`);
            continue;
          }
          
          // 检测是否离开商品明细区域
          if (isInItemsSection && (rowText.includes('合 计 ¥'))) {
            itemsText += rowText + '\n';
            itemsText += '【商品明细结束】\n';
            isInItemsSection = false;
            console.log(`------------第${i}页第${j+1}行识别为商品明细结束: ${rowText}`);
            continue;
          }
          
          // 处理商品明细区域内的行
          if (isInItemsSection) {
            //重点！！！归类row：如果x坐标小于100，则属于项目名称，都合并在一起；如果x坐标大于100小于160，则属于规格型号(有可能为空，则给赋值""，都合并在一起。组成新的row
            {
              let projectName = '';
              let specification = '';
              let unit = '';
              // 归类项目名称 (x < 100)
              const projectNameItems = row.filter((item: any) => item.x < 100);
              if (projectNameItems.length > 0) {
                projectName = projectNameItems.map((_item: { text: any; }) => _item.text).join('');
              }
              // 归类规格型号 (100 < x < 160)
              const specificationItems = row.filter((item: any) => item.x >= 100 && item.x < 160);
              if (specificationItems.length > 0) {
                specification = specificationItems.map((_item: { text: any; }) => _item.text).join('');
              }
              // 归类单位 (160 < x < 220)
              const unitItems = row.filter((item: any) => item.x >= 160 && item.x < 220);
              if (unitItems.length > 0) {
                unit = unitItems.map((_item: { text: any; }) => _item.text).join('');
              }
              // 组成新的row，保持原有项但更新项目名称、规格型号和单位
              let newRow: any[] = [];
              // 只添加第一个项目名称项
              let hasAddedProjectName = false;
              let hasAddedSpecification = false;
              let hasAddedUnit = false;
              for (const item of row) {
                if (item.x < 100) {
                  if (!hasAddedProjectName) {
                    newRow.push({ ...item, text: projectName });
                    hasAddedProjectName = true;
                  }
                } else if (item.x >= 100 && item.x < 160) {
                  if (!hasAddedSpecification) {
                    newRow.push({ ...item, text: specification || "" });
                    hasAddedSpecification = true;
                  }
                } else if (item.x >= 160 && item.x < 220) {
                  if (!hasAddedUnit) {
                    newRow.push({ ...item, text: unit || "" });
                    hasAddedUnit = true;
                  }
                } else {
                  newRow.push(item);
                }
              }
              row = newRow;
            }
            
            //如果下一行是换行，且不是商品明细结束，需要加到这一行
            if(rows[j+1].length > 0 && rows[j+1].length < 5 && !(rows.indexOf("合") > -1 && rows.indexOf("计") > -1 && rows.indexOf("¥") > -1)){
              console.log(`------------第${i}页第${j+2}行属于商品明细的换行，先添加到上一行然后置空`);
              //遍历rows[j+1]和rows[j]，如果x坐标一样，则添加到rows[j]
              rows[j+1].forEach((nextRowItem: any) => {
                const matchingItem = row.find((currentRowItem: any) => 
                  Math.abs(currentRowItem.x - nextRowItem.x) < 5
                );
                if (matchingItem) {
                  matchingItem.text += nextRowItem.text;
                } else {
                  row.push(nextRowItem);
                }
              });
              rows[j+1] = []; // Clear the next row after merging
            }
            //重新赋值，用"|"连接
            rowText = row.map((item: any) => item.text).join('|');
            itemsText += rowText + '\n';
            console.log(`------------第${i}页第${j+1}行属于商品明细: ${rowText}`);
          } else {
            fullText += rowText + '\n';
          }
        }
        
        // 将商品明细添加到全文
        fullText += itemsText;
        fullText += '\n'; // 页面间添加空行
        
        // 将当前页面的文本项添加到总文本项数组
        allTextItems.push(...pageTextItems);
      }
      
      console.log(`PDF处理完成，总文本项数量: ${allTextItems.length}`);
      //过滤掉text的空行
      fullText = fullText.split('\n').filter(line => line.trim() !== '').join('\n');
      // 返回提取的文本和文本项
      return {
        text: fullText.trim()
      };
    } catch (error) {
      console.error('PDF提取失败:', error);
      return {text: `[无法读取PDF内容: ${file.name}]`};
    }
  };

  // 处理发票读取 - 修改以提取结构化信息并保留完整原文
  useEffect(() => {
    const processInvoices = async () => {
      if (!project.invoices.length || !pdfjs) return;

      setIsLoading(true);
      const processedInvoices: LocalInvoiceData[] = [];

      try {
        for (const invoice of project.invoices) {
          // 读取PDF发票内容
          console.log(`开始处理发票: ${invoice.name}`);
          const {text} = await extractTextFromPDF(invoice);

          console.log(`发票 ${invoice.name} 提取完成，文本长度: ${text.length}`);
          
          // 提取关键详情
          console.log(`开始从发票 ${invoice.name} 提取详细信息`);
          const details = extractInvoiceDetails(text);
          
          console.log(`发票 ${invoice.name} 详情提取完成，items字段长度: ${details.items?.length || 0}`);
          
          // 保存完整信息，包括原始文本和提取的结构化信息
          const formattedContent = `## 提取的关键信息：\n` +
            `${details.invoiceNumber ? `发票号码: ${details.invoiceNumber}\n` : ''}` +
            `${details.date ? `开票日期: ${details.date}\n` : ''}` +
            `${details.seller ? `销售方: ${details.seller}\n` : ''}` +
            `${details.sellerTaxID ? `销售方税号: ${details.sellerTaxID}\n` : ''}` +
            `${details.sellerBank ? `销售方开户银行: ${details.sellerBank}\n` : ''}` +
            `${details.sellerBankAccount ? `销售方银行账号: ${details.sellerBankAccount}\n` : ''}` +
            `${details.buyer ? `购买方: ${details.buyer}\n` : ''}` +
            `${details.buyerTaxID ? `购买方税号: ${details.buyerTaxID}\n` : ''}` +
            `${details.buyerBank ? `购买方开户银行: ${details.buyerBank}\n` : ''}` +
            `${details.buyerBankAccount ? `购买方银行账号: ${details.buyerBankAccount}\n` : ''}` +
            `${details.project ? `项目/工程: ${details.project}\n` : ''}` +
            `${details.projectAddress ? `工程地址: ${details.projectAddress}\n` : ''}` +
            `${details.issuer ? `开票人: ${details.issuer}\n` : ''}` +
            `\n## 原始文本（完整）：\n${text}`;

          
          processedInvoices.push({
            fileName: invoice.name,
            content: formattedContent,
            invoiceNumber: details.invoiceNumber,
            date: details.date,
            itemsTable: details.items,
            fullText: text,
            issuer: details.issuer,
            buyer: details.buyer,
            buyerTaxID: details.buyerTaxID,
            seller: details.seller,
            sellerTaxID: details.sellerTaxID,
            sellerBank: details.sellerBank,
            sellerBankAccount: details.sellerBankAccount,
            project: details.project,
            projectAddress: details.projectAddress
          });
          
          console.log(`发票 ${invoice.name} 处理完成，添加到结果列表`);
        }

        setInvoiceDataList(processedInvoices);
        console.log(`所有发票处理完成，共 ${processedInvoices.length} 张`);
        
        // 生成单独的预览数据
        if (processedInvoices.length > 0) {
          const previewText = processedInvoices
            .map(inv => `# ${inv.fileName}:\n${inv.content}`)
            .join('\n\n======================\n\n');
          setPreviewData(previewText);
        }
      } catch (error) {
        console.error('处理发票失败:', error);
        alert('处理发票失败，请检查文件格式');
      } finally {
        setIsLoading(false);
      }
    };

    if (pdfjs) {
      processInvoices();
    }
  }, [project.invoices, pdfjs]);
  
  // 生成合同
  const handleGenerateContract = async () => {
    if (!templateContent) {
      alert('合同模板尚未加载，请稍后再试');
      return;
    }
    
    if (invoiceDataList.length === 0) {
      alert('请先上传发票');
      return;
    }
    
    setIsGeneratingContract(true);
    
    try {
      console.log("当前发票列表:", invoiceDataList.map(invoice => ({
        fileName: invoice.fileName,
        项目: invoice.project || '未找到',
        买方: invoice.buyer || '未找到',
        卖方: invoice.seller || '未找到',
        项目地址: invoice.projectAddress || '未找到',
      })));

      // 记录所有发票的商品名称，检查是否包含星号
      for (const invoice of invoiceDataList) {
        if (invoice.itemsTable && invoice.itemsTable.length > 0) {
          console.log("发票商品明细项名称:", invoice.itemsTable.map(item => item.name));
          
          // 检查是否有名称中包含星号的商品
          const itemsWithAsterisks = invoice.itemsTable.filter(item => item.name.includes('*'));
          if (itemsWithAsterisks.length > 0) {
            console.log("发现带星号的商品:", itemsWithAsterisks.map(item => item.name));
          }
        }
      }

      // 按项目名称和买卖方信息分组处理发票
      const groupedInvoices: { [key: string]: LocalInvoiceData[] } = {};
      
      // 对发票按项目和买卖方分组
      for (const invoice of invoiceDataList) {
        const project = invoice.project || '';
        const buyer = invoice.buyer || '';
        const seller = invoice.seller || '';
        
        // 组合键
        const key = `${project}:${buyer}:${seller}`;
        
        if (!groupedInvoices[key]) {
          groupedInvoices[key] = [];
        }
        
        groupedInvoices[key].push(invoice);
      }
      
      // 保存生成的合同URL和对应的项目名称
      const generatedFiles: string[] = [];
      const projectNamesList: string[] = [];
      
      // 为每个分组生成一份合同
      for (const [groupKey, invoices] of Object.entries(groupedInvoices)) {
        // 提取合同数据
        const contractData = extractDataFromInvoices(invoices);
        
        if (!contractData) {
          console.warn(`无法从分组 ${groupKey} 提取合同数据，跳过该组`);
          continue;
        }
        
        // 准备模板数据
        const templateData = {
          contractNo: `${contractData.projectName}-${new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\//g, '')}`,
          contractDate: new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\//g, '年').replace(/\//g, '月'),
          buyerName: contractData.buyerName || '',
          buyerTaxID: contractData.buyerTaxID || '',
          sellerName: contractData.sellerName || '',
          sellerTaxID: contractData.sellerTaxID || '',
          buyerBank: contractData.buyerBank || '',
          buyerBankAccount: contractData.buyerBankAccount || '',
          sellerBank: contractData.sellerBank || '',
          sellerBankAccount: contractData.sellerBankAccount || '',
          projectName: contractData.projectName || '',
          projectAddress: contractData.projectAddress || '',
          totalAmount: contractData.totalAmount || '0',
          totalTax: contractData.totalTax || '0',
          totalWithTax: contractData.totalWithTax || '0',
          amountInWords: convertToChineseAmount(contractData.totalAmount || '0'),
          taxInWords: convertToChineseAmount(contractData.totalTax || '0'),
          totalWithTaxInWords: convertToChineseAmount(contractData.totalWithTax || '0'),
          firstItemTaxRate: (contractData.invoiceItems && contractData.invoiceItems[0]?.taxRate) || '3%',
          
          // 表格数据 - 确保支持遍历
          items: contractData.invoiceItems?.map((item: InvoiceItem, index: number) => ({
            index: index + 1,
            name: item.name || '',
            spec: item.spec || '',
            unit: item.unit || '',
            quantity: item.quantity || '',
            price: item.price || '',
            amount: item.amount || '',
            taxRate: item.taxRate || '',
            tax: item.tax || '',
            priceWithTax: (Number(item.price) * (1 + Number(item.taxRate.replace('%', '')) / 100)).toFixed(2),
            amountWithTax: (Number(item.amount) * (1 + Number(item.taxRate.replace('%', '')) / 100)).toFixed(2),
          })) || []
        };
        
        try {
          // 在渲染模板之前确保所有必要的变量都存在
          const safeTemplateData = ensureTemplateFields(templateData);
          console.log("安全的模板数据:", safeTemplateData);
          
          // 检查商品名称中是否有星号
          if (safeTemplateData.items && Array.isArray(safeTemplateData.items)) {
            const itemsWithAsterisks = safeTemplateData.items.filter((item: any) => 
              item.name && item.name.includes('*')
            );
            
            if (itemsWithAsterisks.length > 0) {
              console.log("模板数据中带星号的商品:", itemsWithAsterisks.map((item: any) => item.name));
            } else {
              console.log("警告: 模板数据中没有带星号的商品，可能已被移除");
            }
          }
          
          // 加载模板内容
          const buffer = templateContent;
          const zip = new PizZip(buffer);
          
          // 创建docxtemplater实例 (新API)
          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{', end: '}' }
          });
          
          // 添加日志记录当前的docxtemplater配置
          console.log("docxtemplater配置:", {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{', end: '}' }
          });
          
          // 检查模板变量的格式
          console.log("模板数据包含以下字段:", Object.keys(safeTemplateData));
          
          // 确保items数组存在且格式正确
          if (safeTemplateData.items && Array.isArray(safeTemplateData.items)) {
            console.log(`项目列表包含 ${safeTemplateData.items.length} 项，第一项:`, 
              safeTemplateData.items.length > 0 ? safeTemplateData.items[0] : '无项目');
          } else {
            console.warn("项目列表不是数组或为空!");
          }
          
          // 渲染文档
          doc.render(safeTemplateData);
          
          // 生成输出文档
          const generatedDocument = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });
          
          // 构造文件名（从确定的项目名称）
          const rawProjectName = contractData.projectName || 'unknown';
          console.log(`原始项目名称: "${rawProjectName}"`);
          
          // 清理项目名称以用作文件名
          const sanitizedProjectName = rawProjectName
            .replace(/[\\/:*?"<>|]/g, '_')   // 替换文件名中不允许的字符
            .replace(/\s+/g, ' ')            // 替换多个空格为单个空格
            .replace(/^\s+|\s+$/g, '')       // 去除首尾空格
            .substring(0, 50);                // 限制长度
          
          // 添加更多项目名称调试
          console.log('合同用项目名称:', contractData.projectName);
          console.log('处理后的项目名称:', sanitizedProjectName);
          
          const fileName = `${sanitizedProjectName}-合同.docx`;
          
          // 创建URL
          const url = URL.createObjectURL(generatedDocument);
          generatedFiles.push(url);
          projectNamesList.push(sanitizedProjectName);
          
          console.log(`成功生成合同: ${sanitizedProjectName}-合同.docx`);
        } catch (error) {
          console.error('处理模板失败:', error);
          throw error;
        }
      }
      
      // 更新状态
      setGeneratedContracts(generatedFiles);
      setProjectNames(projectNamesList);
      
      // 显示成功信息
      if (generatedFiles.length > 0) {
        alert(`成功生成${generatedFiles.length}个合同文件`);
      } else {
        alert('没有生成任何合同文件，请检查发票数据');
      }
    } catch (error: any) {
      console.error('生成合同失败:', error);
      alert(`生成合同失败: ${error.message || error}`);
    } finally {
      setIsGeneratingContract(false);
    }
  };
  
  // 下载生成的合同
  const handleDownloadContract = (blobUrl: string) => {
    try {
      // 从generatedContracts状态中提取对应的文件名
      const index = generatedContracts.findIndex(url => url === blobUrl);
      const fileName = index >= 0 && projectNames[index] 
        ? `${projectNames[index]}-合同.docx` 
        : 'contract.docx';
      
      console.log('准备下载文件:', fileName);
      
      // 获取Blob对象
      fetch(blobUrl)
        .then(response => response.blob())
        .then(blob => {
          // 使用file-saver库保存文件
          saveAs(blob, fileName);
        })
        .catch(error => {
          console.error('下载合同失败:', error);
          alert(`下载合同失败: ${error.message}`);
        });
    } catch (error: any) {
      console.error('下载合同失败:', error);
      alert(`下载合同失败: ${error.message}`);
    }
  };
  
  // 自定义项目名称提取函数
  const extractProjectName = (content: string, fullText: string): string => {
    // 常见项目标记
    const projectKeys = ['项目/工程', '项目名称', '工程名称', '工程项目'];
    let projectName = '';
    
    // 1. 直接在文本中寻找明显的项目行
    if (content) {
      // 查找包含以上关键字的行
      for (const key of projectKeys) {
        const lines = content.split('\n').filter(line => line.includes(key));
        if (lines.length > 0) {
          const parts = lines[0].split(/[：:]/);
          if (parts.length > 1) {
            projectName = parts[1].trim();
            console.log(`从内容中提取项目名称 (关键字 ${key}): "${projectName}"`);
            if (projectName) return projectName;
          }
        }
      }
    }
    
    // 2. 尝试从全文中提取
    if (fullText) {
      for (const key of projectKeys) {
        const regex = new RegExp(`${key}[：:](.*?)(?=\\n|$)`, 'i');
        const match = fullText.match(regex);
        if (match && match[1]) {
          projectName = match[1].trim();
          console.log(`使用正则从全文中提取项目名称 (关键字 ${key}): "${projectName}"`);
          if (projectName) return projectName;
        }
      }
      
      // 3. 尝试查找包含"项目"或"工程"的行
      const projectLines = fullText.split('\n').filter(line => 
        line.includes('项目') || line.includes('工程')
      );
      
      if (projectLines.length > 0) {
        for (const line of projectLines) {
          if (line.includes('：') || line.includes(':')) {
            const parts = line.split(/[：:]/);
            if (parts.length > 1) {
              projectName = parts[1].trim();
              console.log(`从全文的项目行中提取项目名称: "${projectName}"`);
              if (projectName) return projectName;
            }
          }
        }
      }
    }
    
    // 如果上述方法都失败，尝试在发票内容中寻找可能的项目信息
    if (content) {
      const contentLines = content.split('\n');
      // 查找包含"项目"但不在冒号前面的行
      for (const line of contentLines) {
        if ((line.includes('项目') || line.includes('工程')) && 
            !line.match(/^[^：:]*项目[^：:]*[:：]/)) {
          console.log(`找到可能的项目行: "${line}"`);
          return line.trim();
        }
      }
    }
    
    return '未知项目';
  };

  // 修改extractDataFromInvoices函数，增加更多安全检查
  const extractDataFromInvoices = (invoices: LocalInvoiceData[]) => {
    if (!invoices || invoices.length === 0) {
      console.warn('没有提供有效的发票数据');
      return null;
    }

    console.log('开始处理发票数据，共', invoices.length, '张发票');
    
    // 从发票全文中提取关键信息
    const extractField = (fieldName: string, text: string | undefined): string => {
      if (!text) return '';
      
      try {
        // 针对不同字段使用更精确的正则表达式
        const regex = new RegExp(`${fieldName}[：:]\\s*([^\\n]+)`, 'i');
        const match = text.match(regex);
        
        if (match && match[1]) {
          const result = match[1].trim();
          console.log(`成功提取字段 "${fieldName}": "${result}"`);
          return result;
        }
        
        // 尝试更宽松的匹配
        const looseRegex = new RegExp(`${fieldName}.*?[：:]\\s*([^\\n]+)`, 'i');
        const looseMatch = text.match(looseRegex);
        
        if (looseMatch && looseMatch[1]) {
          const result = looseMatch[1].trim();
          console.log(`使用宽松匹配成功提取字段 "${fieldName}": "${result}"`);
          return result;
        }
        
        console.log(`未能提取字段 "${fieldName}"`);
        return '';
      } catch (error) {
        console.warn(`提取字段 ${fieldName} 时出错:`, error);
        return '';
      }
    };
    
    // 初始化合同数据
    const contractData: any = {
      buyerName: '',
      buyerTaxID: '',
      sellerName: '',
      sellerTaxID: '',
      sellerBank: '',
      sellerBankAccount: '',
      projectName: '',
      projectAddress: '',
      invoiceItems: [],
      totalAmount: '0.00',
      totalTax: '0.00',
      totalWithTax: '0.00'
    };
    
    // 累计金额
    let totalAmount = 0;
    let totalTax = 0;
    
    // 处理每张发票
    for (const invoice of invoices) {
      if (!invoice) {
        console.warn('跳过无效发票');
        continue;
      }
      
      // 确保这些值不是undefined
      const fullText = invoice.fullText || '';
      const content = invoice.content || '';
      
      console.log('处理发票:', {
        发票名称: invoice.fileName || '未知',
        发票号码: invoice.invoiceNumber || '未知',
        买方: invoice.buyer || '未知',
        卖方: invoice.seller || '未知',
        项目: invoice.project || '未知',
        有全文: !!fullText,
        全文长度: fullText.length,
        有内容: !!content,
        内容长度: content.length
      });
      
      try {
        // 更新买方信息 (优先使用之前提取的)
        if (!contractData.buyerName) {
          contractData.buyerName = invoice.buyer || extractField('购买方', fullText);
        }
        
        if (!contractData.buyerTaxID) {
          contractData.buyerTaxID = invoice.buyerTaxID || extractField('购买方.*?税号', fullText);
        }
        
        // 更新卖方信息
        if (!contractData.sellerName) {
          contractData.sellerName = invoice.seller || extractField('销售方', fullText);
        }
        
        if (!contractData.sellerTaxID) {
          contractData.sellerTaxID = invoice.sellerTaxID || extractField('销售方.*?税号', fullText);
        }
        
        // 提取银行信息
        if (!contractData.sellerBank) {
          contractData.sellerBank = invoice.sellerBank || extractField('销售方.*?开户行', fullText);
        }
        
        if (!contractData.sellerBankAccount) {
          contractData.sellerBankAccount = invoice.sellerBankAccount || extractField('销售方.*?账号', fullText);
        }
        
        // 提取项目信息
        if (!contractData.projectName) {
          // 首先检查invoice对象中的project字段
          if (invoice.project) {
            contractData.projectName = invoice.project;
            console.log(`使用invoice对象的项目名称: "${contractData.projectName}"`);
          } else {
            // 使用自定义提取函数
            contractData.projectName = extractProjectName(content, fullText);
            console.log(`提取到的项目名称: "${contractData.projectName}"`);
          }
        }
        
        if (!contractData.projectAddress) {
          contractData.projectAddress = invoice.projectAddress || extractField('地址|工程地址', fullText);
        }
        
        // 处理发票项目
        if (invoice.itemsTable) {
          try {
            // 处理表格
            const items = invoice.itemsTable;
            
            if (items && items.length > 0) {
              // 直接使用items数组中的每个项目
              for (const item of items) {
                // 跳过汇总行 - 检查名称
                const isHeaderOrSummary = 
                  !item.name || 
                  item.name.includes('合计') || 
                  item.name.includes('价税合计') || 
                  item.name.includes('不含税金额') ||
                  item.name.includes('价税合');
                
                if (isHeaderOrSummary) {
                  console.log(`跳过汇总行: ${item.name}`);
                  continue;
                }
                
                // 计算项目金额和税额
                if (item.amount) {
                  try {
                    const amount = parseFloat(item.amount.replace(/[^\d.-]/g, '')) || 0;
                    totalAmount += amount;
                    
                    // 计算税额 - 直接使用税额列
                    if (item.tax) {
                      const tax = parseFloat(item.tax.replace(/[^\d.-]/g, '')) || 0;
                      totalTax += tax;
                    } 
                    // 如果没有税额列但有税率列，从金额和税率计算
                    else if (item.taxRate) {
                      let taxRate = 0;
                      const taxRateStr = item.taxRate.replace(/[^\d.%]/g, '');
                      
                      if (taxRateStr.includes('%')) {
                        taxRate = parseFloat(taxRateStr) / 100;
                      } else {
                        taxRate = parseFloat(taxRateStr);
                        // 如果税率看起来不是百分比格式(>1)，则假设它已经是小数
                        if (taxRate > 1) {
                          taxRate = taxRate / 100;
                        }
                      }
                      
                      const tax = amount * taxRate;
                      totalTax += tax;
                      item.tax = tax.toFixed(2); // 更新项目税额
                    }
                  } catch (e) {
                    console.warn('解析金额或税额失败:', e);
                  }
                }
                
                // 添加到商品列表
                contractData.invoiceItems.push(item);
              }
            }
          } catch (e) {
            console.error('处理商品表格失败:', e);
          }
        }
      } catch (error) {
        console.error('处理发票过程中发生错误:', error);
        // 继续处理下一张发票
      }
    }
    
    // 处理完所有发票后，更新合同数据中的金额
    contractData.totalAmount = totalAmount.toFixed(2);
    contractData.totalTax = totalTax.toFixed(2);
    // 含税总额 = 总金额 + 总税额
    contractData.totalWithTax = (totalAmount + totalTax).toFixed(2);

    console.log('计算的金额：', {
      不含税总额: contractData.totalAmount,
      税额: contractData.totalTax,
      含税总额: contractData.totalWithTax
    });
    
    console.log('提取的合同数据:', contractData);
    
    // 检查是否有必要的数据
    if (!contractData.buyerName || !contractData.sellerName || contractData.invoiceItems.length === 0) {
      console.warn('关键合同数据缺失');
      return contractData; // 仍然返回数据，由调用者决定如何处理
    }
    
    return contractData;
  };
  
  // 数字金额转中文大写
  const convertToChineseAmount = (amount: string | number): string => {
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
  };

  // 在渲染模板之前确保所有必要的变量都存在
  // 添加此检查到handleGenerateContract函数中处理模板数据的部分
  // 确保所有必要的模板字段都有值
  const ensureTemplateFields = (data: Record<string, any>): Record<string, any> => {
    // 检查example-template.txt中的所有必需字段
    const requiredFields = [
      'contractNo', 'buyerName', 'buyerTaxID', 'sellerName', 'sellerTaxID',
      'projectName', 'projectAddress', 'totalAmount', 'amountInWords',
      'totalTax', 'taxInWords', 'totalWithTax', 'totalWithTaxInWords',
      'buyerBank', 'buyerBankAccount', 'sellerBank', 'sellerBankAccount',
      'contractDate', 'items'
    ];
    
    const result = { ...data };
    
    // 确保所有字段都存在
    for (const field of requiredFields) {
      if (!result[field] || result[field] === '') {
        if (field === 'items' && (!result[field] || !Array.isArray(result[field]))) {
          result[field] = [];
          console.warn(`模板字段 "${field}" 不是数组，设为空数组`);
        } else {
          result[field] = field.includes('Date') ? new Date().toLocaleDateString() : '未提供';
          console.warn(`模板字段 "${field}" 缺失，使用默认值`);
        }
      }
    }
    
    // 确保项目名称非空
    if (!result.projectName || result.projectName === '未知项目' || result.projectName === '未提供') {
      result.projectName = `合同-${new Date().toISOString().slice(0, 10)}`;
      console.log(`使用日期作为项目名称: "${result.projectName}"`);
    }
    
    // 确保items数组每一项都有必要的属性
    if (Array.isArray(result.items)) {
      result.items = result.items.map((item, index) => {
        const safeItem = { ...item };
        const itemFields = ['index', 'name', 'spec', 'unit', 'quantity', 'price', 'amount', 'taxRate', 'tax'];
        
        for (const field of itemFields) {
          if (!safeItem[field]) {
            safeItem[field] = field === 'index' ? (index + 1) : '';
          }
        }
        
        return safeItem;
      });
    }
    
    return result;
  };

  // 增加发票详细显示，只显示不生成合同
  const renderInvoiceDetails = () => {
    if (!invoiceDataList.length) {
      return null;
    }
    
    return (
      <div className="space-y-8">
        {invoiceDataList.map((invoice, index) => {
          
          // 拆分内容为关键信息、商品明细和原始文本部分
          const parts = invoice.content?.split('## 原始文本（完整）：') || ['', ''];
          const keyInfo = parts[0] || '';
          const rawText = parts[1] || '';
          
          // 进一步拆分关键信息和商品明细
          const hasItemsTable = keyInfo.includes('## 商品明细表格:');
          const hasItems = keyInfo.includes('## 商品原始信息:');
          
          // 提取基本信息（不包括商品明细）
          let basicInfo = keyInfo;
          let itemsTableSection = '';
          let itemsSection = '';
          
          // 使用 itemsTable 直接创建表格，不依赖于文本解析
          if (invoice.itemsTable && invoice.itemsTable.length > 0) {
            itemsTableSection = 'DIRECT_ITEMS_TABLE';
          } else if (hasItemsTable) {
            const itemsTableParts = keyInfo.split('## 商品明细表格:');
            basicInfo = itemsTableParts[0];
            
            // 如果还有原始商品信息，继续拆分
            if (hasItems) {
              const remainingParts = itemsTableParts[1].split('## 商品原始信息:');
              itemsTableSection = remainingParts[0];
              itemsSection = remainingParts[1];
            } else {
              itemsTableSection = itemsTableParts[1];
            }
          } else if (hasItems) {
            const itemsParts = keyInfo.split('## 商品原始信息:');
            basicInfo = itemsParts[0];
            itemsSection = itemsParts[1];
          }
          
          // 格式化基本信息，用表格显示
          const infoLines = basicInfo.replace('## 提取的关键信息：\n', '').split('\n')
            .filter(line => line.trim());
          
          // 确保项目/工程字段显示
          const hasProject = infoLines.some(line => line.includes('项目/工程:') || line.includes('项目/工程：'));
          
          // 处理商品明细表格
          const renderItemsTable = () => {
            console.log('Rendering items table section:', {
              itemsTableSection,
              hasItemsTable: !!itemsTableSection,
              directItems: itemsTableSection === 'DIRECT_ITEMS_TABLE'
            });
            
            // 如果我们有直接的商品数据，使用它来渲染表格
            if (itemsTableSection === 'DIRECT_ITEMS_TABLE' && invoice.itemsTable && invoice.itemsTable.length > 0) {
              const items = invoice.itemsTable;
              
              return (
                <div className="mt-6 bg-white rounded-lg shadow overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">规格</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单位</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单价</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金额</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">税率</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">税额</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.map((item, itemIndex) => (
                        <tr key={itemIndex} className={itemIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.name}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.spec}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.unit}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.price}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.amount}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.taxRate}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.tax}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            
            if (!itemsTableSection) return null;
            
            // 解析表格数据 (原有的文本解析逻辑)
            const rows = itemsTableSection.trim().split('\n')
              .filter(line => !line.includes('---'));
              
            if (rows.length < 2) return null;
            
            const headers = rows[0].split('\t');
            const dataRows = rows.slice(1);
            
            return (
              <div className="mt-6 bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map((header, i) => (
                        <th 
                          key={i} 
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dataRows.map((row, rowIndex) => {
                      const cells = row.split('\t');
                      return (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {cells.map((cell, cellIndex) => (
                            <td 
                              key={cellIndex} 
                              className="px-3 py-2 whitespace-nowrap text-sm text-gray-500"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          };
          
          return (
            <div key={index} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <h3 className="text-xl font-bold border-b pb-2 mb-4">发票 {index + 1}: {invoice.fileName}</h3>
              
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-2 text-blue-600">基本信息</h4>
                <div className="bg-blue-50 p-4 rounded-md">
                  <table className="w-full table-auto">
                    <tbody>
                      {infoLines.map((line, i) => {
                        if (!line.trim()) return null;
                        const [key, value] = line.split(': ').map(s => s.trim());
                        return (
                          <tr key={i} className={i % 2 === 0 ? "bg-blue-100 bg-opacity-50" : ""}>
                            <td className="py-2 px-3 font-semibold w-40">{key}</td>
                            <td className="py-2 px-3">{value || '未找到'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {itemsTableSection && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-2 text-green-600">商品明细</h4>
                  {renderItemsTable()}
                </div>
              )}
              
              {/* 商品原始信息和原始文本框已移除 */}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading || isGeneratingContract) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="spinner mb-4"></div>
        <p className="text-gray-600">{isGeneratingContract ? '正在生成合同，请稍候...' : '处理中，请稍候...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">项目详情</h3>
        <div className="bg-gray-50 p-4 rounded-md">
          <p><span className="font-medium">项目名称:</span> {project.name}</p>
          <p><span className="font-medium">发票数量:</span> {project.invoices.length} 张</p>
        </div>
      </div>

      {invoiceDataList.length > 0 ? (
        <div>
          <h3 className="text-lg font-medium mb-4">发票内容详情</h3>
          {renderInvoiceDetails()}
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded-md">
          <p className="text-gray-500">请先上传发票以查看内容</p>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium mb-2">合同生成</h3>
        {templateContent ? (
          <p className="text-green-600 mb-4">✓ 合同模板已加载</p>
        ) : (
          <p className="text-red-600 mb-4">✗ 合同模板加载失败</p>
        )}

        <button
          onClick={handleGenerateContract}
          disabled={!templateContent || invoiceDataList.length === 0 || isGeneratingContract}
          className={`px-4 py-2 rounded-md ${
            !templateContent || invoiceDataList.length === 0 || isGeneratingContract
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          生成合同
        </button>

        {generatedContracts.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">已生成的合同:</h4>
            <ul className="space-y-2">
              {generatedContracts.map((contract, index) => (
                <li key={index} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                  <span>{projectNames[index] ? `${projectNames[index]}-合同.docx` : '未知项目合同.docx'}</span>
                  <button
                    onClick={() => handleDownloadContract(contract)}
                    className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                  >
                    下载
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-sm text-gray-500 mt-2">
          请先查看上方的发票内容，确认提取的信息是否正确。确认无误后，点击"生成合同"按钮生成合同文件。
        </p>
      </div>
    </div>
  );
} 