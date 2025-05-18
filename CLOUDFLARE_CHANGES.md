# Cloudflare Pages 部署优化更改

本次更改为 Cloudflare Pages 部署优化了该项目。以下是主要变更：

## 构建配置优化

1. 更新了 `next.config.js`：
   - 添加了 `isCloudflare` 环境检测
   - 在 Cloudflare 环境中使用 `standalone` 输出模式
   - 将 `file-loader` 替换为 `asset/resource` 以改进资源处理

2. 创建了自定义构建脚本 `cloudflare-build.sh`：
   - 执行标准的 Next.js 构建
   - 删除 `.next/cache` 目录以减小部署大小（解决 25MB 限制问题）
   - 添加了构建大小报告

## 文件系统适配

1. 创建了 `src/utils/storageAdapter.ts`：
   - 提供统一的存储接口
   - 在不同环境中提供不同的实现：本地开发使用文件系统，Cloudflare 环境使用 KV/R2
   - 实现了 `readFile`、`writeFile` 和 `exists` 方法

2. 更新了 API 路由：
   - `src/app/api/serve-file/[...path]/route.ts`：使用存储适配器替代直接的文件系统操作

## 客户端路由支持

1. 添加了 `public/_redirects` 文件：
   - 配置了 SPA 重定向规则，支持客户端路由

## 文档

1. 创建了详细的部署指南 `CLOUDFLARE_DEPLOYMENT.md`：
   - 包括部署步骤、注意事项和最佳实践
   - 提供了 KV/R2 配置说明
   - 包含故障排除提示

## 下一步建议

1. **KV/R2 集成**：
   - 完善 CloudflareAdapter 实现，连接到实际的 KV 命名空间或 R2 存储桶
   - 迁移重要文件到 R2 存储以获得更好的可扩展性

2. **边缘函数优化**：
   - 考虑将 API 路由转换为边缘函数以提高性能

3. **静态生成优化**：
   - 尽可能将更多页面转换为静态生成，减少服务器端渲染需求 