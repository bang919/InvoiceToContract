/**
 * 静态导出API存根
 * 
 * 在静态导出模式下，所有API路由需要通过外部服务来实现。
 * 这个文件提供了一个存根实现，以便静态构建能够完成。
 * 
 * 在实际部署中，应当使用Cloudflare Workers或其他服务来处理API请求。
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// 提供一个用于静态导出的API客户端
export const staticClient = {
  getTemplate: async () => {
    if (typeof window === 'undefined') return null;
    return fetch(`${API_BASE_URL}/api/get-template`);
  },
  
  analyzeTemplate: async () => {
    if (typeof window === 'undefined') return { content: '', variables: [] };
    return fetch(`${API_BASE_URL}/api/analyze-template`).then(res => res.json());
  },
  
  generateContract: async (data) => {
    if (typeof window === 'undefined') return null;
    return fetch(`${API_BASE_URL}/api/generate-contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  
  serveFile: async (path) => {
    if (typeof window === 'undefined') return null;
    return fetch(`${API_BASE_URL}/api/serve-file/${path}`);
  }
}; 