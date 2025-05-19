# Docxtemplater 模板指南

## 基本变量替换

在Word文档中，您可以使用`{variable}`语法标记需要动态替换的内容：

```
合同编号：{contractNo}
买方名称：{buyerName}
卖方名称：{sellerName}
```

## 表格循环处理

对于需要循环的表格内容，Docxtemplater使用以下语法：

### 步骤1：创建一个包含一行的表格
在Word中创建表格，表头行之后只需要添加一行用于循环，如下所示：

| 序号 | 名称 | 规格型号 | 数量 | 单位 | 单价 | 金额 | 税率 | 税额 |
|------|------|---------|------|------|------|------|------|------|
| {#items}{index} | {name} | {spec} | {quantity} | {unit} | {price} | {amount} | {taxRate} | {tax} |{/items}

### 重要说明

1. **循环开始和结束标记**:
   - `{#items}` 表示循环开始（items是数据中的数组名称）
   - `{/items}` 表示循环结束

2. **表格的创建方式**:
   - 创建表格时确保使用Word的表格功能，设置好边框格式
   - 只在一行中放置循环内容，docxtemplater会自动复制这一行

3. **模板中可用的变量**:
   - 基本信息: `{buyerName}`, `{sellerName}`, `{buyerTaxID}`, `{sellerTaxID}`, `{projectName}`, `{projectAddress}`
   - 银行信息: `{buyerBank}`, `{buyerBankAccount}`, `{sellerBank}`, `{sellerBankAccount}`
   - 金额信息:
     - 不含税金额: `{totalAmount}`, `{amountInWords}`（中文大写）
     - 税额: `{totalTax}`, `{taxInWords}`（中文大写）
     - 含税总金额: `{totalWithTax}`, `{totalWithTaxInWords}`（中文大写）
   - 日期编号: `{contractDate}`, `{contractNo}`
   - 税率信息: `{firstItemTaxRate}`（第一个商品的税率）
   - 表格项目: 需在`{#items}...{/items}`循环中使用: 
     - `{index}`: 序号
     - `{name}`: 名称
     - `{spec}`: 规格型号
     - `{unit}`: 单位
     - `{quantity}`: 数量
     - `{price}`: 单价
     - `{amount}`: 金额（不含税）
     - `{taxRate}`: 税率
     - `{tax}`: 税额

## 常见问题解决

1. **变量不被替换**:
   - 确保变量名称使用正确的语法：`{variableName}`（不要使用`{{variableName}}`）
   - 确保变量名与代码中的数据键名完全匹配（区分大小写）
   - 变量名中不要包含空格或特殊字符
   - 注意常见拼写错误，如`{taotalTax}`应为`{totalTax}`

2. **变量大小写敏感**：
   - 变量名严格区分大小写，例如`{TotalAmount}`不会被`totalAmount`的值替换
   - 确保每个字母的大小写与代码中完全一致

3. **表格循环失败**:
   - 确保表格是用Word的表格功能创建的
   - 检查循环标记`{#items}`和`{/items}`是否正确放置
   - 只在表格的一行中放置循环内容

4. **中文显示问题**:
   - 保存模板时使用兼容中文的编码
   - 如果变量包含中文，确保代码中的编码处理正确

## 模板创建步骤

1. 打开Word创建新文档
2. 输入所有静态文本内容
3. 在需要动态内容的地方插入`{variableName}`形式的变量
4. 使用Word的表格功能创建带边框的表格
5. 在表格的第二行（数据行）中添加循环标记和变量
6. 保存为`.docx`格式（不要使用`.doc`或其他格式）

## 常见拼写错误检查

请特别注意检查以下常见的变量拼写错误：
- `{taotalTax}` → 正确写法是 `{totalTax}`
- `{totlaAmount}` → 正确写法是 `{totalAmount}`
- `{withTaxAmount}` → 正确写法是 `{totalWithTax}` 