'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';

export default function TemplateEditorPage() {
  const [guideContent, setGuideContent] = React.useState<string>('加载中...');
  const [exampleContent, setExampleContent] = React.useState<string>('加载中...');
  const [docxtemplaterGuide, setDocxtemplaterGuide] = React.useState<string>('加载中...');
  const [downloadReady, setDownloadReady] = useState<boolean>(false);
  
  React.useEffect(() => {
    // 加载模板指南
    fetch('/templates/template-guide.md')
      .then(response => response.text())
      .then(text => setGuideContent(text))
      .catch(error => setGuideContent(`加载失败: ${error.message}`));
    
    // 加载示例模板
    fetch('/templates/example-template.txt')
      .then(response => response.text())
      .then(text => {
        setExampleContent(text);
        setDownloadReady(true);
      })
      .catch(error => setExampleContent(`加载失败: ${error.message}`));
    
    // 加载Docxtemplater指南
    fetch('/templates/docxtemplater-guide.md')
      .then(response => response.text())
      .then(text => setDocxtemplaterGuide(text))
      .catch(error => setDocxtemplaterGuide(`加载失败: ${error.message}`));
  }, []);
  
  const downloadExampleTemplate = () => {
    const element = document.createElement('a');
    const file = new Blob([exampleContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = 'example-template.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  
  // 创建Word文档的说明
  const wordDocInstructions = `
  创建模板Word文档的步骤：
  1. 下载示例模板文本
  2. 打开Microsoft Word创建新文档
  3. 复制示例模板的内容到Word文档
  4. 使用Word的表格功能创建表格（不要使用文本中的 | 符号）
  5. 确保表格只有两行：表头行和包含变量的数据行
  6. 格式化文档（设置字体、间距、表格边框等）
  7. 保存为Word文档（.docx格式）
  `;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">模板编辑指南</h1>
      
      <div className="bg-blue-50 p-4 rounded mb-8">
        <p className="font-semibold text-blue-800">重要更新: 我们已经更换了模板引擎！</p>
        <p>现在使用 <strong>Docxtemplater</strong> 作为模板引擎，支持更复杂的表格和格式。请按照新的语法格式修改您的模板。</p>
      </div>
      
      <div className="bg-green-50 p-4 rounded mb-8">
        <p className="font-semibold text-green-800">新增功能: 税额和含税金额计算</p>
        <p>现在系统支持自动计算税额和含税金额，您可以在模板中使用以下变量：</p>
        <ul className="list-disc ml-6 mt-2">
          <li><code>{"{totalAmount}"}</code> - 不含税金额，<code>{"{amountInWords}"}</code> - 不含税金额大写</li>
          <li><code>{"{totalTax}"}</code> - 税额合计，<code>{"{taxInWords}"}</code> - 税额大写</li>
          <li><code>{"{totalWithTax}"}</code> - 含税总金额，<code>{"{totalWithTaxInWords}"}</code> - 含税总金额大写</li>
        </ul>
        <p className="mt-2">表格中还可以使用 <code>{"{taxRate}"}</code> 和 <code>{"{tax}"}</code> 显示每行商品的税率和税额。</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">模板变量指南 (旧版)</h2>
          <div className="bg-gray-100 p-4 rounded whitespace-pre-wrap mb-4">
            {guideContent}
          </div>
        </div>
        
        <div>
          <h2 className="text-2xl font-semibold mb-4">Docxtemplater指南 (新版)</h2>
          <div className="bg-gray-100 p-4 rounded whitespace-pre-wrap mb-4">
            {docxtemplaterGuide}
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">示例模板</h2>
        <div className="bg-gray-100 p-4 rounded whitespace-pre-wrap mb-4">
          {exampleContent}
        </div>
        
        <button 
          onClick={downloadExampleTemplate}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 mb-4"
        >
          下载示例模板
        </button>
        
        <div className="bg-yellow-50 p-4 rounded">
          <h3 className="font-semibold text-yellow-800 mb-2">创建Word文档说明</h3>
          <div className="whitespace-pre-wrap">
            {wordDocInstructions}
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">常见问题排查</h2>
        
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">变量没有被替换</h3>
          <p className="mb-4">可能的原因：</p>
          <ol className="list-decimal list-inside ml-4 mb-4">
            <li>变量标记格式不正确 - 现在应使用单括号格式 <code>{"{variableName}"}</code>，而不是双括号</li>
            <li>变量名称与代码中的不匹配 - 确保名称完全一致，包括大小写</li>
            <li>Word文档格式问题 - 确保文档保存为.docx格式</li>
          </ol>
        </div>
        
        <div className="bg-gray-100 p-4 rounded mt-4">
          <h3 className="font-semibold mb-2">表格循环不起作用</h3>
          <p className="mb-4">可能的原因：</p>
          <ol className="list-decimal list-inside ml-4 mb-4">
            <li>循环语法错误 - 确保使用 <code>{"{#items}...{/items}"}</code> 格式</li>
            <li>表格创建方式不正确 - 确保使用Word的表格功能而不是文本表格</li>
            <li>循环标记位置错误 - 循环标记应该只在表格的一行中</li>
          </ol>
        </div>
      </div>
    </div>
  );
} 