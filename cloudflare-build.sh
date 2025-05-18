#!/bin/bash

# 显示运行的命令
set -ex

# 运行标准的 Next.js 构建
npm run build

# 构建完成后，删除不必要的缓存文件以减小部署大小
if [ -d ".next/cache" ]; then
  echo "移除 .next/cache 目录以减小部署大小..."
  rm -rf .next/cache
fi

# 打印构建后的目录大小
echo "最终构建大小:"
du -sh .next

echo "Cloudflare Pages 构建完成!" 