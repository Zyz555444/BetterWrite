# Phase 7: 测试与优化实施计划

## Context

Phase 0-6 已完成全部功能开发（73 API 路由、31 Web 页面、25 移动端页面、19 DB 表）。但代码库存在三类问题：
1. **零测试覆盖** — 无任何测试框架、配置或用例，功能回归全靠手动验证
2. **DB/API 性能隐患** — 13+ 个缺失索引、无缓存、5 个 AI 路由无限流、多处串行 N+1 查询
3. **前端性能反模式** — 31 个页面全部 `'use client'` + `useEffect` 拉数据（客户端瀑布），recharts 静态导入，2 个死依赖

本计划覆盖 Phase 7 的"测试 + 优化"两部分（不含部署/文档），目标：建立测试基础设施 + 关键路径测试覆盖 + DB/API/前端性能优化。

## 任务总览

| 任务 | 内容 | 预计文件变更 |
|------|------|-------------|
| T1 | Vitest 基础设施搭建 | 6 新建 + 8 修改 |
| T2 | packages/shared 单元测试 | 3 新建 |
| T3 | packages/ai 单元测试 | 2 新建 |
| T4 | API 集成测试 | 1 新建 |
| T5 | DB 索引补齐 | 8 修改 + 1 迁移 |
| T6 | API 缓存 + 限流 + N+1 修复 | 3 修改 + 1 新建 |
| T7 | 前端安全速赢 | 5 修改 + 3 新建 |
| T8 | Server Component 重构 | 4 新建 + 18 修改 |
| T9 | 全量验证 | 0 |

---

## T1: Vitest 基础设施搭建

**安装依赖（根 devDependencies）**：
- `vitest` — 核心运行器
- `@vitest/coverage-v8` — 覆盖率

**配置文件**：
- 根 `vitest.config.ts` — workspace 模式，include 各 workspace 的测试
- 各 workspace 不单独建 config，统一用根 config + `projects` 配置

