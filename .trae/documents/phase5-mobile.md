# Phase 5: 移动端开发实施计划

> **版本**: v1.0
> **创建日期**: 2026-07-03
> **前置**: Phase 4 学生端 Web 已完成（T12 验证待执行）
> **范围**: 学生端 + 教师端完整实现 + 完整原生能力（OCR/推送/离线草稿/深色模式）
> **认证**: 混合模式（Web cookie + Mobile Bearer token）

---

## 一、当前状态分析

### 已有基础
- `apps/mobile` 骨架已存在：Expo 57 + Expo Router 4 + React 19 + RN 0.86，已依赖 `@betterwrite/shared`
- `@betterwrite/shared` 全部为纯 TS（常量/类型/工具函数），RN 可直接复用
- `@betterwrite/design-system` 导出 `YOHAKU_TOKENS` 和 `ERROR_COLORS` 纯 JS 常量，RN 可直接 import
- Web 端 4 个 SVG 图表（radar/pie/line/bar）为纯算法无依赖，可用 `react-native-svg` 移植
- API 路由完整（21 学生端 + 教师端 + 认证），移动端只需增加 token 认证分支

### 需要新增/改造
1. **DB**: 新增 `api_tokens` 表（Bearer token）+ `device_tokens` 表（推送 token）
2. **API**: authMiddleware 增加 Bearer token 分支 + 新增 4 个路由（token 颁发/设备注册/OCR 上传/推送测试）
3. **Worker**: 新增 OCR 模块（云 OCR API 调用 + mock 降级）
4. **移动端**: 完整 App（~50 文件）

### 关键技术决策
| 决策点 | 方案 | 理由 |
|--------|------|------|
| 样式方案 | StyleSheet + YOHAKU_TOKENS | 不引入 NativeWind 编译层，直接用 design-system token，性能更好 |
| 认证方式 | 新增 api_tokens 表 + Bearer token | 不改动现有 cookie 流程，middleware 增加 Bearer 分支 |
| 图表 | react-native-svg 重写 4 个图表 | 算法逻辑复用，仅替换 SVG 标签 |
| OCR | 移动端拍照 → 上传 API → Worker 调云 OCR | 与 correctEssay 一致的 mock 降级策略 |
| 推送 | expo-notifications + Expo Push API | 标准方案，后端存储 device token |
| 离线草稿 | AsyncStorage（本地） + 同步 essay_drafts 表 | 与 Web 端共用 drafts API |
| 状态管理 | Zustand（与 Web 一致） | 复用 store 模式 |
| 路由 | Expo Router 文件式 + 角色分组 | (auth)/(student)/(teacher) |

---

## 二、实施计划

### Part 1: T12 — Phase 4 全量验证

**目标**: 确保 Phase 4 代码 build/typecheck/lint 全绿

**步骤**:
1. 运行 `pnpm typecheck`（全量类型检查）
2. 运行 `pnpm exec biome check`（全量 lint）
3. 运行 `pnpm -r build`（全量构建）
4. 修复发现的任何错误

**验收**: 三项命令均退出码 0

---

### Part 2: Phase 5 移动端开发

#### T1: DB 扩展 — api_tokens + device_tokens 表

**文件**:
- `packages/db/src/schema/api-tokens.ts`（新建）
- `packages/db/src/schema/device-tokens.ts`（新建）
- `packages/db/src/schema/index.ts`（增加 2 个导出）
- `packages/db/src/schema/users.ts`（usersRelations 增加 2 个 many）
- `packages/db/migrations/0003_xxx.sql`（drizzle-kit generate）

**api_tokens 表**:
```ts
{
  id: text PK,
  userId: text → users.id (notNull),
  token: text (notNull, unique),  // crypto.randomUUID()
  platform: text (notNull),       // 'ios' | 'android'
  deviceName: text,
  expiresAt: text (notNull),      // ISO time, 90 天
  lastUsedAt: text,
  createdAt: text (notNull),
}
// uniqueIndex on token
```

**device_tokens 表**（Expo push token）:
```ts
{
  id: text PK,
  userId: text → users.id (notNull),
  token: text (notNull),          // Expo push token
  platform: text (notNull),       // 'ios' | 'android'
  createdAt: text (notNull),
  updatedAt: text (notNull),
}
// uniqueIndex on (userId, token)
```

---

#### T2: API 后端扩展 — 混合认证 + OCR + 推送

