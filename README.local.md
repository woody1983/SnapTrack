# 本地开发指南

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 方式一：Wrangler 本地模拟（推荐）

使用 Cloudflare 的本地开发环境，包含 D1 数据库：

```bash
# 启动本地开发服务器（带 D1 数据库）
npx wrangler pages dev --compatibility-flags=nodejs_compat --local

# 或者使用简化命令
npm run dev:local
```

访问 http://localhost:8788

### 3. 方式二：纯 Astro 开发（无数据库）

如果只需要开发前端 UI，不需要数据库功能：

```bash
npm run dev
```

访问 http://localhost:4321

---

## 数据库操作

### 创建本地数据库
```bash
npx wrangler d1 create snap-local
```

### 执行迁移
```bash
# 生产环境
npx wrangler d1 migrations apply snap

# 本地环境
npx wrangler d1 migrations apply snap-local --local
```

### 查看数据库（GUI）
```bash
npm run db:studio
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | Astro 开发模式（无数据库）|
| `npm run dev:local` | Wrangler 本地开发（有数据库）|
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run db:studio` | 打开数据库 GUI |

---

## 注意事项

1. **摄像头权限**：本地开发时浏览器需要 HTTPS 才能访问摄像头
   - Wrangler 本地开发已自动提供 HTTPS
   - 或者使用 `localhost` 允许摄像头访问

2. **数据库**：本地 D1 数据库存储在 `.wrangler/state/` 目录下

3. **环境变量**：本地开发时 `.env` 文件不会自动加载，需要在 `wrangler.toml` 中配置
