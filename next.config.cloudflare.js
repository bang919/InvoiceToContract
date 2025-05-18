/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 为Cloudflare Pages使用静态导出
  output: 'export',
  
  // 为静态导出禁用图像优化
  images: {
    unoptimized: true,
  },
  
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
  // 静态导出模式下不支持rewrites
  // 需要在前端处理路由
};

module.exports = nextConfig; 