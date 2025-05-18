'use client';

import { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import * as pdfLib from 'pdf-lib';
import * as docx from 'docx';
import JSZip from 'jszip';
import { extractInvoiceDetails, InvoiceData } from './InvoiceExtractor';
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

export default function ContractGenerator({ project }: ContractGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceDataList, setInvoiceDataList] = useState<InvoiceData[]>([]);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [templateContent, setTemplateContent] = useState<ArrayBuffer | null>(null);
  const [pdfjs, setPdfjs] = useState<any>(null);
  const [generatedContracts, setGeneratedContracts] = useState<string[]>([]);
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);

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

  // 从PDF中提取文本 - 优化文本提取顺序
  const extractTextFromPDF = async (file: File): Promise<{text: string, textItems: any[]}> => {
    if (!pdfjs) {
      return {text: `[PDF处理库尚未加载]`, textItems: []};
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
        
        console.log(`第${i}页有效文本项数量: ${pageTextItems.length}`);
        if (pageTextItems.length > 0) {
          console.log(`第${i}页前5个文本项示例:`, 
            pageTextItems.slice(0, 5).map(item => `"${item.text}"(x:${item.x},y:${item.y})`).join(', '));
        }
        
        // 按行分组（基于Y坐标，允许小误差）
        const yTolerance = 5; // Y坐标容差
        const rows: any[] = [];
        let currentRow: any[] = [];
        
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
          const row = rows[j];
          const rowText = row.map((item: any) => item.text).join(' ');
          
          // 检测是否进入商品明细区域
          if (rowText.includes('项目名称') && rowText.includes('规格型号') && rowText.includes('单位') && rowText.includes('数量')) {
            isInItemsSection = true;
            itemsText += '【商品明细开始】\n';
            itemsText += rowText + '\n';
            console.log(`第${i}页第${j+1}行识别为商品明细表头: ${rowText}`);
            continue;
          }
          
          // 检测是否离开商品明细区域
          if (isInItemsSection && (rowText.includes('合计') || rowText.includes('价税合计'))) {
            itemsText += rowText + '\n';
            itemsText += '【商品明细结束】\n';
            isInItemsSection = false;
            console.log(`第${i}页第${j+1}行识别为商品明细结束: ${rowText}`);
            continue;
          }
          
          // 处理商品明细区域内的行
          if (isInItemsSection) {
            itemsText += rowText + '\n';
            console.log(`第${i}页第${j+1}行属于商品明细: ${rowText}`);
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
      
      // 返回提取的文本和文本项
      return {
        text: fullText.trim(),
        textItems: allTextItems
      };
    } catch (error) {
      console.error('PDF提取失败:', error);
      return {text: `[无法读取PDF内容: ${file.name}]`, textItems: []};
    }
  };

  // 处理发票读取 - 修改以提取结构化信息并保留完整原文
  useEffect(() => {
    const processInvoices = async () => {
      if (!project.invoices.length || !pdfjs) return;

      setIsLoading(true);
      const processedInvoices: InvoiceData[] = [];

      try {
        for (const invoice of project.invoices) {
          // 读取PDF发票内容
          console.log(`开始处理发票: ${invoice.name}`);
          const {text, textItems} = await extractTextFromPDF(invoice);
          
          console.log(`发票 ${invoice.name} 提取完成，文本长度: ${text.length}, textItems数量: ${textItems.length}`);
          
          // 检查textItems的内容
          if (textItems.length > 0) {
            console.log(`发票 ${invoice.name} 的textItems示例:`, 
              textItems.slice(0, 3).map(item => `"${item.text}"(x:${item.x},y:${item.y})`).join(', '));
          } else {
            console.warn(`警告: 发票 ${invoice.name} 的textItems为空!`);
          }
          
          // 提取关键详情
          console.log(`开始从发票 ${invoice.name} 提取详细信息，传递 ${textItems.length} 个textItems`);
          const details = extractInvoiceDetails(text, textItems);
          
          console.log(`发票 ${invoice.name} 详情提取完成，items字段长度: ${details.items?.length || 0}, itemsTable字段长度: ${details.itemsTable?.length || 0}`);
          
          // 保存完整信息，包括原始文本和提取的结构化信息
          const formattedContent = `## 提取的关键信息：\n` +
            `${details.invoiceNumber ? `发票号码: ${details.invoiceNumber}\n` : ''}` +
            `${details.invoiceCode ? `发票代码: ${details.invoiceCode}\n` : ''}` +
            `${details.date ? `开票日期: ${details.date}\n` : ''}` +
            `${details.seller ? `销售方: ${details.seller}\n` : ''}` +
            `${details.sellerTaxID ? `销售方税号: ${details.sellerTaxID}\n` : ''}` +
            `${details.sellerBank ? `销方开户银行: ${details.sellerBank}\n` : ''}` +
            `${details.sellerBankAccount ? `银行账号: ${details.sellerBankAccount}\n` : ''}` +
            `${details.buyer ? `购买方: ${details.buyer}\n` : ''}` +
            `${details.buyerTaxID ? `购买方税号: ${details.buyerTaxID}\n` : ''}` +
            `${details.amount ? `金额: ${details.amount}\n` : ''}` +
            `${details.amountInWords ? `金额大写: ${details.amountInWords}\n` : ''}` +
            `${details.project ? `项目/工程: ${details.project}\n` : ''}` +
            `${details.projectAddress ? `工程地址: ${details.projectAddress}\n` : ''}` +
            `${details.issuer ? `开票人: ${details.issuer}\n` : ''}` +
            `${details.itemsTable ? `\n## 商品明细表格:\n${details.itemsTable}\n` : ''}` +
            `${details.items ? `\n## 商品原始信息:\n${details.items}\n` : ''}` +
            `\n## 原始文本（完整）：\n${text}`;
          
          processedInvoices.push({
            fileName: invoice.name,
            content: formattedContent,
            invoiceNumber: details.invoiceNumber,
            date: details.date,
            amount: details.amount,
            items: details.items,
            itemsTable: details.itemsTable,
            fullText: details.fullText,
            issuer: details.issuer
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
    if (invoiceDataList.length === 0) {
      alert('请先上传发票');
      return;
    }
    
    setIsGeneratingContract(true);
    
    try {
      // 使用API端点生成合同
      const response = await fetch('/api/generate-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoices: invoiceDataList }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '合同生成失败');
      }
      
      // 更新状态
      setGeneratedContracts(result.files || []);
      
      // 显示成功信息
      if (result.files && result.files.length > 0) {
        alert(`成功生成${result.files.length}个合同文件`);
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
  const handleDownloadContract = (filePath: string) => {
    // 构建完整的URL
    const fullUrl = window.location.origin + filePath;
    console.log('尝试下载文件:', fullUrl);
    
    // 使用fetch获取文件并下载
    fetch(fullUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`下载失败: ${response.status} ${response.statusText}`);
        }
        return response.blob();
      })
      .then(blob => {
        // 使用file-saver库保存文件
        const fileName = filePath.split('/').pop() || 'contract.docx';
        saveAs(blob, fileName);
      })
      .catch(error => {
        console.error('下载合同失败:', error);
        alert(`下载合同失败: ${error.message}`);
      });
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
          
          if (hasItemsTable) {
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
          
          // 调试日志，检查是否有项目/工程信息
          console.log("基本信息行:", infoLines);
          
          // 确保项目/工程字段显示
          const hasProject = infoLines.some(line => line.includes('项目/工程:') || line.includes('项目/工程：'));
          
          // 处理商品明细表格
          const renderItemsTable = () => {
            if (!itemsTableSection) return null;
            
            // 解析表格数据
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
                            <td className="py-2 px-3 font-semibold">{key}</td>
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
                  <span>{contract.split('/').pop()}</span>
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