**文件**:
- `apps/web/src/lib/api/middleware.ts`（改造 authMiddleware）
- `apps/web/src/lib/api/routes.ts`（新增 5 个路由）
- `apps/worker/src/ocr.ts`（新建 OCR 模块）
- `apps/worker/src/index.ts`（导出 OCR 函数）

**middleware.ts 改造**:
```ts
// authMiddleware 增加逻辑：
// 1. 先检查 Authorization: Bearer xxx
// 2. 若有 Bearer，查 api_tokens 表 → 关联 user → 更新 lastUsedAt
// 3. 若无 Bearer，走原 cookie 流程（lucia.validateSession）
// 4. 两种方式都失败 → 抛 401
```

**新增路由**:
1. `POST /api/auth/token` — 移动端登录，返回 Bearer token（不再设 cookie）
   - 入参: email/password/platform/deviceName
   - 流程: 验证密码 → 生成 token → insert api_tokens → 返回 { token, user }
2. `POST /api/auth/device-token` — 注册推送 token
   - 入参: token/platform
   - authMiddleware 保护
   - upsert device_tokens
3. `POST /api/essays/ocr` — 上传图片 OCR
   - 入参: imageBase64/taskId?
   - authMiddleware + requireRole(STUDENT)
   - 调用 worker 的 performOcr → 返回 { content, confidence }
   - 若有 taskId，可选自动创建 essay（submitType='ocr'）
4. `POST /api/notifications/test` — 发送测试推送
   - authMiddleware 保护
   - 查当前用户 device_tokens → 调用 Expo Push API
5. `GET /api/auth/tokens` — 查看活跃 token 列表（可选，用于账号管理）

**worker/src/ocr.ts**:
```ts
export async function performOcr(imageBase64: string): Promise<{
  content: string;
  confidence: number;
}> {
  // 1. 检查环境变量 OCR_PROVIDER / OCR_API_KEY
  // 2. 若配置了 Google Cloud Vision API key → 调用真实 OCR
  // 3. 若无配置 → 返回 mock（content: "This is a mock OCR result...", confidence: 0.85）
  // 与 correctEssay 的 mock 策略一致
}
```

---

#### T3: 移动端项目搭建 — 依赖 + 路由 + 主题 + 组件库

**文件**:
- `apps/mobile/package.json`（增加依赖）
- `apps/mobile/babel.config.js`（新建，expo-router + react-native-svg）
- `apps/mobile/app.json`（新建/修改，Expo 配置 + 权限声明）
- `apps/mobile/src/app/_layout.tsx`（根布局，providers）
- `apps/mobile/src/app/(auth)/_layout.tsx`
- `apps/mobile/src/app/(auth)/login.tsx`
- `apps/mobile/src/app/(auth)/register.tsx`
- `apps/mobile/src/app/(student)/_layout.tsx`（Tab Bar）
- `apps/mobile/src/app/(teacher)/_layout.tsx`（Tab Bar）
- `apps/mobile/src/theme/tokens.ts`（YOHAKU_TOKENS RN 版）
- `apps/mobile/src/theme/styles.ts`（全局样式工具函数）
- `apps/mobile/src/components/ui/Button.tsx`
- `apps/mobile/src/components/ui/Input.tsx`
- `apps/mobile/src/components/ui/Card.tsx`
- `apps/mobile/src/components/ui/Badge.tsx`
- `apps/mobile/src/components/ui/Loading.tsx`
- `apps/mobile/src/components/ui/Empty.tsx`
- `apps/mobile/src/components/ui/index.ts`

**依赖新增**:
```json
{
  "expo-camera": "~16.0.0",
  "expo-secure-store": "~15.0.0",
  "expo-notifications": "~0.29.0",
  "expo-image-picker": "~16.0.0",
  "expo-device": "~7.0.0",
  "expo-status-bar": "~2.2.0",
  "react-native-svg": "15.11.2",
  "react-native-safe-area-context": "5.4.0",
  "@react-native-async-storage/async-storage": "2.1.2",
  "zustand": "^5.0.14",
  "@expo/vector-icons": "^14.0.2"
}
```

**主题 tokens.ts**:
```ts
import { YOHAKU_TOKENS } from '@betterwrite/design-system';
// 转为 RN 可用格式
export const colors = {
  accent: YOHAKU_TOKENS.colors.accent,        // #33a6b8
  accentHover: YOHAKU_TOKENS.colors.accentHover,
  bgPrimary: YOHAKU_TOKENS.colors.bgPrimary,
  bgSecondary: YOHAKU_TOKENS.colors.bgSecondary,
  // ... 全部映射
};
export const spacing = { ... };
export const radius = { ... };
```

