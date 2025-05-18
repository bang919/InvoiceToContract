import React from 'react';

export default function ApiStaticPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API功能不可用</h1>
      <p>
        在静态部署模式下，所有API功能都不可用。
        您需要使用Cloudflare Workers或其他服务来实现API功能。
      </p>
      <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 rounded">
        <h2 className="font-semibold mb-2">请注意</h2>
        <p>
          此页面仅在静态构建过程中用于替代API路由。
          在实际部署中，您应当将API功能迁移到:
        </p>
        <ul className="list-disc ml-6 mt-2">
          <li>Cloudflare Workers</li>
          <li>Cloudflare Functions</li>
          <li>独立的API服务</li>
        </ul>
      </div>
    </div>
  );
} 