import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { analyzeTemplate } from '../../../services/ContractService';

export async function GET(request: NextRequest) {
  try {
    // 获取模板文件路径
    const templatePath = path.join(process.cwd(), 'public', 'contract-template.docx');
    
    // 分析模板
    const result = await analyzeTemplate(templatePath);
    
    return NextResponse.json({
      success: true,
      content: result.content,
      variables: result.variables
    });
  } catch (error: any) {
    console.error('分析模板失败:', error);
    return NextResponse.json(
      { error: `分析模板失败: ${error.message || error}` },
      { status: 500 }
    );
  }
} 