**组件库设计**:
- Button: variants (primary/secondary/ghost/outline), sizes (sm/md/lg), loading 态
- Input: label, error, secureTextEntry, multiline
- Card: elevated style with shadow
- Badge: variants (success/warning/error/info/accent)
- Loading: ActivityIndicator wrapper
- Empty: 空状态占位

**Tab Bar 结构**:
- 学生端 5 Tab: 首页 / 任务 / 练习 / 助手 / 我的
- 教师端 4 Tab: 概览 / 任务 / 批改 / 我的

---

#### T4: 移动端基础设施 — API 客户端 + Auth + 图表 + 离线

**文件**:
- `apps/mobile/src/lib/api/client.ts`（fetch 封装 + Bearer token 注入）
- `apps/mobile/src/lib/api/fetcher.ts`（所有 API 方法，与 web 对齐）
- `apps/mobile/src/lib/auth/store.ts`（Zustand + expo-secure-store 持久化）
- `apps/mobile/src/lib/storage/draft-storage.ts`（AsyncStorage 离线草稿）
- `apps/mobile/src/lib/notifications/push.ts`（expo-notifications 注册）
- `apps/mobile/src/components/charts/RadarChart.tsx`（react-native-svg）
- `apps/mobile/src/components/charts/LineChart.tsx`
- `apps/mobile/src/components/charts/BarChart.tsx`
- `apps/mobile/src/components/charts/PieChart.tsx`
- `apps/mobile/src/components/charts/index.ts`

**API 客户端 client.ts**:
```ts
import * as SecureStore from 'expo-secure-store';
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await SecureStore.getItemAsync('auth_token');
  const headers = { 'Content-Type': 'application/json', ...(options?.headers ?? {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  return data;
}
```

**Auth store**:
```ts
// Zustand store
// login: POST /api/auth/token → 存 token 到 SecureStore + user 到 AsyncStorage
// logout: POST /api/auth/logout + 清除 SecureStore + AsyncStorage
// fetchMe: GET /api/auth/me（用 Bearer token）
// hydrate: App 启动时从 SecureStore 读 token → fetchMe 恢复会话
```

**图表移植**:
- 4 个图表算法逻辑从 web 端原样复制
- `<svg>` → `<Svg>`, `<polygon>` → `<Polygon>`, `<text>` → `<Text>` (react-native-svg)
- CSS 变量 `var(--accent)` → `colors.accent`
- 移除 `'use client'` 指令

---

#### T5: 认证页面

**文件**:
- `apps/mobile/src/app/(auth)/login.tsx`
- `apps/mobile/src/app/(auth)/register.tsx`

**登录页**:
- Email + Password 输入
- 登录按钮 → auth store login
- 成功后根据 role 跳转 (student)/index 或 (teacher)/index
- 错误提示

**注册页**:
- Email + Password + Name + Role 选择(teacher/student)
- 可选 schoolCode + classCode
- 注册 → 自动登录 → 跳转

---

#### T6: 学生端页面（8 模块）

**文件**（~15 个页面）:
- `apps/mobile/src/app/(student)/index.tsx` — 首页（待办 + 最近批改 + 每日金句 + 统计）
- `apps/mobile/src/app/(student)/tasks/index.tsx` — 任务列表
- `apps/mobile/src/app/(student)/tasks/[id].tsx` — 写作编辑器（计时器 + 草稿 + OCR 拍照入口）
- `apps/mobile/src/app/(student)/essays/index.tsx` — 我的作文列表
- `apps/mobile/src/app/(student)/essays/[id].tsx` — 批改结果（总分 + 分维度 + 错误高亮 + AI 修改版）
- `apps/mobile/src/app/(student)/practice/index.tsx` — 练习首页（题库/限时/历史 3 Tab）
- `apps/mobile/src/app/(student)/practice/[id].tsx` — 题目练习
- `apps/mobile/src/app/(student)/practice/mock.tsx` — 限时模拟
- `apps/mobile/src/app/(student)/errors/index.tsx` — 错题本（按类型分组）
- `apps/mobile/src/app/(student)/progress/index.tsx` — 写作成长（雷达图 + 曲线 + 成就）
- `apps/mobile/src/app/(student)/assistant/index.tsx` — AI 助手（4 模式）
- `apps/mobile/src/app/(student)/profile/index.tsx` — 个人中心（信息 + 设置 + 退出）

