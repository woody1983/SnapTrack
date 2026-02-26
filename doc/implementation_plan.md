# SnapTrack MVP Implementation Plan

## Goal Description
Provide a comprehensive step-by-step roadmap for implementing the core MVP functionalities (Manual Tracking, Camera Automated Entry, and Database operations) of SnapTrack, meticulously addressing logic variations, decision points, and edge cases.

## Proposed Changes / Implementation Plan

### Phase 1: 基础设施搭建 (Infrastructure Setup)
<!-- 中文注释：此阶段用于搭建无服务器架构的基础，确保数据库结构可靠，为后续功能铺排前置条件。 -->
- **Step 1:** Initialize the Astro framework mapped to the Cloudflare Pages/Workers target using `@astrojs/cloudflare`.
- **Step 2:** Setup Drizzle ORM configured with Cloudflare D1 credentials and generate migrations.
- **Step 3:** Implement the `labels` SQLite scheme with a `UNIQUE` index on `tracking_number`.
  - **Decision Point (决策点):** Time tracking. We will use Drizzle's SQLite `mode: 'timestamp'` to correctly handle timestamps cross-platform via standard Date objects.
  - **Edge Case (边界情况):** Database migration failing during deployment lock. *Mitigation:* Incorporate local Drizzle seeding scripts to strictly validate queries before any edge deployments. 

### Phase 2: 核心界面开发 (Core UI Design)
<!-- 中文注释：界面必须是极致的移动端优先，交互元素大且便于触摸，保证扫描库内的即时视觉反馈。 -->
- **Step 1:** Scaffolding the sole `/index` page employing a minimal, responsive container layout.
- **Step 2:** Build the large input box for the tracking number with a dedicated context-aware keyboard profile (`inputmode="text"` to allow numbers and upper alpha combinations).
- **Step 3:** Develop the Camera integration button utilizing the native `capture="environment"` attribute to force back-camera usage.
- **Step 4:** Construct the dynamic Status Feedback Card, capable of immediately switching between specific layout states (Neutral waiting, Loading spinner, Green success text, Red fallback error text).

### Phase 3: 手动查询流程 (Manual Tracking Flow)
<!-- 中文注释：此流程要求速度极快(< 50ms)，需要防注入，且尽量直接查询 D1 数据库。 -->
- **Step 1:** Add client-side listener for submission on the input field via a "Search" UI button or standard "Enter" keyboard submission.
- **Step 2:** Pre-flight Data Sanitization.
  - **Edge Case (边界情况):** User copy-pastes messy formatting (e.g. `" 1Z 123 456 \n"`). *Mitigation (处理方法):* The Javascript frontend aggressively strips all spaces, hyphens, and trims strings before performing an uppercase transformation for uniform querying.
- **Step 3:** Transmit clean request directly to serverless edge via Astro route (`/api/check`).
- **Step 4:** Process D1 database matching query. Returns either an `Exists` (including entry timestamp) or `Does Not Exist` flag back to client. 
  - **Edge Case (边界情况):** Networking drop or fetch timeout. *Mitigation (处理方法):* Trigger a generic UI alert instructing the user to try again softly.

### Phase 4: 拍照自动录入流程核心 (Camera Auto-Entry Core Flow)
<!-- 中文注释：这是系统的核心难点：拍照 -> 上传 -> 识别 -> 查重及写入。必须在此阶段充分考虑弱网容错和防重机制。 -->
- **Step 1:** Engage the system camera input prompt wrapper.
  - **Edge Case (边界情况):** User selects an image that is massively > 5MB, or uploads wrong mime-types (e.g .pdf, .docx). *Mitigation (处理方法):* Restrict input directly via `<input accept="image/jpeg,image/png">` AND validate size locally in JS before attempting payload dispatch, preventing failed backend requests.
- **Step 2:** Dispatch Image to Endpoint (`/api/upload-ocr`).
  - **Decision Point (决策点):** Where to resize files. Given Cloudflare's strict invocation time and transfer limitations, if the image passes check, we should heavily downsize it directly in frontend canvas (e.g. limiting width to 1024px) before conversion to base64, preserving bandwidth.
- **Step 3:** Execute OCR Execution Pipeline.
  - **Decision Point (决策点):** Trigger Workers AI `llama-3.2-11b` (If supported for Vision) or fallback to `OCR.space`. We recommend structuring the extraction pipeline to grab raw text first if structured JSON prompts result in too high latency (>6s).
  - **Edge Case (边界情况):** Unreadable image text or failed API response. *Mitigation (处理方法):* Implement a rigid timeout cap (e.g., 4.5 seconds). After a bust, degrade gracefully explicitly informing the user "识别失败，请手动输入" (Recognition failed, please manually enter) reverting immediately to manual manual prompt.
- **Step 4:** Regex Text Processing. Check returned plain string data locally against tracking formats:
  - *UPS Regex:* Matching combinations starting with `1Z` capturing alphanumerics.
  - *FedEx Regex:* Validating length constants of specific pure digits (12, 15, or roughly 22 numeric chars depending on variant).
  - **Edge Case (边界情况):** Background labels causing multiple matched results. *Mitigation (处理方法):* Programmatically capture the most confident format match, verify length validity, then proceed.
- **Step 5:** Database Transaction - Perform D1 `INSERT`.
  - **Decision Point (决策点):** Preventing concurrent double-scans.
  - **Edge Case (边界情况):** Two sessions post the same tracking number fraction-seconds apart. *Mitigation (处理方法):* Rather than explicitly checking "Select" then "Insert", execute the insert statement blindly against the `UNIQUE` D1 tracking number column mapping a SQLite error code gracefully into a "Already Logged at {date}" status view in the frontend.

## Verification Plan
1. **Frontend Isolation Check:** Manually load the browser and emulate weak connections to trigger sanitization and size constraint error UI.
2. **Device Parity Tests:** Visit on an actual iOS and Android device to assert physical orientation of the device camera correctly starts backwards facing.
3. **Regex Dry-Run Tests:** Write small node/Deno scripts executing the UPS and FedEx regexes specifically up against simulated chaotic OCR gibberish strings.
4. **Duplicates Test:** Send two cURL requests mimicking identical valid tracking uploads tracking D1 database rejection handling properly.
