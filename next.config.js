/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // experimental: {
  //   appDir: true,
  // },
  // 允许处理二进制文件，如 PDF 和 DOC
  webpack: (config, { isServer }) => {
    // 只有在客户端构建时才包含这些模块
    if (!isServer) {
      config.module.rules.push({
        test: /\.(pdf|doc|docx)$/,
        use: {
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            publicPath: '/_next/static/files/',
            outputPath: 'static/files/',
          },
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
