import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // 构建模板文件的绝对路径
    const templatePath = path.join(process.cwd(), 'public', '合同模版.docx');
    
    // 检查文件是否存在
    if (!fs.existsSync(templatePath)) {
      return new NextResponse('模板文件未找到', { status: 404 });
    }
    
    // 读取文件内容
    const templateBuffer = fs.readFileSync(templatePath);
    
    // 返回文件内容，设置适当的MIME类型
    return new NextResponse(templateBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="合同模版.docx"'
      }
    });
  } catch (error) {
    console.error('获取模板文件失败:', error);
    return new NextResponse('获取模板文件失败', { status: 500 });
  }
} 