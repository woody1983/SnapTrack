产品需求文档（PRD）
项目名称：SnapTrack（MVP v1.0）
文档版本：1.0
作者：Jiang,Grok 
日期：2026-02-25
目标：用 Astro + Drizzle ORM + Cloudflare D1 在最短时间内（1-3天）上线一个极简、移动端优先的工具，实现手动输入单号查状态 + 手机拍照自动提取并录入（仅支持 FedEx / UPS）。
1. 项目背景与目标
用户日常处理大量快递退货标签，需要快速确认一个单号是否已入库（避免重复），并希望通过手机拍照直接把单号 + 地址录入数据库。
核心价值：1秒查状态 + 5秒拍照自动录入，零服务器成本，全在 Cloudflare 边缘运行。
MVP 成功标准：

移动端（手机）打开即用，无需登录
手动输入单号 → 即时显示「已入库」或「未入库」
拍照按钮 → 启动相机 → 自动提取单号 + 发货地址 + 收货地址 → 录入数据库（去重）
总开发+部署时间 ≤ 3天

2. 目标用户与使用场景

个人/小型仓库/客服/退货处理人员
场景1：手动抄单号查重
场景2：手机扫标签（退货面单）直接入库

3. 功能需求（MVP 范围）
3.1 主页面（唯一页面 /index）

布局（移动优先，响应式）：
顶部标题：「快递单号查询与录入」
中间大输入框：placeholder="请输入 FedEx / UPS 单号（如 1Z1234567890123456）"
输入框右侧按钮：相机图标（手机端优先显示）
输入框下方实时状态显示区（绿色/红色卡片）

手动输入流程：
用户输入单号 → 点击「查询」或回车
系统查 D1 → 返回且仅返回两种状态：
「已入库」（绿色，显示「该单号已于 XXX 时间入库」）
「未入库」（红色，显示「该单号未入库，可通过拍照录入」）

不自动入库（符合需求）

拍照录入流程（核心）：
点击相机按钮 → 启动手机后置相机（capture="environment"）
用户拍照 → 自动上传图片（<5MB，jpg/png）
后端使用 Cloudflare Workers AI（llama-3.2-11b-vision-instruct） + 结构化 Prompt 提取：
tracking_number（FedEx/UPS 格式）
ship_from_address（发货地址）
ship_to_address（收货地址）
carrier（UPS 或 FedEx）

提取成功 → 检查是否已存在 → 不存在则插入 D1 → 返回「已成功录入」+ 显示提取结果预览
提取失败/无单号 → 显示「识别失败，请手动输入」并回退到手动模式

错误处理：
单号为空/格式错误 → 提示
图片过大/格式不对 → 提示
AI 提取失败 → 友好降级


3.2 数据库表（Drizzle Schema）
export const labels = sqliteTable('labels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tracking_number: text('tracking_number').notNull().unique(),
  carrier: text('carrier').notNull(), // 'UPS' | 'FedEx'
  ship_from_address: text('ship_from_address'), // 可空
  ship_to_address: text('ship_to_address'),     // 可空
  created_at: integer('created_at', { mode: 'timestamp' }).defaultNow(),
});

4. 非功能需求

性能：页面加载 < 800ms，查询 < 50ms，拍照处理 < 6s（Workers AI 边缘推理）
成本：Cloudflare 免费额度内（D1 + Workers AI 每天 10k neurons 免费）
安全：图片仅临时处理，不永久存储原图；单号唯一索引防重
兼容性：iOS/Android 浏览器（Safari/Chrome），无桌面特殊要求
可扩展性：后续可加用户登录、多承运商、批量上传

调整后的技术方案（锁定无 AI 版）

拍照/上传流程：
前端：<input type="file" capture="environment" accept="image/*">
上传到 Astro API route（或 Pages Function）
不存原图（符合隐私 + 节省 R2 成本）

提取逻辑（纯 JS，在 Workers 执行）：
用 sharp（Cloudflare 支持的图像库）或 canvas（如果前端预处理）做简单预处理：灰度 + 对比增强
但 Workers 里 sharp 有限支持 → 最简单：直接 base64 发给 OCR.space API（如果要纯零外部，就跳过图像处理，用正则在 raw text 上匹配）

