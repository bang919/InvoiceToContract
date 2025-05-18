import { NextRequest, NextResponse } from 'next/server';
import { generateContractFromInvoices } from '@/services/ContractService';
import path from 'path';
import fs from 'fs';

// 确保output目录存在
const ensureOutputDir = () => {
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
};

// 清理合同文件，只保留最新的20个
const cleanupContractFiles = (outputDir: string, maxFiles: number = 20) => {
  try {
    // 只处理docx文件
    const files = fs.readdirSync(outputDir)
      .filter(file => file.endsWith('.docx'))
      .map(file => {
        const fullPath = path.join(outputDir, file);
        const stats = fs.statSync(fullPath);
        return {
          name: file,
          path: fullPath,
          mtime: stats.mtime.getTime()
        };
      })
      // 按修改时间降序排序（最新的在前面）
      .sort((a, b) => b.mtime - a.mtime);
    
    // 如果文件数量超过限制，删除最旧的文件
    if (files.length > maxFiles) {
      console.log(`合同文件数量(${files.length})超过限制(${maxFiles})，清理旧文件...`);
      
      const filesToDelete = files.slice(maxFiles);
      for (const file of filesToDelete) {
        try {
          fs.unlinkSync(file.path);
          console.log(`已删除旧合同文件: ${file.name}`);
        } catch (err: any) {
          console.error(`删除文件失败: ${file.path}`, err);
        }
      }
    }
  } catch (err: any) {
    console.error('清理合同文件时出错:', err);
  }
};

// 定义合同生成API路由处理函数
export async function POST(request: NextRequest) {
  console.log('收到合同生成请求');
  
  try {
    // 解析请求中的发票列表
    const { invoices } = await request.json();
    
    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      console.error('未提供有效的发票数据');
      return NextResponse.json({ 
        success: false, 
        error: '未提供有效的发票数据' 
      }, { status: 400 });
    }
    
    console.log(`准备为 ${invoices.length} 份发票生成合同`);
    
    // 获取合同模板路径
    const templatePath = path.join(process.cwd(), 'public', 'contract-template.docx');
    if (!fs.existsSync(templatePath)) {
      console.error('合同模板文件不存在:', templatePath);
      return NextResponse.json({ 
        success: false, 
        error: '合同模板文件不存在' 
      }, { status: 500 });
    }
    
    // 读取模板文件
    const templateBuffer = fs.readFileSync(templatePath);
    console.log('已加载合同模板文件');
    
    // 设置输出目录
    const outputDir = path.join(process.cwd(), 'public', 'contracts');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('创建输出目录:', outputDir);
    }
    
    // 生成合同文件
    const generatedFiles = await generateContractFromInvoices(
      invoices,
      templateBuffer,
      outputDir
    );
    
    console.log('合同生成完成，生成了以下文件:', generatedFiles);
    
    // 清理旧的合同文件，只保留最新的20个
    cleanupContractFiles(outputDir, 20);
    
    // 将完整路径转换为可访问的URL
    const generatedUrls = generatedFiles.map(file => {
      // 将绝对路径转为相对URL
      const relativePath = file.replace(path.join(process.cwd(), 'public'), '');
      // 确保URL路径格式正确
      const urlPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
      console.log('生成的文件URL路径:', urlPath);
      return urlPath;
    });
    
    // 返回生成的合同文件列表
    return NextResponse.json({ 
      success: true, 
      files: generatedUrls 
    });
    
  } catch (error: any) {
    console.error('生成合同文件时出错:', error);
    return NextResponse.json({ 
      success: false, 
      error: `生成合同文件时出错: ${error.message || '未知错误'}` 
    }, { status: 500 });
  }
}

// GET方法用于获取已生成的合同列表
export async function GET() {
  try {
    // 确保输出目录存在
    const outputDir = ensureOutputDir();
    
    // 读取输出目录中的文件
    const files = fs.readdirSync(outputDir)
      .filter(file => file.endsWith('.docx'))
      .map(file => {
        const fullPath = path.join(outputDir, file);
        const stats = fs.statSync(fullPath);
        return {
          name: file,
          path: `/output/${file}`,
          size: stats.size,
          createdAt: stats.birthtime
        };
      });
    
    return NextResponse.json({
      success: true,
      files
    });
  } catch (error: any) {
    console.error('获取合同列表失败:', error);
    return NextResponse.json(
      { error: `获取合同列表失败: ${error.message || error}` },
      { status: 500 }
    );
  }
} 