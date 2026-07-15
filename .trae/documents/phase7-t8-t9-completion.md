# Phase 7 - T8/T9 完成计划

## 概要

继续 Phase 7 测试与优化阶段。T7 已通过验证（biome check 0 错误，87 个测试通过）。T8 基础设施已就绪（`fetcher-types.ts`、`server.ts`、`middleware.ts`、`dashboard-layout.tsx` 已改造）。`admin/dashboard` 已转换为 Server Component。

本计划完成 T8 剩余工作（4 个简单页面 + 3 个复杂页面拆分）和 T9 全量验证。

## 当前状态分析

### 已完成
- **T7 验证**: biome check 0 错误，87 个测试通过（8 roles + 9 word-count + 26 scoring + 15 AI assistant + 14 AI router + 15 API integration）
- **T8 基础设施**:
  - [fetcher-types.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/api/fetcher-types.ts) — 提取共享类型，避免循环依赖
  - [server.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/api/server.ts) — 服务端 fetcher（HTTP fetch + cookie 转发），10 个方法
  - [middleware.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/middleware.ts) — 仅检查 cookie 存在性，DB 校验由 `validateRequest()` 与 API `authMiddleware` 兜底
  - [dashboard-layout.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/layout/dashboard-layout.tsx) — 接受 `user` prop + `useEffect` 同步 Zustand store
- **admin/dashboard**: 已转为 async Server Component（[page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/admin/dashboard/page.tsx)）

### 待完成
- **4 个简单页面**（直接转 Server Component）:
  - `teacher/dashboard/page.tsx` — 1 个 fetch（getTeacherDashboard）
  - `student/dashboard/page.tsx` — 3 个并行 fetch（Promise.all: getStudentDashboard + listTasks + listMyEssays）
  - `student/progress/page.tsx` — 1 个 fetch（getStudentProgress）
  - `student/essays/page.tsx` — 1 个 fetch（listMyEssays）
- **3 个复杂页面**（Server + Client 拆分）:
  - `admin/schools` — 含创建/编辑模态框、删除确认、区域筛选
  - `teacher/students` — 含搜索防抖、班级筛选、TagEditor、ImportModal
  - `teacher/analytics` — 含班级选择器、导出按钮、analytics 重载

## 实施方案

### 决策点

1. **复杂页面交互后数据刷新策略**: 初始数据由 Server Component 获取（SEO + 首屏快），后续交互（筛选、CRUD、切换班级）在 Client Component 内通过 `fetcher` 客户端调用 API 重新拉取。避免 `router.push` 改 URL，保持现有 UX。

2. **Server Component 类型传递**: `validateRequest()` 返回 Lucia user（含 `studentNo`/`avatarUrl`/`isActive` 等额外字段），`DashboardLayout` 期望简化的 `AuthUser`。沿用 `admin/dashboard` 的 `user as AuthUser` 显式转换模式。

3. **错误处理**: 服务端数据获取失败时，在页面内联渲染错误卡片（不 throw 到 `error.tsx`），与 `admin/dashboard` 一致。

4. **客户端组件命名**: `xxx-client.tsx`（如 `schools-client.tsx`），与 `page.tsx` 同目录。

### 任务 1: 转换 4 个简单页面为 Server Component

每个页面遵循与 `admin/dashboard` 相同的模式：

```tsx
// 模板
import { validateRequest } from '@/lib/auth';
import { type AuthUser, getDashboardPath } from '@/lib/auth-store';
import { serverFetcher } from '@/lib/api/server';
import { redirect } from 'next/navigation';
import { UserRole } from '@betterwrite/shared';

export default async function XxxPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  if (user.role !== UserRole.XXX) redirect(getDashboardPath(user.role));

  let data = null;
  let error = null;
  try {
    const res = await serverFetcher.xxx();
    if (res.success && res.data) data = res.data;
    else error = res.error ?? '加载失败';
  } catch (err) {
    error = err instanceof Error ? err.message : '加载失败';
  }

  return (
    <DashboardLayout user={user as AuthUser}>
      {/* 渲染逻辑，data/error 都可能为 null */}
    </DashboardLayout>
  );
}
```

