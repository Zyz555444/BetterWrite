# Phase 7 收尾（T7 验证 + T8 Server Component 重构 + T9 全量验证）

## 摘要

Phase 7 前序任务（T1–T6）已完成：Vitest 基础设施、shared/ai 单元测试（72 用例）、API 集成测试（15 用例）、DB 索引补齐（19 索引 + 迁移 0005）、API 性能优化（缓存/限流/N+1 修复）。T7 前端安全速赢的文件已创建但未最终验证。本计划覆盖 T7 验证、T8 Server Component 重构（8 页全量）、T9 全量验证。

## 当前状态分析

### T7 已完成（待验证）
- [apps/web/package.json](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/package.json) 已移除 `framer-motion`、`@tanstack/react-query`（死依赖）
- [apps/web/next.config.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/next.config.ts) 已添加 `experimental.optimizePackageImports` + `images.formats`
- 3 个 loading.tsx 骨架屏已创建：[student/loading.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/student/loading.tsx)、[teacher/loading.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/teacher/loading.tsx)、[admin/loading.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/admin/loading.tsx)
- [apps/web/src/app/error.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/error.tsx) 根级错误边界已创建
- **待做**：运行 `biome check` 确认 0 错误 + `pnpm test` 确认测试通过

### T8 关键发现（基于代码探索）

**认证体系**：
- [lib/auth.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/auth.ts) 的 `validateRequest()` 已用 React `cache()` 包裹，读取 `next/headers` 的 `cookies()`，可在 Server Component 中直接调用
- [middleware.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/api/middleware.ts) 的 `authMiddleware` 支持 Bearer token（移动端）和 cookie（Web），cookie 路径调用 `cookies()` from `next/headers`
- `RoleGuard`（客户端）调用 `useAuth.fetchMe()` → `fetcher.me()` 做鉴权，Server Component 可用 `validateRequest()` 替代

**页面复杂度分类**（8 个目标页面）：

| 页面 | 复杂度 | 交互 | 转换策略 |
|------|--------|------|----------|
| admin/dashboard | 简单 | 无 | 全量 Server Component |
| teacher/dashboard | 简单 | 无 | 全量 Server Component |
| student/dashboard | 简单 | 无（仅 Link） | 全量 Server Component |
| student/progress | 简单 | 无 | 全量 Server Component |
| student/essays | 简单 | 无（仅 Link） | 全量 Server Component |
| admin/schools | 复杂 | 表单弹窗、区域筛选、删除确认 | Server + Client 拆分 |
| teacher/students | 复杂 | 搜索、班级筛选、标签编辑、批量导入弹窗 | Server + Client 拆分 |
| teacher/analytics | 复杂 | 班级选择器、导出按钮 | Server + Client 拆分 |

**DashboardLayout**：
- [dashboard-layout.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/layout/dashboard-layout.tsx) 是 `'use client'`，用 `useAuth()` 获取 user + logout
- 需新增可选 `user` prop：传入时跳过 `useAuth()` 读取，但仍用 `useAuth().logout` 做退出
- 需同步 store：若传入 `user` prop 且 store 为空，调用 `setUser(user)` 同步，避免后续客户端页面闪烁

**fetcher vs server fetcher**：
- [fetcher.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/api/fetcher.ts) 用 `process.env.NEXT_PUBLIC_API_URL` + `credentials: 'include'`（浏览器 cookie 自动携带）
- Server Component 中 `fetch` 不会自动携带浏览器 cookie，需手动从 `next/headers` 的 `cookies()` 读取并转发为 `Cookie` header

## 提议变更

### T7 验证（仅运行检查，不修改文件）

1. 运行 `pnpm exec biome check` 确认 6 个 T7 文件 0 错误
2. 运行 `pnpm test` 确认 87 个测试用例全过
3. 标记 T7 完成

### T8: Server Component 重构（8 页全量）

#### 新建文件

