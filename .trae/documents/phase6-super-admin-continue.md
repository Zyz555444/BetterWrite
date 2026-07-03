# Phase 6: 超级管理员端 — 续作计划（T3-T8）

## 摘要

继续 Phase 6 超级管理员端 Web 开发。T1（announcements 表 schema + 迁移 0004）与 T2（shared/types/admin.ts 6 个接口）已完成。本计划覆盖剩余 T3-T8：API 路由、fetcher 方法、5 个 Web 页面、导航更新与全量验证。

## 当前状态分析

### 已完成（T1-T2）
- `packages/db/src/schema/announcements.ts` — announcements 表（id, title, content, targetRole, isActive, createdBy, createdAt, updatedAt）+ relations
- `packages/db/migrations/0004_small_moonstone.sql` — 含 CREATE TABLE announcements + FK 同步
- `packages/shared/src/types/admin.ts` — 6 个接口：AdminDashboardStats, SchoolWithStats, SchoolStats, ApiConfigItem, ApiCallLogItem, AnnouncementItem
- `packages/shared/src/types/index.ts` — 已 export './admin.js'

### 未完成（T3-T8）
- `apps/web/src/lib/api/routes.ts`（2680 行）— imports 缺 `apiConfigs, apiCallLogs, announcements`；无任何 `/admin/*` 路由
- `apps/web/src/lib/api/fetcher.ts`（506 行）— 无任何 admin 方法
- `apps/web/src/app/admin/dashboard/page.tsx` — 仅占位（4 个 "-" 值的卡片）
- `apps/web/src/app/admin/schools/`、`/admin/apis/`、`/admin/announcements/`、`/admin/question-bank/` — 不存在
- `apps/web/src/components/layout/dashboard-layout.tsx` — navItems 已含 3 项（dashboard, schools, apis），缺 announcements + question-bank

### 关键约定（来自代码探查）
- **DB**: SQLite/Turso via Drizzle；`apiConfigs`（provider, apiKeyEncrypted, baseUrl, model, isActive, priority, maxTokens, temperature, rateLimitPerMin）+ `apiCallLogs`（provider, model, endpoint, tokensUsed, latencyMs, cost, status, errorMessage, essayId, createdAt）已存在
- **鉴权**: `authMiddleware` + `requireRole(UserRole.SUPER_ADMIN)`（单参数=严格 super_admin-only）；`requireRole` 用 `hasRequiredRole` 做层级比较
- **日志**: `[API /admin/xxx]` 前缀，入口 + 出口双日志含 duration
- **页面**: `'use client'` + `useEffect` + `useState` + `fetcher`；`RoleGuard` + `DashboardLayout` 包裹；仅 4 个 UI 组件（Button, Card, Input, Badge）+ 4 个图表组件
- **API 响应**: `{ success: boolean, data?: T, error?: string }`；失败返 `{ success: false, error }` + HTTP 状态码
- **Windows 兼容**: 用 `pnpm -r typecheck`（非 turbo）；`$env:NODE_OPTIONS="--import tsx"` 用于 drizzle-kit

## 设计决策

1. **API Key 加密**: AES-256-GCM via Node `crypto`，密钥来自 `ENCRYPTION_KEY` 环境变量；前端展示掩码 `****xxxx`（最后 4 位）；新建 `apps/web/src/lib/crypto.ts`
2. **评分标准配置**: 保持只读 GET（返回 `SCORING_WEIGHTS`、`SCORE_TIERS`、`DEDUCTION_RULES` 常量），不改造 AI 引擎
3. **学校删除**: 软删除（`isActive=false`），不级联删除关联数据
4. **公告 creatorName**: 通过 `db.query.announcements.findMany({ with: { creator: true } })` 联表查询
5. **题库管理**: 复用现有 `questionBank` schema；admin 端做 CRUD（教师端只读已存在）
6. **API 日志查询**: 支持 provider + 日期范围过滤 + 分页

## 实施步骤

### T3: API 路由 — 仪表盘 + 学校管理（6 路由）

**文件**: `apps/web/src/lib/api/routes.ts`

1. 在 import 块（10-28 行）添加 `apiConfigs, apiCallLogs, announcements`
2. 在 `drizzle-orm` import（58 行）添加 `count, gte, lt, or, sql`（按需）
3. 在 2676 行（最后一个路由后）插入 admin 路由区段：

```ts
// ========== Admin: Dashboard ==========
app.get('/admin/dashboard/stats', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  // 聚合: schools/users/essays/apiCallLogs 计数 + 今日作文 + API 调用统计
  // 返回 AdminDashboardStats
});

// ========== Admin: Schools ==========
app.get('/admin/schools', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  // 支持 region 过滤 + offset/limit 分页
  // 联表统计: teachers/students/classes/essays 数 + 平均分
  // 返回 SchoolWithStats[]
});

app.post('/admin/schools', authMiddleware, requireRole(UserRole.SUPER_ADMIN), zValidator('json', schoolCreateSchema), async (c) => {
  // schoolCreateSchema: code, name, region, contactName?, contactPhone?
});

app.put('/admin/schools/:id', authMiddleware, requireRole(UserRole.SUPER_ADMIN), zValidator('json', schoolUpdateSchema), async (c) => {
  // schoolUpdateSchema: name?, region?, contactName?, contactPhone?, isActive?
});

app.delete('/admin/schools/:id', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  // 软删除: set isActive=false
});

app.get('/admin/schools/:id/stats', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  // 返回 SchoolStats
});
```