#### 1.1 [teacher/dashboard/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/teacher/dashboard/page.tsx)
- 删除: `'use client'`、`useState`/`useEffect`、`RoleGuard`、`fetcher`、本地 `TeacherDashboardData` 接口
- 用 `serverFetcher.getTeacherDashboard()` 拿 `TeacherDashboardData`（从 `server.ts` 导入类型）
- 角色: `UserRole.TEACHER`
- `stats` 数组直接从 `data.stats` 构建（无 loading 占位）

#### 1.2 [student/dashboard/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/student/dashboard/page.tsx)
- 删除: `'use client'`、`useState`/`useEffect`/`useMemo`、`RoleGuard`、`fetcher`
- 用 `Promise.all([serverFetcher.getStudentDashboard(), serverFetcher.listTasks(), serverFetcher.listMyEssays()])` 并行获取
- 注意: `Promise.all` 任一失败会导致整体 reject；改用 `Promise.allSettled` 分别处理，与现有客户端逻辑一致
- `scoreDistData` 用 `calculateScoreDistribution` 直接计算（无需 `useMemo`，Server Component 每次请求重算即可）
- 角色: `UserRole.STUDENT`

#### 1.3 [student/progress/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/student/progress/page.tsx)
- 删除: `'use client'`、`useState`/`useEffect`、`RoleGuard`、`fetcher`、调试 `console.log`
- 用 `serverFetcher.getStudentProgress()` 拿 `StudentProgress`
- 角色: `UserRole.STUDENT`
- `progress === null` 或 `totalEssays === 0` 时显示空态

#### 1.4 [student/essays/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/student/essays/page.tsx)
- 删除: `'use client'`、`useState`/`useEffect`、`RoleGuard`、`fetcher`
- 用 `serverFetcher.listMyEssays()` 拿 `Essay[]`
- 角色: `UserRole.STUDENT`

### 任务 2: 拆分 3 个复杂页面

每个复杂页面拆为 `page.tsx`（Server）+ `xxx-client.tsx`（Client）。

#### 2.1 admin/schools

**[page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/admin/schools/page.tsx)** (Server):
- `validateRequest()` + 角色 `SUPER_ADMIN`
- 读 `searchParams.region`（可选）作为初始筛选
- `serverFetcher.listAdminSchools(region ? { region } : undefined)` 获取初始列表
- 渲染 `<DashboardLayout user={user as AuthUser}><SchoolsClient initialSchools={schools} initialRegion={region} /></DashboardLayout>`

**`schools-client.tsx`** (Client, 新建):
- `'use client'`
- Props: `{ initialSchools: SchoolWithStats[]; initialRegion: string }`
- 保留全部交互: `regionFilter` 状态、`modalOpen`/`editingId`/`form`/`saving`、`handleSave`/`handleDelete`
- 区域筛选变化时用 `fetcher.listAdminSchools({ region })` 客户端重载
- CRUD 后用 `fetcher.listAdminSchools()` 重载

#### 2.2 teacher/students

**[page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/teacher/students/page.tsx)** (Server):
- `validateRequest()` + 角色 `TEACHER`
- `Promise.allSettled([serverFetcher.listTeacherClasses(), serverFetcher.listStudents()])` 并行获取 classes + 初始 students（无筛选）
- 渲染 `<DashboardLayout user={user as AuthUser}><StudentsClient initialClasses={classes} initialStudents={students} /></DashboardLayout>`

**`students-client.tsx`** (Client, 新建):
- `'use client'`
- Props: `{ initialClasses: TeacherClass[]; initialStudents: StudentListItem[] }`
- 保留全部交互: `classId`/`keyword` 状态 + 防抖、`TagEditor`、`ImportModal`、`showImportModal`
- 筛选变化时用 `fetcher.listStudents(params)` 客户端重载
- 标签更新/导入完成后客户端重载

