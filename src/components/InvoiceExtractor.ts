export interface InvoiceData {
  invoiceNumber: string;      // 发票号码
  date: string;               // 开票日期
  buyer: string;              // 购买方名称
  buyerTaxID: string;         // 购买方税号
  buyerBank: string;          // 购方开户银行
  buyerBankAccount: string;   // 购方银行账号
  seller: string;             // 销售方名称
  sellerTaxID: string;        // 销售方税号
  sellerBank: string;         // 销方开户银行
  sellerBankAccount: string;  // 销方银行账号
  project: string;            // 项目名称
  projectAddress: string;     // 项目地址
  issuer: string;             // 开票人
  items: InvoiceItem[];       // 商品明细
  totalAmount: string;        // 不含税金额
  totalTax: string;           // 税额合计
  totalWithTax: string;       // 含税总金额
}

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

export const extractInvoiceDetails = (text: string): InvoiceData => {
  const invoice: InvoiceData = {
    invoiceNumber: '',
    date: '',
    buyer: '',
    buyerTaxID: '',
    buyerBank: '',
    buyerBankAccount: '',
    seller: '',
    sellerTaxID: '',
    sellerBank: '',
    sellerBankAccount: '',
    project: '',
    projectAddress: '',
    issuer: '',
    items: [],
    totalAmount: '0',
    totalTax: '0',
    totalWithTax: '0'
  };

  let isParsingItems = false;
  const lines = text.split('\n').map(line => line.trim());

  lines.forEach(line => {
    // ================= 基础信息提取 =================
    if (line.includes('发票号码：')) {
      invoice.invoiceNumber = line.split('发票号码：')[1].trim();
    }
    else if (line.startsWith('开票日期：')) {
      invoice.date = line.split('开票日期：')[1].trim();
    }
    else if (line.includes('购 名称：') && line.includes('销 名称：')) {
      const [buyerPart, sellerPart] = line.split('销 名称：');
      invoice.buyer = buyerPart.split('购 名称：')[1].trim();
      invoice.seller = sellerPart.trim();
    }
    else if (line.includes('纳税人识别号：') && line.includes('统一社会信用代码 / 纳税人识别号：')) {
      const texPartSplit = line.split('信 统一社会信用代码 / 纳税人识别号：');
      const buyerTaxPart = texPartSplit[1]
      const sellerTaxPart = texPartSplit[2]
      invoice.buyerTaxID = buyerTaxPart.trim();
      invoice.sellerTaxID = sellerTaxPart.trim();
    }
    else if (line.includes('购方开户银行 :')) {
      const [bankPart, accountPart] = line.split('银行账号 :');
      invoice.buyerBank = bankPart.split(':')[1].replace(';', '').trim();
      invoice.buyerBankAccount = accountPart.replace(';', '').trim();
    }
    else if (line.includes('销方开户银行 :')) {
      const [bankPart, accountPart] = line.split('银行账号 :');
      invoice.sellerBank = bankPart.split(':')[1].replace(';', '').trim();
      invoice.sellerBankAccount = accountPart.replace(';', '').trim();
    }
    else if (line.includes('项目名称：')) {
      invoice.project = line.split('项目名称：')[1].trim();
    }
    else if (line.includes('地址：')) {
      invoice.projectAddress = line.split('地址：')[1].trim();
    }
    else if (line.includes('开票人：')) {
      invoice.issuer = line.split('开票人：')[1].trim();
    }

    // ================= 商品明细处理 =================
    else if (line.includes('【商品明细开始】')) {
      isParsingItems = true;
      console.log('Started parsing items');
    }
    else if (line.includes('【商品明细结束】')) {
      isParsingItems = false;
      console.log('Finished parsing items. Total items found:', invoice.items.length);
      console.log('Items:', invoice.items);
      // 计算统计值
      invoice.totalAmount = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2);
      invoice.totalTax = invoice.items.reduce((sum, item) => sum + Number(item.tax), 0).toFixed(2);
      invoice.totalWithTax = (Number(invoice.totalAmount) + Number(invoice.totalTax)).toFixed(2);
    }
    else if (isParsingItems && line.includes('|')) {
      console.log('Processing item line:', line);
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 7) {
        const item = {
          name: parts[0],
          spec: parts.length >= 8 ? parts[1] : '',
          unit: parts.length >= 8 ? parts[2] : parts[1],
          quantity: parts.length >= 8 ? parts[3] : parts[2],
          price: parts.length >= 8 ? parts[4] : parts[3],
          amount: parts.length >= 8 ? parts[5] : parts[4],
          taxRate: parts.length >= 8 ? parts[6] : parts[5],
          tax: parts.length >= 8 ? parts[7] : parts[6]
        };
        console.log('Extracted item:', item);
        invoice.items.push(item);
      } else {
        console.log('Skipping line - insufficient parts:', parts.length);
      }
    }
  });

  return invoice;
};