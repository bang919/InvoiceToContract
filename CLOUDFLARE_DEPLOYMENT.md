# Cloudflare Pages 部署指南

本文档提供关于将此 Next.js 应用程序部署到 Cloudflare Pages 的详细说明。

## 准备工作

本项目已针对 Cloudflare Pages 进行了特别优化，包括：

1. 使用 `standalone` 输出模式（适用于 Cloudflare Pages）
2. 更新了文件处理方式，从 `file-loader` 改为 `asset/resource`
3. 创建了存储适配器来处理文件操作（兼容 Cloudflare 环境）
4. 提供了自定义构建脚本 (`cloudflare-build.sh`) 来优化构建大小

## 部署步骤

1. **登录 Cloudflare Dashboard**：
   - 访问 https://dash.cloudflare.com/
   - 登录您的帐户

2. **创建新项目**：
   - 转到 Pages 部分
   - 点击"创建项目"
   - 连接您的 GitHub 仓库

3. **配置构建设置**：
   - 构建命令：`./cloudflare-build.sh`
   - 输出目录：`.next`
   - 构建系统版本：选择 2 (推荐)
   - Node.js 版本：16 或更高版本

4. **添加环境变量**：
   - `CF_PAGES`: `1` (这将告诉应用它在 Cloudflare 环境中运行)

5. **高级设置 (可选)**：
   - 如果您的应用使用 KV 或 R2 存储，请在此处配置访问权限

6. **部署项目**：
   - 点击"保存并部署"

## 存储适配

此应用程序使用存储适配器，可以在本地开发环境使用文件系统，在 Cloudflare 环境中使用 KV/R2。

### 配置 Cloudflare KV 命名空间

如果您需要使用 KV 来存储文件，请按照以下步骤操作：

1. 在 Cloudflare Dashboard 创建一个 KV 命名空间
2. 更新 `src/utils/storageAdapter.ts` 中的 `CloudflareAdapter` 类，使用您的 KV 命名空间

示例配置：

```typescript
async getKVNamespace() {
  // 替换为您的实际 KV 绑定
  return YOUR_KV_NAMESPACE;
}
```

### 或配置 Cloudflare R2 存储桶

对于较大的文件，建议使用 R2 存储：

1. 在 Cloudflare Dashboard 创建一个 R2 存储桶
2. 更新适配器以使用 R2 进行文件存储

## 注意事项和限制

1. **文件系统限制**：
   - Cloudflare Pages 不支持持久文件系统
   - 所有临时文件会在请求结束后消失
   - 使用 KV/R2 替代持久存储需求

2. **部署大小限制**：
   - Cloudflare Pages 有 25MB 的部署大小限制
   - 我们的构建脚本会删除 `.next/cache` 目录以减小大小
   - 如果仍然超过限制，考虑移除不必要的依赖或优化构建

3. **环境变量**：
   - 对于敏感信息，使用 Cloudflare Pages 的环境变量功能
   - 确保变量名在代码和 Cloudflare 配置中匹配

## 故障排除

如果遇到部署问题，请检查：

1. **构建失败**：
   - 查看构建日志中的错误
   - 确保所有依赖都正确安装
   - 验证 `cloudflare-build.sh` 有执行权限

2. **运行时错误**：
   - 检查 Cloudflare 函数日志
   - 确保适配器正确配置
   - 验证所有 API 路由是否使用了存储适配器而非直接的文件系统操作

3. **大小限制问题**：
   - 运行 `du -sh .next` 检查构建大小
   - 如果超过 25MB，考虑进一步优化依赖或生成的文件

## 最佳实践

1. **静态资源**：
   - 将静态文件放在 `public` 目录
   - 考虑使用 Cloudflare R2 存储大型资源

2. **API 路由**：
   - 使用 Edge Runtime 以获得最佳性能
   - 避免依赖 Node.js 特定的 API

3. **路由配置**：
   - 确保所有路由在 `next.config.js` 中正确配置
   - 使用 Cloudflare Pages 的自定义域和路由规则功能

## 更多资源

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/)
- [Cloudflare KV 文档](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Cloudflare R2 文档](https://developers.cloudflare.com/r2/) 