### T4: API 路由 — API配置 + 日志 + 公告 + 题库 + 评分配置（14 路由）

**新文件**: `apps/web/src/lib/crypto.ts`
```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY ?? '0'.repeat(64), 'hex');

export function encrypt(plain: string): string { /* IV(12) + cipher + authTag(16) */ }
export function decrypt(enc: string): string { /* 解析 IV + authTag + cipher */ }
export function maskKey(key: string): string { /* ****xxxx */ }
```

**文件**: `apps/web/src/lib/api/routes.ts`（继续插入）

```ts
// ========== Admin: API Configs ==========
app.get('/admin/api-configs', ...);        // 列表（apiKeyMasked）
app.post('/admin/api-configs', ...);       // 创建（加密 apiKey）
app.put('/admin/api-configs/:id', ...);    // 更新（可选重新加密）
app.delete('/admin/api-configs/:id', ...); // 硬删除

// ========== Admin: API Logs ==========
app.get('/admin/api-logs', ...);           // 支持 provider + dateFrom + dateTo + offset/limit

// ========== Admin: Announcements ==========
app.get('/admin/announcements', ...);      // 列表（含 creatorName）
app.post('/admin/announcements', ...);     // 创建
app.put('/admin/announcements/:id', ...);  // 更新
app.delete('/admin/announcements/:id', ...); // 硬删除

// ========== Admin: Question Bank ==========
app.get('/admin/question-bank', ...);      // 列表（含分页）
app.post('/admin/question-bank', ...);     // 创建
app.put('/admin/question-bank/:id', ...);  // 更新
app.delete('/admin/question-bank/:id', ...); // 硬删除

// ========== Admin: Scoring Config ==========
app.get('/admin/scoring-config', ...);     // 返回 SCORING_WEIGHTS + SCORE_TIERS + DEDUCTION_RULES（只读）
```

### T5: Fetcher — admin 方法组（~20 方法）

**文件**: `apps/web/src/lib/api/fetcher.ts`

在 fetcher 对象末尾（`deleteDraft` 后，506 行 `}` 前）添加：

```ts
// Admin: Dashboard
getAdminDashboardStats: () => request<ApiResponse<AdminDashboardStats>>('/api/admin/dashboard/stats'),

// Admin: Schools
listAdminSchools: (params?: { region?: string; offset?: number; limit?: number }) => { /* URLSearchParams */ },
createAdminSchool: (body: { code: string; name: string; region: string; contactName?: string; contactPhone?: string }) => { /* POST */ },
updateAdminSchool: (id: string, body: { name?: string; region?: string; contactName?: string; contactPhone?: string; isActive?: boolean }) => { /* PUT */ },
deleteAdminSchool: (id: string) => { /* DELETE */ },
getAdminSchoolStats: (id: string) => request<ApiResponse<SchoolStats>>(`/api/admin/schools/${id}/stats`),

// Admin: API Configs
listAdminApiConfigs: () => request<ApiResponse<ApiConfigItem[]>>('/api/admin/api-configs'),
createAdminApiConfig: (body: { provider: string; apiKey: string; baseUrl?: string; model?: string; priority?: number; maxTokens?: number; temperature?: number; rateLimitPerMin?: number }) => { /* POST */ },
updateAdminApiConfig: (id: string, body: { ... }) => { /* PUT */ },
deleteAdminApiConfig: (id: string) => { /* DELETE */ },

// Admin: API Logs
listAdminApiLogs: (params: { provider?: string; dateFrom?: string; dateTo?: string; offset?: number; limit?: number }) => { /* URLSearchParams */ },

// Admin: Announcements
listAdminAnnouncements: () => request<ApiResponse<AnnouncementItem[]>>('/api/admin/announcements'),
createAdminAnnouncement: (body: { title: string; content: string; targetRole?: string; isActive?: boolean }) => { /* POST */ },
updateAdminAnnouncement: (id: string, body: { title?: string; content?: string; targetRole?: string; isActive?: boolean }) => { /* PUT */ },
deleteAdminAnnouncement: (id: string) => { /* DELETE */ },

// Admin: Question Bank
listAdminQuestionBank: (params?: { topicType?: string; difficulty?: string; offset?: number; limit?: number }) => { /* URLSearchParams */ },
createAdminQuestion: (body: { topicType: string; title: string; requirements: string; keyPoints?: string[]; referenceEssay?: string; wordLimitMin?: number; wordLimitMax?: number; difficulty?: string; source?: string }) => { /* POST */ },
updateAdminQuestion: (id: string, body: { ... }) => { /* PUT */ },
deleteAdminQuestion: (id: string) => { /* DELETE */ },

// Admin: Scoring Config
getAdminScoringConfig: () => request<ApiResponse<{ scoringWeights: typeof SCORING_WEIGHTS; scoreTiers: typeof SCORE_TIERS; deductionRules: typeof DEDUCTION_RULES }>>('/api/admin/scoring-config'),
```

