# Phase 7 剩余任务（T4–T9）测试与优化

## 摘要

Phase 7 已完成 T1（Vitest 基础设施）、T2（shared 单元测试，43 用例）、T3（AI 单元测试，29 用例）。本计划覆盖剩余 6 个任务：API 集成测试、DB 索引补齐、API 性能优化（缓存/限流/N+1）、前端安全速赢、Server Component 重构、全量验证。

## 当前状态分析

**已完成**：
- [vitest.config.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/vitest.config.ts) 已配置 alias 解析与 coverage
- 5 个测试文件：`packages/shared/src/**/__tests__/*.test.ts`（3 个）+ `packages/ai/src/__tests__/*.test.ts`（2 个）
- `package.json` 已添加 `vitest@2.1.8`、`@vitest/coverage-v8@2.1.8`，scripts 改为 `vitest run`

**代码探索关键发现**：
- DB 模块 [packages/db/src/index.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/db/src/index.ts) 是单例，从 `process.env.DATABASE_URL` 初始化（默认 `file:local.db`）
- 5 个迁移 SQL 文件用 `--> statement-breakpoint` 分隔语句，可直接读取后按分隔符拆分执行
- [apps/web/src/lib/ai/router.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/ai/router.ts) 的 `getAiRouter()` **已经是单例**（T6 部分完成）
- [apps/web/src/lib/api/rate-limiter.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/api/rate-limiter.ts) 已实现内存限流，IP 取 `x-forwarded-for` 最右侧条目
- 4 个 AI 路由中：`/student/ai/polish`、`/student/ai/grammar` **已有** `rateLimit(5, 60_000)`；`/student/ai/upgrade`、`/student/ai/synonym` **缺失**
- `framer-motion`、`@tanstack/react-query` 在 `apps/web/package.json` 中声明但**全代码库无 import**（死依赖）
- 31 个 `'use client'` 页面；无 `loading.tsx`、`error.tsx`、`middleware.ts`
- 11 个索引已存在；`classEnrollments`、`classes`、`corrections`、`users`、`announcements`、`questionBank`、`teaching_resources`、`student_tags`、`device_tokens`、`api_tokens` 等表无索引
- N+1 问题：[routes.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/api/routes.ts) 第 2797 行 `admin/schools` 对每个学校循环执行 3 个 count 查询；`admin/dashboard/stats` 第 2700-2729 行 9 个 count 串行执行
- 中间件 [middleware.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/api/middleware.ts) 的 `authMiddleware` 支持 Bearer token（`apiTokens` 表），不依赖 cookies——集成测试可用此路径绕过 Lucia/cookies

## 提议变更

### T4: API 集成测试

**目标**：用 Hono `app.request()` 测试 8 个关键路由，使用内存 SQLite + Bearer token 鉴权。

**新建文件**：
1. `apps/web/src/lib/api/__tests__/setup.ts` — 测试夹具
   - `beforeAll`：读取 `packages/db/migrations/0000_*.sql` 到 `0004_*.sql`，按 `--> statement-breakpoint` 拆分，逐条 `db.execute(sql)`
   - `beforeEach`：清理所有表数据（按依赖逆序 TRUNCATE 或 DELETE）
   - `seedFixtures()`：插入 1 super_admin + 1 teacher + 1 student + 1 school + 1 class + 1 essay_task + 1 essay；为每个用户生成 `apiTokens` 记录（直接 `db.insert`，token 用 `randomUUID()`）
   - `authHeaders(token)`：返回 `{ Authorization: \`Bearer ${token}\` }`
   - 关键：在 `vitest.config.ts` 的 `test.env` 中设置 `DATABASE_URL=:memory:`，确保 `db` 单例使用内存数据库

2. `apps/web/src/lib/api/__tests__/routes.test.ts` — 8 个测试用例：
   - `GET /api/health` 返回 200 + `{status:'ok'}`
   - `POST /api/auth/login` 正确密码返回 200 + userId；错误密码返回 401
   - `POST /api/auth/register` 创建学生用户返回 201（需 mock 邮件发送，或跳过通知）
   - `GET /api/auth/me` 带 Bearer token 返回当前用户信息
   - `GET /api/admin/dashboard/stats` super_admin token 返回 200 + stats；teacher token 返回 403
   - `GET /api/teacher/students` teacher token 返回 200 + 学生列表；student token 返回 403
   - `POST /api/essays` student token 提交作文返回 201（需先有 essay_task）
   - `GET /api/student/progress` student token 返回 200 + 进度数据