**1. `apps/web/middleware.ts`** — Next.js 中间件（登录检查）

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/admin', '/teacher', '/student', '/school'];
const SESSION_COOKIE = 'auth_session'; // lucia.sessionCookieName

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE);
  if (!session) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/student/:path*', '/school/:path*'],
};
```

- **只检查 cookie 存在性**，不查 DB 验证 session（避免每次请求查库）
- Session 有效性由 API 层 `authMiddleware` 和 Server Component 的 `validateRequest()` 强制
- `lucia.sessionCookieName` 硬编码为 `'auth_session'`（与 [lib/auth.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/auth.ts) 中 Lucia 配置一致）

**2. `apps/web/src/lib/api/server.ts`** — 服务端 fetcher

```ts
import { cookies } from 'next/headers';
import type { ApiResponse, AuthUserResponse, Essay, EssayTask, ... } from './fetcher-types';

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function serverRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const serverFetcher = {
  getAdminDashboardStats: () => serverRequest<ApiResponse<AdminDashboardStats>>('/api/admin/dashboard/stats'),
  listAdminSchools: (params?) => { /* same as fetcher */ },
  getTeacherDashboard: () => serverRequest<...>('/api/teacher/dashboard'),
  listTeacherClasses: () => serverRequest<...>('/api/teacher/classes'),
  listStudents: (params?) => { /* same as fetcher */ },
  getClassAnalytics: (classId) => serverRequest<...>(`/api/teacher/analytics/class/${classId}`),
  getStudentDashboard: () => serverRequest<...>('/api/student/dashboard'),
  listTasks: () => serverRequest<...>('/api/tasks'),
  listMyEssays: () => serverRequest<...>('/api/essays/my'),
  getStudentProgress: () => serverRequest<...>('/api/student/progress'),
};
```

- **仅实现 8 个页面需要的方法**（约 10 个），不复制全部 fetcher API
- 类型从 `fetcher.ts` 导出（需提取类型到 `fetcher-types.ts`，或直接 import `fetcher.ts` 的 type）
- `API_URL` 环境变量非 `NEXT_PUBLIC`，仅在服务端可见，避免泄露到客户端 bundle
- **决策**：用 HTTP fetch + cookie 转发（不用 Hono `app.request()` 直调），因为：
  - 复用 API 层全部逻辑（缓存、限流、业务逻辑、日志）
  - 避免 async context 传递的不确定性
  - 开发/生产行为一致

**3. `apps/web/src/lib/api/fetcher-types.ts`** — 提取共享类型

将 `fetcher.ts` 中的 interface/type（`Essay`、`EssayTask`、`Correction`、`StudentListItem`、`StudentDetail`、`ImportResult`、`TeachingResourceWithCreator`、`ApiResponse`、`AuthUserResponse` 等）提取到此文件，供 `fetcher.ts` 和 `server.ts` 共同 import，避免循环依赖。

**4. 3 个客户端子组件文件**（复杂页面拆分）：

- `apps/web/src/app/admin/schools/schools-client.tsx`
- `apps/web/src/app/teacher/students/students-client.tsx`
- `apps/web/src/app/teacher/analytics/analytics-client.tsx`

每个文件 `'use client'`，接收 `initialData` prop，保留原有全部交互逻辑，仅将初始数据来源从 `useEffect + fetcher` 改为 `useState(initialData)`。

#### 修改文件

**5. `apps/web/src/components/layout/dashboard-layout.tsx`** — 接受 `user` prop

```tsx
interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: AuthUser; // 新增：Server Component 传入
}