**写作编辑器要点**:
- TextInput 多行编辑 + 实时词数统计
- 计时器（基于 task.timeLimitMinutes）
- 草稿自动保存到 AsyncStorage（离线）+ 定时同步 drafts API（在线）
- OCR 入口：expo-camera 拍照 → POST /api/essays/ocr → 填充 content
- 提交前自查清单（ChecklistGuard 移植）
- 提交 → POST /api/essays → 跳转批改结果页

**批改结果页要点**:
- 总分大数字 + 评级 Badge
- 分维度得分（4 项进度条）
- 错误列表（原句 vs 修正，颜色高亮）
- AI 修改版（可切换原文/修改版）
- 改进建议清单

---

#### T7: 教师端页面（5 模块）

**文件**（~8 个页面）:
- `apps/mobile/src/app/(teacher)/index.tsx` — 仪表盘（统计 + 班级 + 最近任务）
- `apps/mobile/src/app/(teacher)/tasks/index.tsx` — 任务列表
- `apps/mobile/src/app/(teacher)/tasks/create.tsx` — 创建任务（表单）
- `apps/mobile/src/app/(teacher)/essays/index.tsx` — 批改中心（作文列表）
- `apps/mobile/src/app/(teacher)/essays/[id].tsx` — 作文批改详情查看
- `apps/mobile/src/app/(teacher)/students/index.tsx` — 学生列表
- `apps/mobile/src/app/(teacher)/students/[id].tsx` — 学生详情
- `apps/mobile/src/app/(teacher)/profile/index.tsx` — 个人中心

**教师端移动端精简策略**:
- 不做复杂的数据分析图表（留到 Web 端）
- 重点关注：查看 > 编辑（移动端以浏览为主）
- 任务创建：简化表单（标题/要求/班级/字数/截止时间）
- 批改中心：查看 AI 批改结果 + 学生作文，不支持教师复核（Web 端做）

---

#### T8: 原生能力实现

**文件**:
- `apps/mobile/src/lib/camera/ocr-camera.tsx` — OCR 相机组件
- `apps/mobile/src/lib/notifications/push.ts`（T4 已建，此处完善）
- `apps/mobile/src/lib/storage/draft-storage.ts`（T4 已建，此处完善）
- `apps/mobile/src/theme/dark-mode.ts` — 深色模式 token 切换

**OCR 拍照流程**:
1. 用户在写作页点击"拍照上传"按钮
2. 请求相机权限 (expo-camera)
3. 打开相机界面 → 拍照
4. 图片转 base64
5. POST /api/essays/ocr { imageBase64, taskId }
6. 返回 { content, confidence }
7. 填充到编辑器 content
8. 若 confidence < 0.7 显示警告"识别准确度较低，请核对"

**推送通知**:
1. App 启动时请求通知权限
2. 获取 Expo push token (getExpoPushTokenAsync)
3. POST /api/auth/device-token { token, platform }
4. 触发场景：作文批改完成（worker 完成后调用推送模块）
5. worker 新增：批改完成后查 device_tokens → 调 Expo Push API

**离线草稿**:
1. 写作时每 5 秒自动保存到 AsyncStorage（离线可用）
2. 网络恢复时同步到 /api/student/drafts/:taskId
3. App 启动时从 AsyncStorage 恢复未提交草稿

**深色模式**:
- theme/tokens.ts 增加 darkColors
- useColorScheme() 检测系统主题
- 根布局根据 colorScheme 切换 token

---

#### T9: 全量验证

**步骤**:
1. `pnpm typecheck` — 全量类型检查
2. `pnpm exec biome check` — 全量 lint
3. `pnpm -r build` — 全量构建（web + worker + shared + db + ai）
4. `cd apps/mobile && pnpm typecheck` — 移动端类型检查
5. 手动检查 Expo Router 路由结构完整性

**验收**:
- 所有命令退出码 0
- 移动端路由结构完整：(auth)/(student)/(teacher) 三组
- API 路由 21（学生）+ 教师端 + 5（新增）均可达
- DB 迁移文件已生成

---

## 三、任务分解与执行顺序

| 任务 | 内容 | 依赖 | 预计文件数 |
|------|------|------|-----------|
| T12 | Phase 4 全量验证 | 无 | 0（修复现有） |
| T1 | DB 扩展（api_tokens + device_tokens） | T12 | 5 |
| T2 | API 后端扩展（认证+OCR+推送） | T1 | 4 |
| T3 | 移动端项目搭建（依赖+路由+主题+组件库） | T12 | 17 |
| T4 | 移动端基础设施（API+Auth+图表+离线） | T3 | 10 |
| T5 | 认证页面 | T4 | 2 |
| T6 | 学生端页面（8 模块） | T4, T5 | 15 |
| T7 | 教师端页面（5 模块） | T4, T5 | 8 |
| T8 | 原生能力（OCR+推送+离线+深色） | T6, T7 | 4 |
| T9 | 全量验证 | 全部 | 0 |

