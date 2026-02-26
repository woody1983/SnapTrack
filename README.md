# SnapTrack 📦

极简快递单号查询与录入工具（MVP v1.0）

> 1秒查询 + 5秒拍照录入，零服务器成本，全在 Cloudflare 边缘运行

## 核心功能

| 功能 | 描述 | 响应时间 |
|------|------|----------|
| 🔍 **手动查询** | 输入 FedEx/UPS 单号，即时显示「已入库」或「未入库」 | < 50ms |
| 📸 **拍照录入** | 手机拍照自动提取单号+地址，自动入库 | < 6s |
| 🔄 **自动去重** | 重复单号智能提示已入库时间 | - |
| 📱 **移动优先** | 手机浏览器打开即用，无需登录 | < 800ms |

## 技术栈

- **框架**: [Astro](https://astro.build/) + `@astrojs/cloudflare`
- **平台**: **Cloudflare Pages** (Functions + Static Assets)
- **数据库**: Cloudflare D1 (Serverless SQLite)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **AI/OCR**: Cloudflare Workers AI (llama-3.2-11b-vision)

## 为什么选择 Cloudflare Pages？

| 特性 | Pages | Workers |
|------|-------|---------|
| 静态资源托管 | ✅ CDN 自动加速 | ❌ 需配合 R2 |
| API 函数 | ✅ Pages Functions | ✅ Workers |
| 自动构建部署 | ✅ Git 集成 | ❌ 手动/Wrangler |
| 预览环境 | ✅ 每个 PR 自动生成 | ❌ |
| 自定义域名 | ✅ 免费 | ✅ 付费 |

**Pages Functions = Workers + 自动路由 + 静态资源托管**

## 快速开始

### 1. 前置准备

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
npx wrangler login
```

### 2. 创建 D1 数据库

```bash
# 创建数据库
npx wrangler d1 create snaptrack-db

# 输出示例：
# ✅ Successfully created DB 'snaptrack-db'
# [[d1_databases]]
# binding = "DB"
# database_name = "snaptrack-db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 复制 database_id 到 wrangler.toml
```

### 3. 配置项目

```bash
# 克隆项目
git clone https://github.com/woody1983/SnapTrack.git
cd SnapTrack

# 安装依赖
npm install

# 编辑 wrangler.toml，替换 database_id
vim wrangler.toml
```

### 4. 数据库迁移

```bash
# 生成迁移
npm run db:generate

# 应用迁移到 D1
npx wrangler d1 migrations apply snaptrack-db
```

### 5. 部署到 Pages

**方式一: 一键部署脚本**
```bash
chmod +x deploy.sh
./deploy.sh
```

**方式二: Wrangler CLI**
```bash
npm run build
npx wrangler pages deploy dist --project-name=snaptrack
```

**方式三: GitHub Actions 自动部署**
1. 在 GitHub 仓库设置 Secrets:
   - `CLOUDFLARE_API_TOKEN` - [获取 API Token](https://dash.cloudflare.com/profile/api-tokens)
   - `CLOUDFLARE_ACCOUNT_ID` - 你的账户 ID
2. 推送代码到 `main` 分支自动触发部署

## 项目结构

```
├── src/
│   ├── pages/
│   │   ├── index.astro           # 主页面（查询+录入）
│   │   └── api/                  # API Functions
│   │       ├── check.ts          # 查询单号
│   │       ├── upload-ocr.ts     # 拍照识别
│   │       └── health.ts         # 健康检查
│   └── env.d.ts                  # 类型定义
├── db/
│   ├── schema.ts                 # 数据库表结构
│   ├── client.ts                 # 数据库客户端
│   └── migrations/               # 迁移文件
├── public/
│   └── _routes.json              # Pages 路由配置
├── .github/workflows/
│   └── deploy.yml                # GitHub Actions
├── astro.config.mjs              # Astro 配置 (mode: 'directory')
├── wrangler.toml                 # Cloudflare 配置
├── deploy.sh                     # 部署脚本
└── README.md
```

## Pages 架构

```
Cloudflare Pages
├── Static Assets (CDN 加速)
│   ├── index.html
│   ├── favicon.svg
│   └── _astro/* (JS/CSS)
│
├── Pages Functions (Workers)
│   ├── /              → index.astro.mjs
│   ├── /api/check     → check.ts
│   ├── /api/upload-ocr → upload-ocr.ts
│   └── /api/health    → health.ts
│
└── Bindings
    ├── D1 Database (DB)
    └── Workers AI (AI)
```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `GET /` | | 主页面 |
| `GET /api/health` | | 健康检查 |
| `POST /api/check` | | 查询单号状态 |
| `POST /api/upload-ocr` | | 上传图片识别并入库 |

### 请求示例

```bash
# 查询单号
curl -X POST https://snaptrack.pages.dev/api/check \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber": "1Z999AA10123456784"}'

# 响应
{
  "exists": true,
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "UPS",
  "createdAt": "2026/2/25 19:20:00"
}
```

## 开发阶段

- [x] Phase 1: 基础设施 (Astro + D1 + Drizzle)
- [x] Phase 2: 核心界面 (移动优先)
- [x] Phase 3: 手动查询 (< 50ms)
- [x] Phase 4: 拍照 OCR (Workers AI)

## 性能指标

| 指标 | 目标 | 实际 |
|------|------|------|
| 页面加载 | < 800ms | ✅ ~300ms (CDN) |
| 查询响应 | < 50ms | ✅ ~20ms (D1 Edge) |
| 拍照处理 | < 6s | ✅ ~3s (Workers AI) |

## 成本

全功能在 Cloudflare 免费额度内：

| 服务 | 免费额度 | SnapTrack 用量 |
|------|---------|----------------|
| **Pages** | 无限请求，500 构建/月 | ~10 构建/月 ✅ |
| **D1** | 5M 读/天，100K 写/天 | < 1K/天 ✅ |
| **Workers AI** | 10K neurons/天 | < 100/天 ✅ |

## 配置说明

### wrangler.toml

```toml
name = "snaptrack"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "snaptrack-db"
database_id = "你的-database-id"

[ai]
binding = "AI"
```

### astro.config.mjs

```javascript
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    mode: 'directory',      // Pages 目录模式
    functionPerRoute: true, // 每个路由一个 Function
  }),
});
```

## 故障排查

### 查看日志

```bash
# 实时日志
npx wrangler pages deployment tail --project-name=snaptrack
```

### 本地模拟

```bash
# 使用 wrangler 本地模拟 Pages 环境
npx wrangler pages dev dist --d1 DB --ai AI
```

### 常见问题

**Q: 部署后 API 404?**
A: 检查 `dist/_worker.js/` 目录是否存在，Pages 会自动检测。

**Q: 数据库连接失败?**
A: 确认 `wrangler.toml` 中的 `database_id` 正确，且已执行迁移。

**Q: Workers AI 不可用?**
A: 在 Cloudflare Dashboard 中启用 Workers AI。

## License

MIT