**修改文件**：
- [vitest.config.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/vitest.config.ts)：在 `test` 配置中添加 `env: { DATABASE_URL: ':memory:' }`，确保测试进程使用内存数据库
- `apps/web/src/lib/api/__tests__/setup.ts` 中需 mock `@/lib/auth` 的 `lucia`（避免 Next.js cookies 依赖），通过 `vi.mock('@/lib/auth', () => ({ lucia: { sessionCookieName: 'session', validateSession: vi.fn(), createSessionCookie: vi.fn(), createBlankSessionCookie: vi.fn(), invalidateSession: vi.fn() } }))`

**技术决策**：
- 不使用 `drizzle-orm/libsql/migrator`（CJS require 失败，ESM 路径复杂），直接读取 SQL 文件按分隔符拆分执行——更简单、零依赖
- 测试用 Bearer token 路径，避开 `cookies()` 的 Next.js 运行时依赖
- `process.env.DATABASE_URL` 在模块首次 import 时被读取，必须通过 vitest config 的 `env` 字段（在模块加载前注入）

### T5: DB 索引补齐

**目标**：为高频查询字段添加缺失索引，提升列表/过滤查询性能。

**修改文件**（8 个 schema 文件）：
- [packages/db/src/schema/classes.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/db/src/schema/classes.ts)：添加 `schoolIdx`（schoolId）、`teacherIdx`（teacherId）
- [packages/db/src/schema/corrections.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/db/src/schema/corrections.ts)：添加 `essayIdx`（essayId）、`taskIdx`（taskId）
- [packages/db/src/schema/users.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/db/src/schema/users.ts)：添加 `schoolIdx`（schoolId）、`roleIdx`（role）
- [packages/db/src/schema/api.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/db/src/schema/api.ts)：`apiConfigs` 添加 `schoolIdx`（schoolId）；`apiCallLogs` 已有 `createdIdx`，添加 `endpointIdx`（endpoint）、`statusIdx`（status）
- [packages/db/src/schema/announcements.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/db/src/schema/announcements.ts)：添加 `publishedIdx`（publishedAt）、`audienceIdx`（audience）
- [packages/db/src/schema/question-bank.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/db/src/schema/question-bank.ts)：添加 `subjectIdx`（subject）、`gradeIdx`（gradeLevel）
- [packages/db/src/schema/teaching_resources.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/db/src/schema/teaching_resources.ts)：添加 `creatorIdx`（creatorId）、`typeIdx`（type）
- [packages/db/src/schema/student_tags.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/packages/db/src/schema/student_tags.ts)：添加 `studentIdx`（studentId）、`tagIdx`（tag）

**额外**：classes 表的 `classEnrollments`（在 classes.ts 或单独文件）需添加 `classIdx`（classId）、`userIdx`（userId）、`roleIdx`（role）——这是 join 最频繁的表。

**验证**：
- 运行 `pnpm --filter @betterwrite/db db:generate` 生成新迁移文件 `0005_*.sql`
- 确认迁移文件包含所有 `CREATE INDEX` 语句
- 运行 `pnpm -r typecheck` 确保类型正确

### T6: API 性能优化（缓存 + 限流补齐 + N+1 修复）

**目标**：补齐缺失限流、修复 N+1 查询、添加 dashboard 缓存。

**新建文件**：
1. `apps/web/src/lib/api/cache.ts` — 简单内存缓存
   - `memoizeAsync<T>(key, ttlMs, fn)`：先查内存 Map，命中返回；未命中执行 fn 并缓存
   - 自动过期清理（`setInterval().unref()`，与 rate-limiter 同模式）
   - 单实例部署适用（项目用 SQLite，天然单实例）

