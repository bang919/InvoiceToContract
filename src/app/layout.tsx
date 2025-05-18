import '@/styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '发票合同生成系统',
  description: '财务部门的发票合同生成工具',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <main className="min-h-screen bg-gray-50">
          <header className="bg-primary text-white p-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center">
              <h1 className="text-2xl font-bold">发票合同生成系统</h1>
              <nav>
                <ul className="flex space-x-4">
                  <li><a href="/" className="hover:underline">首页</a></li>
                  <li><a href="/template-editor" className="hover:underline">模板编辑指南</a></li>
                </ul>
              </nav>
            </div>
          </header>
          <div className="container mx-auto py-8 px-4">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
