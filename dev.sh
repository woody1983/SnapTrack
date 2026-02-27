#!/bin/bash

echo "🚀 SnapTrack 本地开发启动脚本"
echo ""

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

echo "请选择开发模式:"
echo "1) 🌐 Wrangler 本地开发 (推荐，包含数据库) - http://localhost:8788"
echo "2) ⚡ Astro 纯前端开发 (无数据库) - http://localhost:4321"
echo ""
read -p "输入 1 或 2: " choice

case $choice in
    1)
        echo ""
        echo "🌐 启动 Wrangler 本地开发服务器..."
        echo "访问地址: https://localhost:8788"
        echo ""
        npx wrangler pages dev --compatibility-flags=nodejs_compat --local
        ;;
    2)
        echo ""
        echo "⚡ 启动 Astro 开发服务器..."
        echo "访问地址: http://localhost:4321"
        echo ""
        npm run dev
        ;;
    *)
        echo "无效选择，退出"
        exit 1
        ;;
esac
