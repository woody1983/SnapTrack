# 产品需求文档（PRD）

**项目名称**：快递单号快速查询与录入系统（MVP v1.2 - 身份验证与监控优化版）  
**文档版本**：1.2  
**作者**：Jiang & Grok（基于用户需求）  
**日期**：2026-02-26  
**目标**：在现有平台和框架下，实现极简用户身份验证模块，并集成快递单号锁定与置顶监控功能。确保系统移动端优先、零服务器成本、全边缘运行。MVP聚焦于FedEx/UPS标签识别与查询，支持角色区分权限。

### 1. 项目背景与目标
用户处理FedEx/UPS退货标签，需要快速查询单号入库状态，并支持拍照录入。新增需求：  
- 强制用户身份验证（选择角色 + 密码），区分Service Desk（查询 & pin单号）和Warehouser（全功能）。  
- 允许用户锁定特定单号，实现置顶监控与自动解除。  



### 2. 目标用户与使用场景
- **Warehouser（仓库人员）**：处理标签录入、查询、监控紧急单号。场景：拍照扫描标签、锁定高优先级单号、实时刷新状态。  
- **Service Desk（服务台人员）**：查询状态。场景：客户咨询时快速查“已入库/未入库”，可锁定监控尚未入库的快递单号(pin track)。  也可以取消已经锁定但还未入库的单号（比如客户取消）

### 3. 功能需求（MVP 范围）

#### 3.1 用户身份验证模块（强制入口）
- **验证流程**：  
  - 首次/未验证时，全屏模态框覆盖主页面。  
  - 第一步：显示“请选择您的身份”，两个按钮：Service Desk、Warehouser。  
  - 第二步：切换显示“请输入密码”，提供输入框。  
  - 点击“验证”：  
    - 输入无效（空） → 显示“请输入密码”。  
    - 后台验证：比对数据库中该角色的加密密码。  
    - 成功 → 关闭模态，记录本地状态（身份 + 已验证标记），显示主页面。  
    - 失败 → 显示“密码错误，请重试”（5次错误以上锁定一小时无法尝试 并显示冷却倒计时）。  
- **本地状态管理**：验证通过后，本地记录身份，页面加载时检查跳过模态。  
- **退出/切换**：提供“退出”和“切换”按钮，清本地记录，重新弹出模态。  
- **密码管理**：  
  - 每角色一个预设密码，由管理员手动插入数据库（加密存储）。  
  - MVP不支持修改/忘记密码。  


- 锁定的单号录入数据库时 只录入单号 不生成日期和时间 

#### 3.3 快递单号锁定与置顶监控
- **锁定操作**：  
  - 查询“未入库”单号后，显示“锁定”按钮（Pin图标，仅验证用户可见）。  
  - 点击 → 添加到用户Pinned List（绑定当前角色）。  
  - 限制：每角色最多5个锁定。  
- **置顶显示**：  
  - Recent Entries列表默认显示最近10条记录（按created_at降序）。  
  - 锁定单号置顶（高亮、Pin图标）：显示单号、carrier、状态、最后刷新时间。  
  - 支持手动解锁（Unpin按钮）。  
- **刷新与更新**：  
  - 点击置顶项“刷新” → 查询D1更新状态。  
  - 每操作（点击/查看）刷新该单号。  
- **自动解除**：  
  - 后台录入该单号时，检查Pinned List → 移除匹配项（仅当前角色）。  
  - 显示通知：“单号已入库，已解除置顶”。  

#### 3.4 Recent Entries列表整合
- 显示最近查询/录入记录 + 当前角色置顶锁定项。  
- 置顶项优先排序，高亮显示。  
- 每项内容：单号、carrier、状态、时间。  

#### 3.5 数据库表
- **labels**：原表（tracking_number、carrier、ship_from_address、ship_to_address、created_at）。  
- **users**：新表（role、pin_hash、created_at）。  
- **pinned_trackings**：新表（id、role、tracking_number、pinned_at、last_refreshed_at）。  



### 5. 技术方案（锁定路径）

- **验证**：bcrypt比对。  






### 后续

注意点1：localStorage 易伪造的处理

问题分析：localStorage 存角色 + verified 标记确实易被 DevTools 修改（e.g., 伪造成 Warehouser 访问拍照功能）。对内部工具，如果信任用户/环境，这不是大问题；但为了加固，我们可以加服务器端校验。
解决方案：
验证成功后，不只存 localStorage，还生成一个简单 token (e.g., role + timestamp + HMAC 签名，用 crypto.subtle.sign)。
存到 cookie (HttpOnly, Secure) 或 localStorage。
每个 API 调用（e.g., 查询/pin/录入）时，后端验证 token（检查签名 + 过期时间，e.g., 1 天）。
如果伪造/失效 → 强制重新验证。
额外成本低：Workers 支持 crypto.subtle.sign/verify。

MVP 权衡：如果项目纯内部、不在意伪造，保持 localStorage 简单；否则加 token 校验（开发多 1 小时）。

注意点2：5次失败锁定冷却

问题分析：纯客户端 localStorage 存失败次数易绕过（清缓存），必须服务器端存储。
解决方案：
在 D1 users 表加字段：failed_attempts integer default 0，locked_until integer (timestamp) null。
验证失败时：递增 failed_attempts；如果 >=5 → 设置 locked_until = 当前时间 + 5 分钟。
验证前检查：如果 locked_until > 当前时间 → 返回 429 “账户锁定，请 5 分钟后重试”。
成功时重置 failed_attempts = 0。
冷却时间：5 分钟（可调），对 mini 项目够用。

为什么 D1：边缘低延迟，读写免费额度高（10万/天够用）。

注意点3：锁定单号的 created_at 为空

问题分析：SD pin 只录单号，不生成时间/日期，与 labels 表 schema 的 created_at $defaultFn 冲突（自动生成）。pin 不是正式录入，不应插 labels。
解决方案：
pin 仅插 pinned_trackings 表（不碰 labels）。
pinned_trackings 的 pinned_at 用 $defaultFn 自动生成时间（SD pin 也有时间戳）。
Warehouser 录入时才插 labels（created_at 自动）。
如果 SD pin 需要“无时间”，pinned_at 可设 nullable，但不推荐（时间戳对监控有用）。

逻辑澄清：SD pin 是“标记”，不生成 entry；Warehouser 录入才生成。

PRD 更新：在 3.3 “pin 操作” 中，明确 “pin 只插入 pinned_trackings（自动生成 pinned_at 时间戳），不插入 labels 表”。