**修改文件**：
- [apps/web/src/lib/api/routes.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/lib/api/routes.ts)：
  - 第 1977 行 `/student/ai/upgrade`：在 `requireRole` 后添加 `rateLimit(5, 60_000)`
  - 第 2033 行 `/student/ai/synonym`：在 `requireRole` 后添加 `rateLimit(5, 60_000)`
  - 第 706 行 `/teacher/dashboard`：用 `memoizeAsync(\`teacher_dash:${user.id}\`, 60_000, ...)` 包裹整个 handler 体
  - 第 2554 行 `/student/dashboard`：用 `memoizeAsync(\`student_dash:${user.id}\`, 60_000, ...)` 包裹
  - 第 2690 行 `/admin/dashboard/stats`：用 `memoizeAsync(\`admin_dash:${user.id}\`, 60_000, ...)` 包裹，并将 9 个串行 count 查询改为 `Promise.all([...])`
  - 第 2777 行 `/admin/schools`：将 `for (const s of rows)` 内的 3 个 count 查询改为批量查询——先 `inArray(schoolIds)` 一次查所有教师 count、学生 count、班级 count（`groupBy schoolId`），再在内存中 join

**技术决策**：
- 不引入 Redis（项目用 SQLite 单实例，内存缓存足够）
- 缓存仅用于 dashboard 这类统计聚合查询，TTL 60s；写操作不缓存
- N+1 修复用 `groupBy` + `inArray` 批量查询，避免循环内查询

### T7: 前端安全速赢

**目标**：移除死依赖、添加加载骨架、优化打包。

**修改文件**：
1. [apps/web/package.json](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/package.json)：移除 `framer-motion`、`@tanstack/react-query`（确认无 import 后）
2. [apps/web/next.config.ts](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/next.config.ts)：
   - 添加 `experimental: { optimizePackageImports: ['lucide-react', 'recharts'] }`（减少 barrel import 体积）
   - 添加 `images: { formats: ['image/avif', 'image/webp'] }`
3. 新建 `apps/web/src/app/(dashboard)/loading.tsx` 或各路由组下 `loading.tsx`：
   - `apps/web/src/app/student/loading.tsx`、`apps/web/src/app/teacher/loading.tsx`、`apps/web/src/app/admin/loading.tsx`
   - 内容：简单的 Card 骨架屏（3 个脉冲方块），复用现有 `Card` 组件 + Tailwind `animate-pulse`
4. 新建 `apps/web/src/app/error.tsx`（根级错误边界）：
   - 客户端组件，捕获未处理错误，显示错误信息 + 重试按钮

**验证**：`pnpm --filter @betterwrite/web build` 成功，打包体积对比（recharts 按需加载）

### T8: Server Component 重构（精选 8 个页面）

**目标**：将简单的"fetch + render"页面转为 async Server Component，减少客户端 JS。

**范围**：从 31 个 `'use client'` 页面中精选 **8 个**无复杂交互的页面（避免改动有表单/拖拽/实时状态的页面）：
1. `apps/web/src/app/admin/dashboard/page.tsx` — 仅展示统计卡片
2. `apps/web/src/app/admin/schools/page.tsx` — 仅列表展示（CRUD 操作保留客户端子组件）
3. `apps/web/src/app/teacher/dashboard/page.tsx` — 仅展示统计
4. `apps/web/src/app/teacher/students/page.tsx` — 仅列表
5. `apps/web/src/app/teacher/analytics/page.tsx` — 仅展示图表
6. `apps/web/src/app/student/dashboard/page.tsx` — 仅展示统计
7. `apps/web/src/app/student/progress/page.tsx` — 仅展示进度图表
8. `apps/web/src/app/student/essays/page.tsx` — 仅列表

**新建文件**：
1. `apps/web/middleware.ts` — Next.js 中间件
   - 匹配 `/admin/*`、`/teacher/*`、`/student/*`、`/school/*`
   - 读取 session cookie，未登录重定向 `/login`
   - 不做角色判断（角色判断仍由 `RoleGuard` 或 `requireRole` 处理，避免中间件重复查询 DB）
