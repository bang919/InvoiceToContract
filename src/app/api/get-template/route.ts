import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // 获取模板文件路径
    const templatePath = path.join(process.cwd(), 'public', 'contract-template.docx');
    
    // 检查文件是否存在
    if (!fs.existsSync(templatePath)) {
      console.error('模板文件不存在:', templatePath);
      return new Response('Template file not found', { status: 404 });
    }
    
    // 读取文件
    const fileBuffer = fs.readFileSync(templatePath);
    console.log('模板文件大小:', fileBuffer.length, '字节');
    
    // 返回文件
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="contract-template.docx"'
      }
    });
  } catch (error) {
    console.error('获取模板文件失败:', error);
    return new NextResponse('获取模板文件失败', { status: 500 });
  }
} 