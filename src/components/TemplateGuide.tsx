"use client";

export default function TemplateGuide() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-gray-800">合同模板指南</h2>
      
      <div className="prose prose-sm max-w-none">
        <p>
          在Word合同模板中使用以下占位符和语法来实现动态内容替换：
        </p>
        
        <h3 className="mt-4 font-semibold">基本变量</h3>
        <p>使用 <code>{"{{变量名}}"}</code> 格式插入单个变量：</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><code>{"{{buyerName}}"}</code> - 购买方名称</li>
          <li><code>{"{{sellerName}}"}</code> - 销售方名称</li>
          <li><code>{"{{projectName}}"}</code> - 项目名称</li>
          <li><code>{"{{totalAmount}}"}</code> - 合同总金额（数字）</li>
          <li><code>{"{{amountInWords}}"}</code> - 合同总金额（大写）</li>
          <li><code>{"{{contractDate}}"}</code> - 合同日期</li>
        </ul>
        
        <h3 className="mt-4 font-semibold">表格与循环</h3>
        <p>使用 <code>{"{{#each tableData}}...{{/each}}"}</code> 循环渲染表格行：</p>
        <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
{`| 序号 | 名称 | 规格 | 单位 | 数量 | 单价 | 金额 |
{{#each tableData}}
| {{index}} | {{name}} | {{spec}} | {{unit}} | {{quantity}} | {{price}} | {{amount}} |
{{/each}}`}
        </pre>
        
        <h3 className="mt-4 font-semibold">条件渲染</h3>
        <p>使用 <code>{"{{#if 变量名}}...{{/if}}"}</code> 实现条件内容：</p>
        <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
{`{{#if hasDiscount}}
折扣优惠：{{discountAmount}}元
{{/if}}`}
        </pre>
        
        <h3 className="mt-4 font-semibold">可用数据字段</h3>
        <table className="min-w-full border border-gray-300 text-xs mt-2">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-1 text-left">字段类型</th>
              <th className="border p-1 text-left">变量名</th>
              <th className="border p-1 text-left">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-1" rowSpan={4}>基本信息</td>
              <td className="border p-1"><code>buyerName</code>, <code>buyerTaxId</code></td>
              <td className="border p-1">购买方名称和税号</td>
            </tr>
            <tr>
              <td className="border p-1"><code>sellerName</code>, <code>sellerTaxId</code></td>
              <td className="border p-1">销售方名称和税号</td>
            </tr>
            <tr>
              <td className="border p-1"><code>projectName</code>, <code>projectAddress</code></td>
              <td className="border p-1">项目名称和地址</td>
            </tr>
            <tr>
              <td className="border p-1"><code>invoiceNo</code>, <code>date</code></td>
              <td className="border p-1">发票号码和开票日期</td>
            </tr>
            <tr>
              <td className="border p-1" rowSpan={2}>金额</td>
              <td className="border p-1"><code>totalAmount</code></td>
              <td className="border p-1">合同总金额（数字）</td>
            </tr>
            <tr>
              <td className="border p-1"><code>amountInWords</code></td>
              <td className="border p-1">合同总金额（大写）</td>
            </tr>
            <tr>
              <td className="border p-1" rowSpan={4}>银行信息</td>
              <td className="border p-1"><code>buyerBank</code>, <code>buyerBankAccount</code></td>
              <td className="border p-1">购买方银行和账号</td>
            </tr>
            <tr>
              <td className="border p-1"><code>sellerBank</code>, <code>sellerBankAccount</code></td>
              <td className="border p-1">销售方银行和账号</td>
            </tr>
            <tr>
              <td className="border p-1" rowSpan={2}>表格数据</td>
              <td className="border p-1"><code>tableData</code> (循环)</td>
              <td className="border p-1">商品表格数据数组</td>
            </tr>
            <tr>
              <td className="border p-1"><code>index</code>, <code>name</code>, <code>spec</code>, <code>unit</code>, <code>quantity</code>, <code>price</code>, <code>amount</code></td>
              <td className="border p-1">循环内可用的表格行字段</td>
            </tr>
            <tr>
              <td className="border p-1" rowSpan={3}>日期</td>
              <td className="border p-1"><code>contractDate</code></td>
              <td className="border p-1">合同日期（完整）</td>
            </tr>
            <tr>
              <td className="border p-1"><code>year</code>, <code>month</code>, <code>day</code></td>
              <td className="border p-1">年、月、日（分开使用）</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-700">提示</h3>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-blue-800">
          <li>确保模板中的变量名与数据字段名完全匹配，包括大小写</li>
          <li>在Word中编辑模板时，变量标记应该保持为纯文本格式，不要使用特殊格式</li>
          <li>如果表格循环未正常工作，尝试简化表格结构或使用简单文本循环</li>
          <li>模板可以不包含所有字段，只替换存在的变量标记</li>
        </ol>
      </div>
    </div>
  );
} 