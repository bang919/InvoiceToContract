/**
 * storageAdapter.ts
 * 
 * 提供统一的存储接口，根据运行环境自动选择适当的实现方式：
 * - 在开发环境和标准 Node.js 环境中使用本地文件系统
 * - 在 Cloudflare Pages 环境中使用 KV 存储或其他兼容方式
 */

import { Buffer } from 'buffer';

// 检测是否在 Cloudflare 环境中运行
const isCloudflare = process.env.CF_PAGES === '1';

interface StorageAdapter {
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: Buffer | string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

/**
 * 本地文件系统适配器
 */
class FileSystemAdapter implements StorageAdapter {
  async readFile(path: string): Promise<Buffer> {
    const fs = await import('fs/promises');
    return fs.readFile(path);
  }

  async writeFile(path: string, data: Buffer | string): Promise<void> {
    const fs = await import('fs/promises');
    return fs.writeFile(path, data);
  }

  async exists(path: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Cloudflare KV/R2 适配器
 * 注意: 这是一个简化的实现，在实际使用中你需要:
 * 1. 设置正确的 KV 命名空间或 R2 存储桶
 * 2. 处理路径映射逻辑
 */
class CloudflareAdapter implements StorageAdapter {
  // 这个是模拟实现，实际使用时需要调整为真实的 KV 或 R2 存储
  private async getKVNamespace() {
    return {
      get: async (key: string) => {
        // 从实际的 KV 存储中获取
        throw new Error('CloudflareAdapter.readFile 尚未实现');
      },
      put: async (key: string, value: string | ArrayBuffer) => {
        // 写入到实际的 KV 存储
        throw new Error('CloudflareAdapter.writeFile 尚未实现');
      },
      list: async () => {
        // 列出 KV 存储中的所有键
        return { keys: [] };
      }
    };
  }

  async readFile(path: string): Promise<Buffer> {
    // 注意：这里需要根据实际情况实现
    // 例如，你可以使用 Cloudflare KV 或 R2 存储
    // 这是一个简单的模拟实现
    const ns = await this.getKVNamespace();
    const content = await ns.get(this.normalizePath(path));
    
    if (content === null) {
      throw new Error(`File not found: ${path}`);
    }
    
    if (typeof content === 'string') {
      return Buffer.from(content);
    }
    
    return Buffer.from(content as ArrayBuffer);
  }

  async writeFile(path: string, data: Buffer | string): Promise<void> {
    const ns = await this.getKVNamespace();
    const value = typeof data === 'string' ? data : data.toString('base64');
    await ns.put(this.normalizePath(path), value);
  }

  async exists(path: string): Promise<boolean> {
    try {
      const ns = await this.getKVNamespace();
      const result = await ns.get(this.normalizePath(path));
      return result !== null;
    } catch {
      return false;
    }
  }

  private normalizePath(path: string): string {
    // 将文件路径转换为适合 KV 存储的键
    // 例如，将路径中的分隔符替换为冒号
    return path.replace(/\//g, ':').replace(/^:/, '');
  }
}

// 创建适合当前环境的适配器实例
const storageAdapter: StorageAdapter = isCloudflare
  ? new CloudflareAdapter()
  : new FileSystemAdapter();

export default storageAdapter; 