需在 fetcher.ts 顶部 import 添加: `AdminDashboardStats, SchoolStats, ApiConfigItem, ApiCallLogItem, AnnouncementItem` from `@betterwrite/shared`；`SCORING_WEIGHTS, SCORE_TIERS, DEDUCTION_RULES` 作为类型导入。

### T6: Web 页面 — 仪表盘 + 学校 + API管理

**文件 1**: `apps/web/src/app/admin/dashboard/page.tsx`（重写）
- useEffect 调 `fetcher.getAdminDashboardStats()`
- 8 个统计卡片：学校/教师/学生/今日作文 + API 今日调用/总调用/成功率/平均延迟
- 用 `Card` + `CardHeader` + `CardTitle` + `CardContent` 现有组件

**文件 2**: `apps/web/src/app/admin/schools/page.tsx`（新建）
- 列表：表格（手写 table + Tailwind）
- 列: 代码/名称/区域/联系人/教师数/学生数/班级数/作文数/平均分/状态/操作
- 顶部: "新建学校"按钮 + 区域筛选输入
- 新建/编辑: 内联 Modal（手写 div + fixed overlay）
- 删除: confirm() 后调 deleteAdminSchool

**文件 3**: `apps/web/src/app/admin/apis/page.tsx`（新建）
- 上半: API 配置列表（provider/model/状态/优先级/操作）
- "新增配置"按钮 → Modal（provider 选择 + apiKey + baseUrl + model + priority 等）
- 下半: API 调用日志（provider 筛选 + 日期范围 + 表格：时间/provider/model/endpoint/tokens/延迟/状态）

### T7: Web 页面 — 公告 + 题库

**文件 4**: `apps/web/src/app/admin/announcements/page.tsx`（新建）
- 列表: 标题/目标角色/状态/创建人/创建时间/操作
- "发布公告"按钮 → Modal（title + content textarea + targetRole select + isActive toggle）
- 编辑/删除

**文件 5**: `apps/web/src/app/admin/question-bank/page.tsx`（新建）
- 列表: 题目类型/分类/标题/难度/字数范围/来源/操作
- 筛选: topicType + difficulty
- "新增题目"按钮 → Modal（topicType, title, requirements textarea, keyPoints 多行, wordLimitMin/max, difficulty select, source）
- 编辑/删除

### T8: 导航更新 + 全量验证

**文件**: `apps/web/src/components/layout/dashboard-layout.tsx`
- 在 `/admin/apis` 项后添加：
  - `/admin/announcements` — label "公告管理"，icon `Megaphone`（lucide-react）
  - `/admin/question-bank` — label "题库管理"，icon `Library`

**验证**:
1. `pnpm -r typecheck` — 8 workspaces 全绿
2. `pnpm -r lint`（或 `pnpm exec biome check`）— 0 errors
3. `pnpm -r build` — web 22+ 页面构建成功

## 假设与决策

- **不加 i18n**: 沿用现有中文硬编码
- **不加 TanStack Query**: 沿用 useEffect + useState 模式
- **不加新 UI 组件**: 表格/Modal/表单手写 + Tailwind（与 teacher 端一致）
- **不加新图表组件**: 仪表盘仅用数字卡片，无需图表
- **crypto.ts 兜底**: 若 `ENCRYPTION_KEY` 未设置，用 64 个 '0' 兜底（仅开发环境，生产必须设置）+ 启动时 console.warn
- **API 日志保留期**: 不在本阶段做清理任务（Phase 7 处理）
- **题库 isPublic 字段**: admin 创建默认 isPublic=1

## 验证步骤

1. **类型检查**: `pnpm -r typecheck` — 期望 8 workspaces 全绿，无 TS 错误
2. **Lint**: `pnpm exec biome check` — 期望 0 errors（注意 useExhaustiveDependencies 依赖数组）
3. **构建**: `pnpm -r build` — 期望 web 项目构建成功，新增 5 个 admin 页面路由
4. **路由完整性**: 确认 `/admin/dashboard`、`/admin/schools`、`/admin/apis`、`/admin/announcements`、`/admin/question-bank` 均可访问（需 super_admin 角色）

## 文件清单

### 新建（8 个）
- `apps/web/src/lib/crypto.ts`
- `apps/web/src/app/admin/schools/page.tsx`
- `apps/web/src/app/admin/apis/page.tsx`
- `apps/web/src/app/admin/announcements/page.tsx`
- `apps/web/src/app/admin/question-bank/page.tsx`

### 修改（4 个）
- `apps/web/src/lib/api/routes.ts` — 添加 ~20 admin 路由 + imports
- `apps/web/src/lib/api/fetcher.ts` — 添加 ~20 admin 方法 + imports
- `apps/web/src/app/admin/dashboard/page.tsx` — 重写为真实数据
- `apps/web/src/components/layout/dashboard-layout.tsx` — navItems 添加 2 项
