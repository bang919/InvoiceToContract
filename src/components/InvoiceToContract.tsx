"use client";
import { useState, useRef, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { createReport } from "docx-templates";
import { saveAs } from "file-saver";

export default function InvoiceToContract() {
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [templateContent, setTemplateContent] = useState<string>("");
  const [contractBuffer, setContractBuffer] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载并分析模板
  useEffect(() => {
    const analyzeTemplate = async () => {
      try {
        // 从public目录加载模板
        const templateRes = await fetch("/contract-template.docx");
        const templateBuffer = await templateRes.arrayBuffer();
        
        // 将二进制数据转换为文本（这只能获取部分可读内容）
        const textDecoder = new TextDecoder("utf-8");
        let text = textDecoder.decode(templateBuffer);
        
        // 提取可能的变量标记
        const variablePattern = /\{\{([^}]+)\}\}/g;
        const variables = new Set<string>();
        let match;
        while ((match = variablePattern.exec(text)) !== null) {
          variables.add(match[1].trim());
        }
        
        setTemplateContent(`找到可能的变量标记: ${Array.from(variables).join(", ") || "未找到变量标记"}\n\n模板部分内容预览：\n${text.substring(0, 500)}...`);
      } catch (error) {
        console.error("分析模板出错:", error);
        setError("无法分析模板，可能格式不兼容。请手动查看模板文件，确定变量标记。");
        setTemplateContent("无法分析模板，可能格式不兼容。请手动查看模板文件，确定变量标记。");
      }
    };
    
    analyzeTemplate();
  }, []);

  // 1. 解析PDF发票
  const parseInvoicePDF = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      
      // 获取页面文本（注: pdf-lib不直接支持文本提取，这里是示意代码）
      // 实际项目中您可能需要使用pdf.js或其他库来提取文本
      const text = "示例文本，实际需要用pdf.js提取";
      
      // 按Y坐标分组文本行（解决乱序问题）
      // 此处是示意代码，实际需要根据PDF结构调整
      
      // 关键字段提取（根据发票结构调整正则）
      const extractField = (pattern: RegExp, sample: string) => sample.match(pattern)?.[1]?.trim() || "";
      
      // 模拟提取的数据
      const data = {
        invoiceNo: "1234567890",
        date: "2023年12月31日",
        buyerName: "河南萌堡建筑工程有限公司",
        buyerTaxId: "91410100MA9LRA9Q7H",
        sellerName: "漯河锦星建材有限公司",
        sellerTaxId: "91411122MA44TGADX3",
        projectName: "临颍县引澧入颍水源置换和水系连通项目（水系连通工程）",
        projectAddress: "临颍县全域内",
        totalAmount: "6229800",
        items: [
          {
            name: "C15混凝土",
            spec: "标准",
            unit: "m³",
            quantity: "1500",
            price: "265",
            amount: "397500",
            taxRate: "3%"
          },
          {
            name: "C20混凝土",
            spec: "标准",
            unit: "m³",
            quantity: "13923.07",
            price: "262",
            amount: "3647842.92",
            taxRate: "3%"
          },
          {
            name: "C25混凝土",
            spec: "标准",
            unit: "m³",
            quantity: "6106.86",
            price: "278",
            amount: "1697707.08",
            taxRate: "3%"
          },
          {
            name: "C30混凝土",
            spec: "标准",
            unit: "m³",
            quantity: "1650",
            price: "295",
            amount: "486750",
            taxRate: "3%"
          }
        ]
      };
      
      setInvoiceData(data);
    } catch (error: any) {
      console.error("解析PDF出错:", error);
      setError(`解析PDF发票失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. 生成合同DOCX - 完全在客户端处理
  const generateContract = async () => {
    if (!invoiceData) {
      setError("没有可用的发票数据");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // 从public目录加载模板
      const templateRes = await fetch("/contract-template.docx");
      if (!templateRes.ok) {
        throw new Error(`无法加载模板: ${templateRes.status} ${templateRes.statusText}`);
      }
      
      const templateBuffer = await templateRes.arrayBuffer();
      console.log("模板加载成功，大小:", templateBuffer.byteLength, "字节");

      // 准备数据
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const day = currentDate.getDate().toString().padStart(2, '0');
      
      const templateData = {
        ...invoiceData,
        contractDate: `${year}年${month}月${day}日`,
        // 表格数据
        tableData: invoiceData.items.map((item: any, index: number) => ({
          index: index + 1,
          name: item.name.replace(/\*/g, ""),
          spec: item.spec,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          amount: item.amount
        })),
        // 合同编号
        contractNo: `${year}${month}${day}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        // 大写金额
        amountInWords: convertToChineseAmount(invoiceData.totalAmount),
        // 日期变量
        year,
        month,
        day
      };
      
      console.log("准备替换数据:", JSON.stringify(templateData, null, 2));
      
      // 尝试使用不同的分隔符选项
      const options = [
        { desc: "默认分隔符", delim: ["{{", "}}"] as [string, string] },
        { desc: "不指定分隔符", delim: undefined },
        { desc: "使用大括号", delim: ["{", "}"] as [string, string] },
        { desc: "使用美元符号", delim: ["${", "}"] as [string, string] }
      ];
      
      let docBuffer = null;
      let successOption = null;
      
      // 尝试所有分隔符选项
      for (const option of options) {
        try {
          console.log(`尝试使用 ${option.desc}...`);
          
          // 替换数据
          docBuffer = await createReport({
            template: new Uint8Array(templateBuffer),
            data: templateData,
            cmdDelimiter: option.delim,
          });
          
          successOption = option;
          console.log(`成功使用 ${option.desc} 生成文档!`);
          break;
        } catch (err: any) {
          console.error(`使用 ${option.desc} 失败:`, err.message);
        }
      }
      
      if (!docBuffer) {
        throw new Error("所有分隔符选项都失败，无法生成合同文档");
      }
      
      // 存储在内存中，不立即下载
      setContractBuffer(docBuffer);
      
      console.log(`合同已生成并保存在内存中，使用了 ${successOption?.desc || '未知'} 选项`);
      
    } catch (error: any) {
      console.error("生成合同失败:", error);
      setError(`生成合同失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. 上传并处理发票
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // 处理第一个文件
    await parseInvoicePDF(files[0]);
  };

  // 下载生成的合同
  const downloadGeneratedContract = () => {
    if (!contractBuffer) {
      setError("没有可用的合同文档");
      return;
    }
    
    try {
      // 创建Blob对象
      const blob = new Blob([contractBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      // 生成文件名
      const fileName = `合同_${invoiceData?.projectName || '未命名'}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.docx`;
      
      // 保存文件
      saveAs(blob, fileName);
      
      console.log("合同已下载:", fileName);
    } catch (error: any) {
      console.error("下载合同失败:", error);
      setError(`下载合同失败: ${error.message}`);
    }
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

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">发票转合同工具</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg border border-red-300">
          {error}
        </div>
      )}
      
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">步骤1: 上传发票</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleUpload}
            accept=".pdf"
            className="p-2 border rounded"
          />
        </div>
      </div>
      
      {invoiceData && (
        <div className="mb-6 p-4 bg-gray-100 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">步骤2: 提取的发票信息</h2>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div><strong>买方:</strong> {invoiceData.buyerName}</div>
            <div><strong>卖方:</strong> {invoiceData.sellerName}</div>
            <div><strong>买方税号:</strong> {invoiceData.buyerTaxId || invoiceData.buyerTaxID}</div>
            <div><strong>卖方税号:</strong> {invoiceData.sellerTaxId || invoiceData.sellerTaxID}</div>
            <div><strong>项目名称:</strong> {invoiceData.projectName}</div>
            <div><strong>总金额:</strong> {invoiceData.totalAmount}</div>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={generateContract}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              {loading ? "生成中..." : "生成合同"}
            </button>
            
            {contractBuffer && (
              <button 
                onClick={downloadGeneratedContract}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                下载合同
              </button>
            )}
          </div>
        </div>
      )}
      
      <div className="p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">模板信息</h2>
        <pre className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">
          {templateContent || "加载模板信息..."}
        </pre>
      </div>
    </div>
  );
} 