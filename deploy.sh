#!/bin/bash

# SnapTrack 部署脚本
# 部署到 Cloudflare Pages (Directory 模式)

set -e

echo "🚀 SnapTrack Pages 部署脚本"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查依赖
echo "📦 检查依赖..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx 不可用${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 依赖检查通过${NC}"

# 安装依赖
echo ""
echo "📦 安装依赖..."
npm ci

# 检查 wrangler 登录
echo ""
echo "🔐 检查 Cloudflare 登录状态..."
if ! npx wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️ 未登录 Cloudflare${NC}"
    echo "执行登录..."
    npx wrangler login
else
    echo -e "${GREEN}✓ 已登录${NC}"
fi

# 检查数据库配置
echo ""
echo "🔍 检查数据库配置..."
if grep -q "your-database-id-here" wrangler.toml; then
    echo -e "${YELLOW}⚠️ 请先在 wrangler.toml 中配置 database_id${NC}"
    echo ""
    echo "获取 database_id:"
    echo "  npx wrangler d1 list"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ 数据库配置检查通过${NC}"

# 构建
echo ""
echo "🔨 构建项目..."
npm run build

# 检查构建输出
echo ""
echo "🔍 检查构建输出..."
if [ ! -d "dist/_worker.js" ]; then
    echo -e "${RED}❌ 构建输出不正确，缺少 _worker.js 目录${NC}"
    exit 1
fi

if [ ! -f "dist/_routes.json" ]; then
    echo -e "${RED}❌ 缺少 _routes.json 文件${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 构建输出正常${NC}"

# 确认部署
echo ""
echo -e "${YELLOW}⚡ 准备部署到 Cloudflare Pages${NC}"
read -p "是否继续? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 部署
echo ""
echo "🚀 部署到 Cloudflare Pages..."
npx wrangler pages deploy dist --project-name=snaptrack

echo ""
echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo "访问地址:"
echo "  • 生产环境: https://snaptrack.pages.dev"
echo ""
echo "管理面板:"
echo "  • Dashboard: https://dash.cloudflare.com"
echo ""
