import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { lookup } from 'mime-types';
import storageAdapter from '@/utils/storageAdapter';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // 获取请求的文件路径
    const filePath = params.path.join('/');
    console.log('请求文件路径:', filePath);
    
    // 构建文件的绝对路径
    const outputDir = path.join(process.cwd(), 'output');
    const fullPath = path.join(outputDir, filePath);
    console.log('完整文件路径:', fullPath);
    
    // 检查文件是否存在
    try {
      const fileExists = await storageAdapter.exists(fullPath);
      if (!fileExists) {
        throw new Error('File not found');
      }
      console.log('文件存在, 准备读取');
    } catch (error) {
      console.error('文件不存在:', fullPath, error);
      return new NextResponse('File not found', { status: 404 });
    }
    
    // 读取文件
    try {
      const fileBuffer = await storageAdapter.readFile(fullPath);
      console.log('文件读取成功, 大小:', fileBuffer.length, '字节');
      
      // 根据文件扩展名设置合适的Content-Type
      let contentType = lookup(fullPath) || 'application/octet-stream';
      
      // 对于docx文件，设置合适的Content-Type和Content-Disposition
      if (fullPath.endsWith('.docx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }
      
      console.log('返回文件, Content-Type:', contentType);
      
      // 创建响应
      const response = new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          // 修复中文文件名编码问题 - 使用RFC 5987兼容的格式
          'Content-Disposition': `attachment; filename="${encodeURIComponent(path.basename(fullPath))}"; filename*=UTF-8''${encodeURIComponent(path.basename(fullPath))}`,
          'Content-Length': String(fileBuffer.length)
        },
      });
      
      return response;
    } catch (readError) {
      console.error('读取文件失败:', readError);
      return new NextResponse('Error reading file', { status: 500 });
    }
  } catch (error) {
    console.error('Error serving file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 