#!/bin/bash

# 显示运行的命令
set -ex

# 为Cloudflare构建使用特殊配置
echo "使用Cloudflare特定的Next.js配置..."
cp next.config.cloudflare.js next.config.js

# 临时备份API目录，因为API路由不能用于静态导出
echo "临时移除API目录以支持静态导出..."
if [ -d "src/app/api" ]; then
  mkdir -p src/app/api_backup
  mv src/app/api/* src/app/api_backup/
  # 确保API目录存在但为空
  mkdir -p src/app/api
fi

# 运行静态导出构建
echo "执行静态导出构建..."
npm run build

# 恢复API目录
echo "恢复API目录..."
if [ -d "src/app/api_backup" ]; then
  rm -rf src/app/api
  mkdir -p src/app/api
  mv src/app/api_backup/* src/app/api/
  rm -rf src/app/api_backup
fi

# 构建完成后，删除不必要的缓存文件以减小部署大小
if [ -d ".next/cache" ]; then
  echo "移除 .next/cache 目录以减小部署大小..."
  rm -rf .next/cache
fi

# 打印构建后的目录大小
echo "最终构建大小:"
du -sh .next
du -sh out

# 确保生成了有效的out目录
if [ ! -d "out" ]; then
  echo "错误: 没有生成out目录，构建可能失败"
  exit 1
fi

echo "准备自定义配置文件..."
# 为SPA路由创建_redirects文件
cat > out/_redirects << EOF
/*    /index.html   200
EOF

# 创建_routes.json文件，用于Cloudflare Pages
cat > out/_routes.json << EOF
{
  "version": 1,
  "include": ["/*"],
  "exclude": []
}
EOF

echo "Cloudflare Pages 构建完成!" 