**根 `vitest.config.ts`**：
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    projects: [
      { test: { include: ['packages/shared/src/**/*.test.ts'] } },
      { test: { include: ['packages/ai/src/**/*.test.ts'] } },
      { test: { include: ['apps/web/src/**/*.test.ts'] } },
    ],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
});
```

**脚本更新**：
- 根 `package.json`：`"test": "vitest run"`、`"test:watch": "vitest"`、`"test:coverage": "vitest run --coverage"`
- `turbo.json`：`test` task 改为 `{ "dependsOn": ["^build"], "outputs": ["coverage/**"] }`

**验证**：`pnpm test` 能运行（即使 0 用例不报错）

---

## T2: packages/shared 单元测试

测试纯函数逻辑，无需 mock。

**新建文件**：
1. `packages/shared/src/utils/__tests__/word-count.test.ts`
   - `countWords` — 中文/英文/混合、空字符串、纯标点
   
2. `packages/shared/src/utils/__tests__/scoring.test.ts`
   - `calculateScoreTier` — 各分数段边界（89.5/90/79.5/80）
   - `calculateAbilityRadar` — 4 维度归一化
   - `calculateErrorStats` — 错误分组 + 百分比
   - `calculateScoreDistribution` — 分数段统计
   - `calculateProgressCurve` — 时间序列
   - `calculateClassRank` — 百分位计算

3. `packages/shared/src/constants/__tests__/roles.test.ts`
   - `hasRequiredRole` — 层级比较（student 能访问 student 但不能 teacher；super_admin 全通过）
   - `RoleHierarchy` — 值正确性

**验证**：`pnpm test` 全部通过，覆盖率 > 80%

---

## T3: packages/ai 单元测试

测试 AI 路由和助手逻辑，mock 外部 API 调用。

**新建文件**：
1. `packages/ai/src/__tests__/router.test.ts`
   - `AIProviderRouter.executeWithFallback` — primary 成功直接返回、primary 失败切 secondary、全部失败抛错
   - Mock provider 的 `callAPI` 方法，不实际请求

2. `packages/ai/src/__tests__/assistant.test.ts`
   - `truncate` — 长文本截断到 200 词（head 100 + tail 50）、短文本不截断
   - `polishEssay` / `upgradeSentences` / `getSynonyms` / `checkGrammar` — mock fetch，验证 prompt 构建和响应解析

**验证**：`pnpm test` 全部通过

---

## T4: API 集成测试

测试 Hono API 路由，使用内存 SQLite + seed 数据。

**新建文件**：`apps/web/src/lib/api/__tests__/routes.test.ts`

**测试策略**：
- 用 Hono 的 `app.request()` 方法直接调用路由（无需启动 HTTP 服务器）
- 创建测试专用 DB 实例（内存 SQLite `:memory:`）
- Seed：1 个 super_admin + 1 个 teacher + 1 个 student + 1 个 school + 1 个 class + 1 个 essay task

**测试用例**（关键路径）：
1. `POST /api/auth/login` — 正确密码登录成功、错误密码返回 401
2. `POST /api/auth/register` — 注册新用户、重复邮箱 409
3. `GET /api/auth/me` — 带 session cookie 获取用户信息
4. `GET /api/health` — 健康检查
5. `GET /api/admin/dashboard/stats` — super_admin 可访问、student 返回 403
6. `GET /api/teacher/students` — teacher 可访问自己班级、其他班级 403
7. `POST /api/essays` — 学生提交作文
8. `GET /api/student/progress` — 学生获取成长报告

**验证**：`pnpm test` 全部通过

---

## T5: DB 索引补齐

**修改文件**（packages/db/src/schema/）：

| 文件 | 表 | 新增索引 |
|------|-----|---------|
| `enrollments.ts` | classEnrollments | `classId`, `userId` |
| `classes.ts` | classes | `schoolId`, `teacherId` |
| `essays.ts` | corrections | `essayId` |
| `users.ts` | users | `schoolId`, `role` |
| `api.ts` | apiCallLogs | `provider`, `status`（已有 createdAt） |
| `api.ts` | apiConfigs | `isActive`, `provider` |
| `announcements.ts` | announcements | `isActive`, `targetRole` |
| `question-bank.ts` | questionBank | `topicType` |

**索引定义模式**（Drizzle 语法）：
```ts
// 在表定义末尾加
index('idx_class_enrollments_class_id').on(table.classId),
index('idx_class_enrollments_user_id').on(table.userId),
```

**生成迁移**：`pnpm db:generate` 生成新迁移文件

**验证**：`pnpm --filter @betterwrite/db build` 成功，迁移文件生成

---

## T6: API 缓存 + 限流 + N+1 修复

**新建文件**：`apps/web/src/lib/api/cache.ts`
- 简单 TTL 内存缓存（`Map<string, { value: T, expires: number }>`）
- `cacheGet<T>(key: string): T | null`
- `cacheSet<T>(key: string, value: T, ttlMs: number): void`
- `withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>` — 缓存穿透时执行 fn 并缓存结果

**修改 `routes.ts`**：

1. **`/admin/dashboard/stats` 加 60s 缓存**：
   ```ts
   const stats = await withCache('admin:dashboard:stats', 60_000, async () => {
     // 原有 10 个 COUNT 查询
   });
   ```

2. **`getAiRouter()` 单例化**：
   - 在 `packages/ai/src/router.ts` 中加模块级缓存
   - `getAiRouter()` 首次调用读 DB 构造，后续调用直接返回缓存
   - 加 TTL（5 分钟）或手动失效（`invalidateAiRouter()`）

3. **补 AI 路由限流**（3 个路由）：
   - `POST /student/ai/upgrade` — 加 `rateLimit(10, 60_000)`
   - `POST /student/ai/synonym` — 加 `rateLimit(20, 60_000)`
   - `POST /student/practice/essay` — 加 `rateLimit(5, 60_000)`

4. **`/teacher/students/:id` 并行查询**：
   - 将 4 段串行 `await db.query...` 改为 `const [student, enrollments, tag, recentEssays] = await Promise.all([...])`

5. **请求级 access 缓存**：
   - `assertClassAccess` / `assertStudentAccess` 在 `c.set('access:class:' + classId, true)` 缓存结果，同一请求不重复查

**验证**：`pnpm -r typecheck` + `pnpm -r build` 通过

---

## T7: 前端安全速赢

**修改 `apps/web/package.json`**：
- 删除 `framer-motion`（0 处 import）
- 删除 `@tanstack/react-query`（0 处 import）

**修改 `apps/web/next.config.ts`**：
```ts
const nextConfig: NextConfig = {
  transpilePackages: [...],
  typedRoutes: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },
  async headers() { ... },
};
```

**修改 `apps/web/src/components/essay/correction-result.tsx`**：
- recharts 从静态 import 改为 `next/dynamic` 懒加载：
  ```ts
  const DynamicChart = dynamic(() => import('./correction-chart'), {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-neutral-2 rounded" />,
  });
  ```
  （将 recharts 图表部分抽到 `correction-chart.tsx` 子组件）

**新建 `loading.tsx` 骨架屏**（3 个路由段）：
- `apps/web/src/app/admin/loading.tsx`
- `apps/web/src/app/student/loading.tsx`
- `apps/web/src/app/teacher/loading.tsx`
- 内容：简单的 `<div className="animate-pulse">` 骨架

**验证**：`pnpm -r build` 通过，build 输出的页面数不变

---

## T8: Server Component 重构

### 基础设施（4 新建）

**1. `apps/web/src/middleware.ts`** — 服务端鉴权
- 读取 session cookie，匹配 `/api/auth/me` 获取用户
- 未登录 → 重定向 `/login?from=...`
- 角色不匹配 → 重定向到对应 dashboard
- matcher 排除 `/login`、`/register`、`/api`、`/_next`、静态资源
- 缓存用户信息在请求 header（`x-user-id`、`x-user-role`）供 Server Component 读取

**2. `apps/web/src/lib/server.ts`** — 服务端工具
- `getServerUser()` — 从请求 header 读用户信息（middleware 注入）
- `serverFetch(path, init)` — 服务端 fetch，自动转发 cookie

**3. 修改 `apps/web/src/components/layout/dashboard-layout.tsx`**
- 接受 `user` 作为 prop（替代 `useAuth()`）
- 保留 `'use client'`（需要 router、pathname、useState）
- logout 仍调用 `fetcher.logout()` + `router.push('/login')`

**4. 修改 `apps/web/src/components/layout/role-guard.tsx`**
- 简化为纯展示组件（middleware 已做鉴权）
- 或直接删除，Server Component 不再需要 RoleGuard 包裹

### 页面改造（分 3 批）

**第 1 批：纯展示页面（6 个，无交互，最简单）**

| 页面 | 改造方式 |
|------|---------|
| `admin/dashboard/page.tsx` | async + `serverFetch('/api/admin/dashboard/stats')` |
| `student/dashboard/page.tsx` | async + fetch dashboard data |
| `student/progress/page.tsx` | async + fetch progress |
| `teacher/dashboard/page.tsx` | async + fetch class overview |
| `teacher/analytics/page.tsx` | async + fetch analytics |
| `teacher/analytics/student/[id]/page.tsx` | async + fetch student analytics |

改造模式：
```tsx
// Before: 'use client' + useEffect + useState
// After:
import { serverFetch } from '@/lib/server';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { getServerUser } from '@/lib/server';

