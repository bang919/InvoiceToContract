# 静态部署模式说明

本应用已配置为可以使用静态部署模式在Cloudflare Pages上运行。请注意，在静态部署模式下，所有服务端功能（包括API路由）都不可用。

## 部署到Cloudflare Pages的配置

1. **构建命令**:
   ```
   ./cloudflare-build.sh
   ```

2. **输出目录**:
   ```
   out
   ```

3. **环境变量**:
   - `CF_PAGES`: `1` (标记为Cloudflare环境)
   - `NEXT_PUBLIC_API_URL`: 您的API服务URL (可选)

## 静态部署的局限性

在静态部署模式下:

1. 所有API路由都不可用，包括:
   - `/api/generate-contract`
   - `/api/get-template`
   - `/api/serve-file/[...path]`
   - `/api/analyze-template`

2. 服务器端渲染功能不可用

3. 服务器端数据获取不可用

## 如何解决这些局限性

为了使应用程序在静态部署模式下完全功能，您需要:

### 1. 设置独立的API服务

您可以使用以下任一选项:

- **Cloudflare Workers**: 实现与原API相同功能的Workers
- **Cloudflare D1数据库**: 存储应用数据
- **Cloudflare R2存储**: 存储文件和模板
- **外部API服务**: 设置一个单独的API服务并配置CORS

### 2. 配置环境变量

在您的Cloudflare Pages项目中，设置以下环境变量:

```
NEXT_PUBLIC_API_URL=https://your-api-service.com
```

### 3. 使用静态导出客户端

在您的组件中，使用`src/app/api/staticExport.js`中的客户端:

```javascript
import { staticClient } from '@/app/api/staticExport';

// 使用静态客户端
const response = await staticClient.generateContract(data);
```

## 本地开发

在本地开发时，您可以使用两种模式:

1. **标准开发模式** (带API功能):
   ```
   npm run dev
   ```

2. **静态预览模式** (模拟Cloudflare部署):
   ```
   ./cloudflare-build.sh && npx serve out
   ```

## 迁移指南

如需将API功能迁移到Cloudflare Workers:

1. 查看`src/app/api`目录中的源代码
2. 将相应逻辑转换为Workers
3. 更新`src/app/api/staticExport.js`中的URL以指向您的Workers

## 进一步支持

如果您需要进一步的帮助，请参考:

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Next.js 静态导出文档](https://nextjs.org/docs/advanced-features/static-html-export) 