#### 2.3 teacher/analytics

**[page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/teacher/analytics/page.tsx)** (Server):
- `validateRequest()` + 角色 `TEACHER`
- `serverFetcher.listTeacherClasses()` 获取 classes
- 若 classes 非空，再 `serverFetcher.getClassAnalytics(classes[0].id)` 获取首个班级 analytics
- 渲染 `<DashboardLayout user={user as AuthUser}><AnalyticsClient initialClasses={classes} initialAnalytics={analytics} initialClassId={classes[0]?.id ?? ''} /></DashboardLayout>`

**`analytics-client.tsx`** (Client, 新建):
- `'use client'`
- Props: `{ initialClasses: TeacherClass[]; initialAnalytics: ClassAnalytics | null; initialClassId: string }`
- 保留全部交互: `selectedClassId` 状态、`handleExport`、`loadAnalytics`（切换班级时用 `fetcher.getClassAnalytics`）
- `useMemo` 计算各类图表数据

### 任务 3: Biome 格式化

对所有新建/修改的文件运行:
```
pnpm exec biome check --write apps/web/src/app/teacher/dashboard apps/web/src/app/student/dashboard apps/web/src/app/student/progress apps/web/src/app/student/essays apps/web/src/app/admin/schools apps/web/src/app/teacher/students apps/web/src/app/teacher/analytics
pnpm exec biome format --write apps/web/src/app/teacher/dashboard apps/web/src/app/student/dashboard apps/web/src/app/student/progress apps/web/src/app/student/essays apps/web/src/app/admin/schools apps/web/src/app/teacher/students apps/web/src/app/teacher/analytics
```

### 任务 4: T9 全量验证

按顺序执行:

1. **依赖同步**: `pnpm install --no-frozen-lockfile`
   - 原因: `apps/mobile/package.json` 变更但 lockfile 未更新（ERR_PNPM_OUTDATED_LOCKFILE）

2. **类型检查**: `pnpm -r typecheck`
   - 预期 8 个 workspace 全绿
   - 注意: 不用 `turbo run typecheck`（Windows 上会以 exit 3221225501 崩溃）

3. **Lint**: `pnpm exec biome check`
   - 预期 0 错误

4. **测试**: `pnpm test`
   - 预期 87 个测试通过

5. **构建**: `pnpm -r build`
   - 预期 8 个项目全部成功
   - 预期 web 静态生成 22+ 页面（含 5 个 admin 页面）

## 假设与决策

1. **不引入 E2E 测试**: 用户已确认 Phase 7 测试范围为「单元 + 集成测试」，无 Playwright。
2. **不重构 RoleGuard**: 已被 Server Component 的 `validateRequest() + redirect()` 取代，但其他未转换页面（如 `school/dashboard`）仍使用，保留组件。
3. **`getDashboardPath` 从 `auth-store.ts` 导入**: 该模块内部 import `zustand` 与 `fetcher`，在 Server Component 中加载无副作用（`create` 在 Node 可用，`fetcher` 模块加载无有害副作用）。
4. **客户端重载沿用 `fetcher`**: 复杂页面交互后的数据刷新走客户端 `fetcher`，与原有代码一致，避免引入 `router.refresh()` 学习成本。
5. **`searchParams` 仅用于 `admin/schools` 初始 region**: 其他复杂页面的筛选状态不入 URL，简化实现。

## 验证步骤

- [ ] 4 个简单页面均为 async Server Component，无 `'use client'`
- [ ] 3 个复杂页面拆分为 `page.tsx` (Server) + `xxx-client.tsx` (Client)
- [ ] 所有页面保留原有功能（导航、数据展示、交互）
- [ ] `pnpm -r typecheck` 全绿
- [ ] `pnpm exec biome check` 0 错误
- [ ] `pnpm test` 87 个测试通过
- [ ] `pnpm -r build` 全部成功
