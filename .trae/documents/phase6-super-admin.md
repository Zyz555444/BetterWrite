# Phase 6: 超级管理员端 — 实施计划

> **目标**: 实现超级管理员 Web 端完整功能，包括仪表盘、学校管理、API 管理、公告管理、题库管理、日志审计 6 大模块

## Context

Phase 0-5 已全部完成（项目初始化、基础设施、AI 批改引擎、教师端 Web、学生端 Web、移动端）。根据 `docs/05-开发实施计划.md`，下一步是 Phase 6: 超级管理员端（第 14 周）。

**现状**:
- 仅有占位页 `apps/web/src/app/admin/dashboard/page.tsx`（4 张卡片显示 `-`，未接 API）
- 侧边栏导航已预声明 3 项（dashboard / schools / apis），但 schools 和 apis 页面不存在
- DB 已有 `apiConfigs`、`apiCallLogs`、`schools`、`questionBank` 表，但无任何 `/api/admin/*` 路由
- `announcements` 表不存在，需新建
- 评分配置常量硬编码在 `packages/shared/src/constants/scoring.ts`，暂不做动态化

## 任务分解

### T1: DB Schema — announcements 表 + migration

**文件**:
- 新建 `packages/db/src/schema/announcements.ts`
- 修改 `packages/db/src/schema/index.ts`（追加 export）
- 运行 `pnpm db:generate` 生成 migration（需用 `$env:NODE_OPTIONS="--import tsx"` 绕过 Windows 兼容问题）

**Schema 设计**（适配 SQLite 风格，参考 `schools.ts`）:
```ts
announcements 表:
  id: text primaryKey
  title: text notNull
  content: text notNull
  targetRole: text  -- all/super_admin/school_admin/teacher/student
  isActive: integer boolean default true
  createdBy: text references users.id onDelete set null
  createdAt: text notNull
  updatedAt: text notNull
```

### T2: Shared 类型扩展

**文件**:
- 新建 `packages/shared/src/types/admin.ts`
- 修改 `packages/shared/src/types/index.ts`（追加 export）

**类型清单**:
- `AdminDashboardStats` — { totalSchools, totalTeachers, totalStudents, totalEssays, todayEssays, activeRate, apiCallsToday, apiCallsTotal }
- `SchoolWithStats` — School 基本信息 + totalTeachers/totalStudents/totalClasses/totalEssays/averageScore
- `ApiConfigItem` — apiConfigs 表对应（apiKeyEncrypted 用掩码 `****xxxx` 返回）
- `ApiCallLogItem` — apiCallLogs 表对应
- `AnnouncementItem` — announcements 表对应
- `QuestionBankItem` — questionBank 表对应（已存在但需统一类型）

### T3: API 路由 — 仪表盘 + 学校管理

**修改文件**: `apps/web/src/lib/api/routes.ts`
- 顶部 import 追加 `apiConfigs, apiCallLogs`（当前未导入）
- 新建 import `announcements` schema

**路由清单**:

```
GET  /api/admin/dashboard/stats    — 系统总览（学校/教师/学生/作文数 + 今日活跃 + API 调用统计）
GET  /api/admin/schools            — 学校列表（支持 region 筛选 + 分页，带统计）
POST /api/admin/schools            — 创建学校
PUT  /api/admin/schools/:id        — 更新学校
DELETE /api/admin/schools/:id      — 软删除（isActive=false）
GET  /api/admin/schools/:id/stats  — 单校统计详情
```

**中间件模式**: `authMiddleware` → `requireRole(UserRole.SUPER_ADMIN)` → handler
**日志规范**: `[API /admin/xxx]` 前缀，入口+出口双 log + duration 计时

### T4: API 路由 — API 配置 + 日志 + 公告 + 题库

**路由清单**:

```
# API 配置管理（apiConfigs 表）
GET    /api/admin/apis             — 列表（apiKey 掩码返回 ****xxxx）
POST   /api/admin/apis             — 创建（apiKey AES-256-GCM 加密存储）
PUT    /api/admin/apis/:id         — 更新
DELETE /api/admin/apis/:id         — 删除

# API 调用日志（apiCallLogs 表）
GET    /api/admin/apis/logs        — 日志列表（支持 provider/status 筛选 + 分页）

# 公告管理（announcements 表）
GET    /api/admin/announcements         — 列表
POST   /api/admin/announcements         — 创建
PUT    /api/admin/announcements/:id     — 更新
DELETE /api/admin/announcements/:id     — 删除

# 题库管理（questionBank 表）
GET    /api/admin/question-bank    — 列表（支持 category/type 筛选）
POST   /api/admin/question-bank    — 创建
PUT    /api/admin/question-bank/:id — 更新
DELETE /api/admin/question-bank/:id — 删除
```

**API Key 加密**: 使用 Node `crypto` 模块 AES-256-GCM，密钥从 `ENCRYPTION_KEY` 环境变量读取。新增 `apps/web/src/lib/crypto.ts` 工具文件（`encrypt` / `decrypt` / `maskKey` 三个函数）。返回前端时仅返回掩码 `****${last4}`，不返回原文。

### T5: Fetcher — admin 方法组

**修改文件**: `apps/web/src/lib/api/fetcher.ts`

在 `fetcher` 对象末尾追加 `// Admin` 分节，方法清单:
- `getAdminDashboardStats()`
- `listAdminSchools(params?)` / `createAdminSchool(body)` / `updateAdminSchool(id, body)` / `deleteAdminSchool(id)` / `getAdminSchoolStats(id)`
- `listAdminApis()` / `createAdminApi(body)` / `updateAdminApi(id, body)` / `deleteAdminApi(id)`
- `listAdminApiLogs(params?)`
- `listAdminAnnouncements()` / `createAdminAnnouncement(body)` / `updateAdminAnnouncement(id, body)` / `deleteAdminAnnouncement(id)`
- `listAdminQuestionBank(params?)` / `createAdminQuestionBank(body)` / `updateAdminQuestionBank(id, body)` / `deleteAdminQuestionBank(id)`

