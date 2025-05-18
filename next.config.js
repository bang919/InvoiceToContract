/** @type {import('next').NextConfig} */
// 检测是否在 Cloudflare 环境中运行
const isCloudflare = process.env.CF_PAGES === '1';

const nextConfig = {
  reactStrictMode: true,
  // 根据环境配置输出方式
  // 在 Cloudflare 环境中使用 standalone 模式
  output: isCloudflare ? 'standalone' : undefined,
  
  // 允许处理二进制文件，如 PDF 和 DOC
  webpack: (config, { isServer }) => {
    // 修改文件加载配置，使用 asset/resource 替代 file-loader
    if (!isServer) {
      config.module.rules.push({
        test: /\.(pdf|doc|docx)$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/files/[name][ext]',
        },
      });
    }

    // 解决 PDF.js 和 canvas 的问题
    if (isServer) {
      // 在服务器端不加载这些模块
      config.resolve.alias.canvas = false;
      config.resolve.alias.encoding = false;
    }

    config.experiments = { ...config.experiments, topLevelAwait: true };
    
    // Fix for "Module not found: Can't resolve 'fs'" error
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    return config;
  },
  // 添加静态目录配置
  async rewrites() {
    return [
      {
        source: '/output/:path*',
        destination: '/api/serve-file/:path*',
      },
      {
        source: '/contracts/:path*',
        destination: '/api/serve-file/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
