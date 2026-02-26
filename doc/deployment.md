# Cloudflare Pages 部署指南

## 架构模式

SnapTrack 使用 **Cloudflare Pages** 的 **Directory Mode** (`mode: 'directory'`) 部署。

### 模式对比

| 模式 | 配置 | 适用场景 |
|------|------|---------|
| **Directory** ✅ | `mode: 'directory'` | 多路由应用，每个页面独立 Function |
| Advanced | `mode: 'advanced'` | 单 Worker 处理所有路由 |

我们使用 **Directory** 模式，因为：
- 更好的冷启动性能
- 独立部署每个 API
- 自动路由映射

## 构建输出

```
dist/
├── _astro/                    # 静态资源 (CSS/JS)
├── _routes.json               # Pages 路由规则
├── _worker.js/                # Pages Functions
│   ├── index.js               # 入口
│   ├── manifest_*.mjs         # 路由映射
│   └── pages/
│       ├── index.astro.mjs    # / 路由
│       └── api/
│           ├── check.ts.mjs   # /api/check
│           ├── upload-ocr.ts.mjs
│           └── health.ts.mjs
├── favicon.ico
└── favicon.svg
```

## 部署流程

### 1. 初始化项目

```bash
# 创建 Pages 项目（如果不存在）
npx wrangler pages project create snaptrack --production-branch=main
```

### 2. 构建

```bash
npm run build
```

### 3. 部署

```bash
# 部署到 Pages
npx wrangler pages deploy dist --project-name=snaptrack

# 或使用部署脚本
./deploy.sh
```

部署成功后会输出：
```
✨ Successfully deployed website!
🌐 https://snaptrack.pages.dev
```

## 路由配置

### _routes.json

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/favicon.ico",
    "/favicon.svg",
    "/_astro/*"
  ]
}
```

- `include`: 所有路径都走 Function
- `exclude`: 静态资源直接由 CDN 提供

## 绑定配置

### D1 数据库

```toml
[[d1_databases]]
binding = "DB"
database_name = "snaptrack-db"
database_id = "your-database-id"
```

在代码中使用：
```typescript
const runtime = locals.runtime;
const db = createClient(runtime.env.DB);
```

### Workers AI

```toml
[ai]
binding = "AI"
```

在代码中使用：
```typescript
const response = await env.AI.run(
  '@cf/meta/llama-3.2-11b-vision-instruct',
  { messages: [...] }
);
```

## 环境变量

Pages 支持两种环境变量：

### 1. 生产环境变量

在 Cloudflare Dashboard → Pages → Settings → Environment variables 中设置。

或通过 Wrangler：
```bash
npx wrangler pages secret put OCR_SPACE_API_KEY
```

### 2. 开发环境变量

创建 `.dev.vars` 文件：
```
OCR_SPACE_API_KEY=your_key_here
```

## GitHub Actions 自动部署

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      - run: npm run build
      
      - name: Deploy to Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=snaptrack
```

## 预览部署

每次 Pull Request 会自动生成预览环境：

```bash
# 查看预览部署
npx wrangler pages deployment list --project-name=snaptrack
```

## 监控

### 1. Pages Analytics

Dashboard → Pages → snaptrack → Analytics

查看：
- 请求量
- 流量
- 错误率
- 性能指标

### 2. Real-time Logs

```bash
npx wrangler pages deployment tail --project-name=snaptrack
```

### 3. D1 监控

Dashboard → Databases → snaptrack-db

查看：
- 查询量
- 存储使用

## 回滚

```bash
# 查看部署历史
npx wrangler pages deployment list --project-name=snaptrack

# 回滚到指定版本
npx wrangler pages deployment create --project-name=snaptrack <DEPLOYMENT_ID>
```

或在 Dashboard 中点击 "Rollback"。

## 自定义域名

1. Dashboard → Pages → snaptrack → Custom domains
2. 点击 "Set up a custom domain"
3. 输入你的域名
4. 按提示配置 DNS

## 故障排查

### 构建失败

```bash
# 检查构建输出
npm run build
ls -la dist/_worker.js/
```

### 404 Not Found

1. 检查 `_routes.json` 配置
2. 确认 `_worker.js` 目录存在
3. 查看 Pages Functions 日志

### 数据库连接失败

```bash
# 检查绑定
npx wrangler pages deployment list-bindings --project-name=snaptrack

# 确认 database_id 正确
npx wrangler d1 list
```

### AI 调用失败

1. 确认 Workers AI 已启用
2. 检查 `wrangler.toml` 中 `[ai]` 配置
3. 查看使用量是否超限

## 最佳实践

1. **使用 `functionPerRoute: true`** - 更好的冷启动性能
2. **配置 `_routes.json`** - 静态资源走 CDN，API 走 Function
3. **数据库迁移** - 在部署前执行 `wrangler d1 migrations apply`
4. **日志记录** - 使用 `console.log` 记录关键信息
5. **错误处理** - 统一 API 错误响应格式