### T6: Web 页面 — 仪表盘 + 学校管理 + API 管理

**页面文件**:

1. **`apps/web/src/app/admin/dashboard/page.tsx`**（改造现有）
   - 4 张统计卡片接真实数据（学校/教师/学生/今日作文）
   - 新增 API 调用统计区（今日调用数 + 成功率 + 平均耗时）
   - 新增最近学校列表

2. **`apps/web/src/app/admin/schools/page.tsx`**（新建）
   - 学校列表表格（名称/区域/联系人/状态/统计）
   - 区域筛选 select + 搜索 input（debounce 300ms）
   - 内联新建表单（参考 teacher tasks 页模式）
   - 编辑用手写 Modal（参考 teacher students 页 ImportModal 模式）
   - 删除确认按钮

3. **`apps/web/src/app/admin/apis/page.tsx`**（新建）
   - API 配置列表（provider/model/priority/状态/掩码 key）
   - 新建/编辑 Modal（provider select / apiKey input / baseUrl / model / priority / isActive）
   - Tab 切换"配置"/"调用日志"
   - 日志列表表格（时间/provider/model/tokens/耗时/状态）

### T7: Web 页面 — 公告 + 题库

**页面文件**:

4. **`apps/web/src/app/admin/announcements/page.tsx`**（新建）
   - 公告列表（标题/目标角色/状态/创建时间）
   - 新建/编辑 Modal（title input / content textarea / targetRole select / isActive toggle）
   - 删除确认

5. **`apps/web/src/app/admin/question-bank/page.tsx`**（新建）
   - 题库列表（题目/类型/话题/难度/状态）
   - category + type + difficulty 三级筛选
   - 新建/编辑 Modal（title / requirements textarea / keyPoints / topicType select / topicCategory select / difficulty select / wordLimitMin/Max / referenceEssay textarea）
   - 删除确认

### T8: 导航更新 + 全量验证

**修改文件**: `apps/web/src/components/layout/dashboard-layout.tsx`
- 在 `navItems` 数组现有 3 项 admin 后追加:
  - `/admin/announcements`（公告管理，`Megaphone` 图标）
  - `/admin/question-bank`（题库管理，`BookOpen` 图标）

**验证**:
1. `pnpm -r typecheck` — 全量类型检查（注意：不用 `turbo run typecheck`，Windows 会崩溃）
2. `pnpm exec biome check .` — 全量 lint
3. `pnpm -r build` — 全量构建
4. 手动检查 admin 路由结构完整性

## 设计决策

1. **评分配置**: 本期仅提供 `GET /api/admin/scoring-config`（只读返回常量），不做动态化（需重构 AI 引擎，留作未来增强）
2. **用户管理**: 本期不单独做用户管理页，学校详情页内展示该校教师/学生列表即可
3. **API Key 加密**: AES-256-GCM，密钥从 `ENCRYPTION_KEY` 环境变量读取，前端始终看到掩码
4. **分页**: admin 列表统一返回 `{ success, data: [...], total: number }`（比 teacher/student 路由多了 total 字段，因为 admin 需要页码）
5. **页面模式**: 沿用 `'use client'` + `useEffect` + `useState` + `fetcher` 模式，手写表格/Modal/表单（不引入新 UI 库）
6. **日志前缀**: 页面用 `[AdminXxx]`，API 用 `[API /admin/xxx]`

## 关键文件清单

| 用途 | 路径 |
|------|------|
| API 路由 | `apps/web/src/lib/api/routes.ts`（追加 admin 路由段） |
| Fetcher | `apps/web/src/lib/api/fetcher.ts`（追加 admin 方法组） |
| 加密工具 | `apps/web/src/lib/crypto.ts`（新建） |
| Dashboard 页 | `apps/web/src/app/admin/dashboard/page.tsx`（改造） |
| 学校管理页 | `apps/web/src/app/admin/schools/page.tsx`（新建） |
| API 管理页 | `apps/web/src/app/admin/apis/page.tsx`（新建） |
| 公告管理页 | `apps/web/src/app/admin/announcements/page.tsx`（新建） |
| 题库管理页 | `apps/web/src/app/admin/question-bank/page.tsx`（新建） |
| 导航 | `apps/web/src/components/layout/dashboard-layout.tsx`（追加 2 项） |
| Schema | `packages/db/src/schema/announcements.ts`（新建） |
| Shared 类型 | `packages/shared/src/types/admin.ts`（新建） |

## 参考模板

- **CRUD 路由**: `routes.ts` 行 1438-1638（teaching resources 完整 CRUD）
- **列表+搜索+Modal 页面**: `apps/web/src/app/teacher/students/page.tsx`
- **内联表单 CRUD 页面**: `apps/web/src/app/teacher/tasks/page.tsx`
- **图表+统计页面**: `apps/web/src/app/teacher/analytics/page.tsx`
- **中间件**: `apps/web/src/lib/api/middleware.ts`（`requireRole` 单参数模式）
- **DB 查询**: `db.query.xxx.findMany/findFirst` + `db.insert/update/delete`

## 验证方案

1. `pnpm -r typecheck` — 8 个 workspace 全绿
2. `pnpm exec biome check .` — 无 lint 错误
3. `pnpm -r build` — 全量构建成功（web build 含 22+ 页面）
4. admin 路由结构完整：dashboard / schools / apis / announcements / question-bank 5 个页面
5. DB migration 文件已生成（0004_xxx.sql）
6. API 路由约 20 条新增 admin 端点均可达