export function DashboardLayout({ children, user: userProp }: DashboardLayoutProps) {
  const { user: storeUser, logout, setUser } = useAuth();
  const user = userProp ?? storeUser;

  // 同步 store：Server Component 传入 user 时更新 store
  useEffect(() => {
    if (userProp && !storeUser) setUser(userProp);
  }, [userProp, storeUser, setUser]);

  // ... 其余不变，`user` 用于显示，`logout` 仍走 useAuth
}
```

**6–10. 5 个简单页面全量转 Server Component**：

每个页面的转换模式：
- 移除 `'use client'`
- 改为 `export default async function Page()`
- 用 `validateRequest()` 做鉴权 + 角色检查，失败 `redirect()`
- 用 `serverFetcher.xxx()` 获取数据（`await`）
- 将 `user` 传入 `<DashboardLayout user={user}>`
- 移除 `RoleGuard`（Server Component 已做角色检查）
- 移除 `useState`/`useEffect`/`useMemo`
- 数据处理（如 `calculateScoreDistribution`）直接在 Server Component 中同步计算
- 错误处理用 `try/catch`，失败时渲染错误 UI（而非 client state）

转换文件列表：
- [apps/web/src/app/admin/dashboard/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/admin/dashboard/page.tsx)
- [apps/web/src/app/teacher/dashboard/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/teacher/dashboard/page.tsx)
- [apps/web/src/app/student/dashboard/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/student/dashboard/page.tsx)
- [apps/web/src/app/student/progress/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/student/progress/page.tsx)
- [apps/web/src/app/student/essays/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/student/essays/page.tsx)

**11–13. 3 个复杂页面拆分为 Server + Client**：

每个页面的拆分模式：
- `page.tsx`（Server Component）：鉴权 + 初始数据获取 + 渲染 `<XxxClient initialData={...} />`
- `xxx-client.tsx`（Client Component）：`'use client'`，接收 `initialData` prop，保留全部交互逻辑

转换文件列表：
- [apps/web/src/app/admin/schools/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/admin/schools/page.tsx) + 新建 `schools-client.tsx`
- [apps/web/src/app/teacher/students/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/teacher/students/page.tsx) + 新建 `students-client.tsx`
- [apps/web/src/app/teacher/analytics/page.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/app/teacher/analytics/page.tsx) + 新建 `analytics-client.tsx`

**复杂页面拆分细节**：

`admin/schools`：
- Server: `validateRequest()` + `serverFetcher.listAdminSchools()` → 传入 `initialSchools`
- Client: `useState(initialSchools)`，保留区域筛选、CRUD 弹窗、删除确认。筛选变更时用 `fetcher.listAdminSchools()` 客户端重新获取

`teacher/students`：
- Server: `validateRequest()` + `Promise.all([serverFetcher.listTeacherClasses(), serverFetcher.listStudents()])` → 传入 `initialClasses` + `initialStudents`
- Client: `useState(initialClasses)` + `useState(initialStudents)`，保留搜索、班级筛选、TagEditor、ImportModal

`teacher/analytics`：
- Server: `validateRequest()` + `serverFetcher.listTeacherClasses()` → 若有班级，再 `serverFetcher.getClassAnalytics(firstClassId)` → 传入 `initialClasses` + `initialAnalytics` + `initialClassId`
- Client: `useState(initialAnalytics)`，保留班级选择器、导出按钮。切换班级时用 `fetcher.getClassAnalytics()` 客户端重新获取

#### T8 技术决策

1. **服务端 fetcher 用 HTTP fetch + cookie 转发**：不用 Hono `app.request()` 直调（避免 async context 不确定性），复用 API 层全部逻辑
2. **类型提取到 `fetcher-types.ts`**：避免 `fetcher.ts`（含 `NEXT_PUBLIC` 环境变量）和 `server.ts`（含 `next/headers`）之间的副作用循环依赖
3. **中间件仅检查 cookie 存在性**：不查 DB，session 有效性由 `validateRequest()` 和 API `authMiddleware` 强制（纵深防御）
4. **DashboardLayout 保持客户端组件**：用 `usePathname` 高亮导航，接受 `user` prop 避免重复请求
5. **复杂页面初始数据走 Server，后续交互走 Client fetcher**：首次加载无 loading 闪烁，后续交互保持响应性
6. **Server Component 中不再需要 `RoleGuard`**：角色检查由 `validateRequest()` + `redirect()` 完成
7. **遵循日志规范**：Server Component 中用 `console.log('[XxxPage] ...')` 前缀，与现有 `[AdminDashboard]`、`[StudentDashboard]` 等约定一致

### T9: 全量验证

**验证步骤**（按顺序）：

| 步骤 | 命令 | 预期 |
|------|------|------|
| 1 | `pnpm install --no-frozen-lockfile` | 修复 lockfile（mobile package.json 变更导致） |
| 2 | `pnpm -r typecheck` | 8 workspace 全绿 |
| 3 | `pnpm exec biome check` | 0 错误（含新增文件格式化） |
| 4 | `pnpm test` | 87 用例全过 |
| 5 | `pnpm -r build` | web 26+ 页面静态生成成功，mobile + worker 构建成功 |
| 6 | 检查 `middleware.ts` | 未登录访问 `/student/dashboard` 重定向 `/login?from=/student/dashboard` |
| 7 | 检查 Server Component | `admin/dashboard/page.tsx` 源码无 `'use client'`，含 `async function` |
| 8 | 检查 DashboardLayout | 接受 `user` prop，传入时不调用 `useAuth()` 读取 user |

**回滚策略**：
- 若 T8 转换导致构建失败，优先修复类型错误
- 若 Server Component 数据获取失败，回退为客户端 `useEffect + fetcher`（保留 `middleware.ts` 和 `server.ts`）
- 若 `validateRequest()` 在 Server Component 中不工作，回退为 `serverFetcher.me()` 获取用户

## 假设与决策

1. **lockfile 修复**：背景任务显示 `ERR_PNPM_OUTDATED_LOCKFILE`（mobile package.json 变更），T9 第 1 步用 `--no-frozen-lockfile` 修复
2. **`lucia.sessionCookieName` 硬编码为 `'auth_session'`**：在 `middleware.ts` 中硬编码，避免引入 `lib/auth.ts`（会带入 DB 依赖）。Lucia 配置中 `sessionCookie.attributes` 未设 `name`，默认为 `auth_session`
3. **`API_URL` 环境变量**：Server fetcher 优先用 `process.env.API_URL`（非 `NEXT_PUBLIC`），回退到 `NEXT_PUBLIC_API_URL`，最后 `http://localhost:3000`。生产环境同进程调用走 localhost
4. **不提取全部 fetcher 类型**：仅提取 8 个页面需要的类型（Essay、EssayTask、AdminDashboardStats、SchoolWithStats、StudentListItem、ClassAnalytics、StudentProgress、DailyQuote 等），避免过度重构
5. **复杂页面初始数据获取用 `Promise.all`**：teacher/students 需要同时获取 classes + students，teacher/analytics 需要 classes + first class analytics
6. **`error.tsx` 已存在**：Server Component 中 `throw` 的未捕获错误会被根级 `error.tsx` 捕获，无需每页加 `try/catch`。但数据获取失败应用 `try/catch` 渲染错误 UI（而非抛出）
7. **`loading.tsx` 已存在**：Server Component 异步获取数据时，Next.js 自动展示同路由组的 `loading.tsx` 骨架屏

## 实施顺序

1. **T7 验证**（2 步）：biome check + pnpm test
2. **T8 基础设施**（4 个新文件）：
   - `fetcher-types.ts`（提取类型）
   - `middleware.ts`（登录检查）
   - `server.ts`（服务端 fetcher）
   - 修改 `dashboard-layout.tsx`（接受 `user` prop）
3. **T8 简单页面**（5 个）：逐个转换，每转换 1 个即 typecheck
4. **T8 复杂页面**（3 对）：逐对拆分，每拆分 1 对即 typecheck
5. **T8 全量 lint**：`biome check --write` 修复格式
6. **T9 全量验证**：按 8 步顺序执行