**并行策略**:
- T1 + T3 可并行（DB 和移动端骨架无依赖）
- T6 + T7 可并行（学生端和教师端页面独立）
- T8 依赖 T6/T7 的写作页和个人中心

**总文件数**: ~65 个（新建 ~60 + 改造 ~5）

---

## 四、风险与对策

| 风险 | 对策 |
|------|------|
| Expo SDK 57 + RN 0.86 兼容性 | 依赖版本锁定到已知兼容的 ~范围 |
| react-native-svg 与 Expo 集成 | 用 Expo 管理的版本（15.11.2），无需 native link |
| OCR 云服务密钥未配置 | worker OCR 模块 mock 降级（与 correctEssay 一致） |
| 推送通知需 Expo 账号 | 代码实现完整，实际推送需配置 EXPO_ACCESS_TOKEN |
| Windows 环境无法运行 iOS 模拟器 | typecheck + biome 验证为主，实际运行测试留给用户 |
| Bearer token 安全性 | token 为 UUID，90 天过期，存 expo-secure-store（加密） |

---

## 五、关键文件清单

### DB 层（5 文件）
- `packages/db/src/schema/api-tokens.ts`
- `packages/db/src/schema/device-tokens.ts`
- `packages/db/src/schema/index.ts`（改造）
- `packages/db/src/schema/users.ts`（改造）
- `packages/db/migrations/0003_xxx.sql`

### API 层（4 文件）
- `apps/web/src/lib/api/middleware.ts`（改造）
- `apps/web/src/lib/api/routes.ts`（改造）
- `apps/worker/src/ocr.ts`
- `apps/worker/src/index.ts`（改造）

### 移动端 — 基础设施（27 文件）
- `apps/mobile/package.json`（改造）
- `apps/mobile/babel.config.js`
- `apps/mobile/app.json`
- `apps/mobile/src/app/_layout.tsx`
- `apps/mobile/src/app/(auth)/_layout.tsx`
- `apps/mobile/src/app/(student)/_layout.tsx`
- `apps/mobile/src/app/(teacher)/_layout.tsx`
- `apps/mobile/src/theme/tokens.ts`
- `apps/mobile/src/theme/styles.ts`
- `apps/mobile/src/theme/dark-mode.ts`
- `apps/mobile/src/components/ui/{Button,Input,Card,Badge,Loading,Empty}.tsx` + `index.ts`
- `apps/mobile/src/lib/api/client.ts`
- `apps/mobile/src/lib/api/fetcher.ts`
- `apps/mobile/src/lib/auth/store.ts`
- `apps/mobile/src/lib/storage/draft-storage.ts`
- `apps/mobile/src/lib/notifications/push.ts`
- `apps/mobile/src/lib/camera/ocr-camera.tsx`
- `apps/mobile/src/components/charts/{RadarChart,LineChart,BarChart,PieChart}.tsx` + `index.ts`

### 移动端 — 页面（25 文件）
- 认证: `login.tsx`, `register.tsx`
- 学生端: 12 页面（index/tasks/index/tasks/[id]/essays/index/essays/[id]/practice/index/practice/[id]/practice/mock/errors/index/progress/index/assistant/index/profile/index）
- 教师端: 8 页面（index/tasks/index/tasks/create/essays/index/essays/[id]/students/index/students/[id]/profile/index）
- 各角色 Tab Bar layout 已在基础设施中

---

## 六、验证矩阵

| 检查项 | 命令/方法 | 期望结果 |
|--------|-----------|----------|
| Phase 4 类型 | `pnpm typecheck` | 0 errors |
| Phase 4 lint | `pnpm exec biome check` | 0 errors |
| Phase 4 构建 | `pnpm -r build` | 成功 |
| DB 迁移 | `pnpm db:generate` | 生成 0003 迁移 |
| 移动端类型 | `cd apps/mobile && pnpm typecheck` | 0 errors |
| 移动端 lint | `cd apps/mobile && pnpm exec biome check` | 0 errors |
| API 路由可达 | 手动 curl /api/auth/token | 返回 token |
| OCR 路由可达 | 手动 curl /api/essays/ocr | 返回 content（mock 或真实） |
| 路由结构 | 检查 app/ 目录 | (auth)/(student)/(teacher) 完整 |
