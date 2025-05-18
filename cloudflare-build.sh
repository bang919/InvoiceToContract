#!/bin/bash

# 显示运行的命令
set -ex

# 为Cloudflare构建使用特殊配置
echo "使用Cloudflare特定的Next.js配置..."
cp next.config.cloudflare.js next.config.js

# 运行静态导出构建
echo "执行静态导出构建..."
npm run build

# 构建完成后，删除不必要的缓存文件以减小部署大小
if [ -d ".next/cache" ]; then
  echo "移除 .next/cache 目录以减小部署大小..."
  rm -rf .next/cache
fi

# 打印构建后的目录大小
echo "最终构建大小:"
du -sh .next
du -sh out

# 为Cloudflare Pages创建适当的输出目录
echo "准备输出目录..."
mkdir -p public
touch public/_routes.json

# 创建_routes.json文件，用于控制哪些路由由Cloudflare Pages处理
cat > public/_routes.json << EOF
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/api/*"]
}
EOF

echo "Cloudflare Pages 构建完成!" 