2. `apps/web/src/lib/api/server.ts` — 服务端 fetcher
   - 与 `fetcher.ts` 同构 API，但使用 `process.env.API_URL ?? 'http://localhost:3000'`（非 `NEXT_PUBLIC`）+ 转发客户端 cookie（`next/headers` 的 `cookies()`）
   - 仅服务端使用，避免客户端 bundle 包含

**修改文件**：
- [apps/web/src/components/layout/dashboard-layout.tsx](file:///c:/Users/xy122/Documents/trae_projects/BetterWrite/apps/web/src/components/layout/dashboard-layout.tsx)：保持 `'use client'`，但新增 `user` prop（可选）；若传入则不调用 `useAuth()`
- 精选的 8 个页面：
  - 移除 `'use client'`，改为 `async function Page()`
  - 用 `await serverFetcher.xxx()` 替代 `useEffect + fetcher`
  - 用 `await cookies()` 获取用户信息传入 `DashboardLayout`
  - 删除 `useState`/`useEffect`/`useMemo`
  - 保留 `RoleGuard` 作为客户端组件包裹（或用服务端角色判断替代）

**技术决策**：
- 不全部转换 31 个页面——只转最简单的 8 个，避免引入复杂回归
- 有表单的页面（tasks/[id]/write、errors/[type]、assistant、register、login）保持 `'use client'`
- `DashboardLayout` 保持客户端组件（用 `usePathname` 高亮导航），但接受 `user` prop 避免重复请求
- 中间件仅做登录检查，角色判断仍由 API 层 `requireRole` 强制（纵深防御）

### T9: 全量验证

**验证步骤**（按顺序）：
1. `pnpm -r typecheck` — 8 个 workspace 全绿
2. `pnpm -r lint` — biome check 0 错误
3. `pnpm test` — 所有测试通过（T2: 43 + T3: 29 + T4: 8 = 80 用例）
4. `pnpm -r build` — web 26+ 页面静态生成成功，mobile 构建成功，worker 构建
5. 手动确认：新迁移文件 `0005_*.sql` 生成；`middleware.ts` 生效；至少 1 个 Server Component 页面 HTML 中无 `'use client'` 标记

## 假设与决策

1. **测试数据库**：用 `:memory:` SQLite，通过 vitest `env` 注入 `DATABASE_URL`，避免文件 IO。迁移用读取 SQL 文件 + `db.execute()` 方式，不依赖 `drizzle-orm/libsql/migrator`（CJS 兼容性问题）。
2. **缓存策略**：内存 Map + TTL，单实例部署适用。若未来容器化需替换为 Redis——在 `cache.ts` 头部注释说明。
3. **Server Component 转换范围**：精选 8 个无交互页面，不做全量 31 个——控制回归风险。
4. **中间件不做角色判断**：避免每次请求查 DB；角色控制由 API 层 `requireRole` 强制，前端 `RoleGuard` 仅做 UX 优化。
5. **死依赖移除**：`framer-motion`、`@tanstack/react-query` 在代码库中无 import，确认可安全移除。
6. **N+1 修复方式**：用 `groupBy` + `inArray` 批量查询，不引入 DataLoader（过度工程化）。
7. **遵循现有日志规范**：所有新增 API 代码使用 `[API /xxx]` 前缀日志，与 [project_memory](file:///c:/Users/xy122/.trae-cn/memory/projects/-c-Users-xy122-Documents-trae-projects-BetterWrite/project_memory.md) 中约定一致。

## 验证步骤

| 步骤 | 命令 | 预期 |
|------|------|------|
| 1 | `pnpm -r typecheck` | 8 workspace 全绿 |
| 2 | `pnpm -r lint` | biome check 0 错误 |
| 3 | `pnpm test` | 80 用例全过 |
| 4 | `pnpm test:coverage` | shared/ai 覆盖率报告生成 |
| 5 | `pnpm --filter @betterwrite/db db:generate` | 生成 `0005_*.sql` 迁移 |
| 6 | `pnpm -r build` | web 26+ 页面 + mobile + worker 全成功 |
| 7 | 检查 `middleware.ts` | 访问 `/student/dashboard` 未登录时重定向 `/login` |
| 8 | 检查 Server Component | 至少 1 个页面 HTML 源码无 `'use client'` |