export default async function AdminDashboardPage() {
  const user = await getServerUser();
  const res = await serverFetch('/api/admin/dashboard/stats');
  const stats = res.success ? res.data : null;
  
  return (
    <DashboardLayout user={user}>
      {/* 原有 JSX，直接用 stats 渲染 */}
    </DashboardLayout>
  );
}
```

**第 2 批：列表+筛选页面（5 个，有筛选交互）**

| 页面 | 交互部分 |
|------|---------|
| `admin/schools/page.tsx` | 区域筛选 + CRUD modal |
| `admin/apis/page.tsx` | 日志筛选 + 配置 CRUD modal |
| `admin/announcements/page.tsx` | CRUD modal |
| `admin/question-bank/page.tsx` | 筛选 + CRUD modal |
| `teacher/students/page.tsx` | 无交互 |

改造模式：
- Server Component 获取初始列表数据
- 提取 `xxx-list-client.tsx` 客户端组件接收 `initialData` prop
- 客户端组件处理筛选、modal、CRUD（mutation 后 `router.refresh()` 刷新服务端数据）

**第 3 批：详情列表页面（4 个）**

| 页面 | 说明 |
|------|------|
| `student/essays/page.tsx` | 列表，改为 Server Component |
| `student/errors/page.tsx` | 类型列表 |
| `student/errors/[type]/page.tsx` | 详情列表 |
| `teacher/essays/page.tsx` | 批改中心列表 |

**不改的页面（保持 'use client'）**：
- `student/write/page.tsx` — 写作编辑器
- `student/tasks/[id]/write/page.tsx` — 写作编辑器
- `student/assistant/page.tsx` — AI 聊天
- `student/practice/[id]/page.tsx` — 练习作答
- `student/practice/mock/page.tsx` — 模拟练习
- `login/page.tsx`、`register/page.tsx` — 表单
- `school/dashboard/page.tsx` — 已是简单页面，可选

**验证**：
- `pnpm -r build` 通过，页面数不变
- 手动验证：登录 → 各 dashboard 页面直接出内容（无"加载中..."闪烁）
- 列表页 CRUD 功能正常（modal 仍可用）

---

## T9: 全量验证

```powershell
# 1. 类型检查
pnpm -r typecheck

# 2. Lint
pnpm exec biome check

# 3. 单元 + 集成测试
pnpm test

# 4. 构建
pnpm -r build
```

**验收标准**：
- [ ] typecheck 8 workspace 全绿
- [ ] biome check 0 errors
- [ ] vitest 全部通过（预期 30+ 用例）
- [ ] build 8 workspace 全绿（26 页面不变）
- [ ] DB 迁移文件生成
- [ ] 死依赖已删除
- [ ] Server Component 页面无"加载中..."闪烁

---

## 关键设计决策

1. **不引入 Redis** — 当前单实例部署，内存 Map 缓存足够；多实例部署时再迁移到 Redis
2. **不引入 TanStack Query** — Server Component 模式下不需要客户端数据缓存；交互组件的 mutation 用 `router.refresh()` 刷新
3. **middleware 鉴权** — 替代 RoleGuard 客户端瀑布，但保留 auth-store 的 `login`/`logout` 方法（login 页面需要）
4. **vitest workspace 模式** — 统一在根 config 管理，避免每个 workspace 重复配置
5. **API 集成测试用 Hono `app.request()`** — 不启动真实 HTTP 服务器，测试更快更稳定

## 执行顺序

T1 → T2 + T3（并行）→ T4 → T5 + T6（并行）→ T7 → T8 → T9
