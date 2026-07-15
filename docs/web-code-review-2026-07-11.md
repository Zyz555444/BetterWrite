# Web 端代码审查报告

- 项目：BetterWrite
- 审查范围：`apps/web`
- 审查日期：2026-07-11
- 审查方式：静态代码分析 + 双审员交叉验证

## 执行摘要

本次审查覆盖 `apps/web` 的 Next.js App Router 页面、Hono API 路由、权限中间件、状态管理、数据获取与加密缓存等模块。TypeScript typecheck 与 Biome lint 均通过，未暴露语法或类型错误；但发现 **19 项逻辑、权限、安全与可维护性问题**，其中 **严重/重要 15 项**。

### 主要风险

1. **数据越权泄露**：多处教师在“班级存在但无学生”时，查询条件回退为 `undefined`，导致返回系统全部作文数据。
2. **权限粒度不足**：教师查看/复核作文、创建任务等接口仅校验“同校”，未限定“任教班级”。
3. **关键功能失效**：成就解锁仅打印日志，未写入数据库。
4. **基础设施风险**：Redis 缓存失效使用 `KEYS` 命令；开发环境加密密钥每次随机生成。

---

## 严重问题

### 1. 教师获取作文列表：空班级时返回全部 essays

- **位置**：`apps/web/src/lib/api/routes.ts:748-766`
- **描述**：`GET /essays` 先从教师任教班级中收集学生 ID。当教师有班级但班级内无学生时，`studentIds.length === 0` 使得 `conditions = undefined`，最终 `where: undefined`，查询会返回系统中所有 essays。
- **影响**：教师 A 可查看本校乃至跨校（取决于是否已有其他过滤）全部学生作文。
- **修复建议**：
  ```ts
  if (studentIds.length === 0) {
    return c.json({ success: true, data: { essays: [], total: 0 } });
  }
  const conditions = studentIds.map((id) => eq(essays.studentId, id));
  ```

### 2. 班级分析接口：空学生时返回全部 essays

- **位置**：`apps/web/src/lib/api/routes.ts:1134-1136`
- **描述**：`GET /teacher/analytics/class/:classId` 使用 `where: studentIds.length > 0 ? inArray(essays.studentId, studentIds) : undefined`。
- **影响**：空班级下返回全量作文，班级统计数据失真并泄露其他学生数据。
- **修复建议**：`studentIds` 为空时直接返回零值统计，不查询 essays 表。

### 3. 班级分析导出接口：空学生时返回全部 essays

- **位置**：`apps/web/src/lib/api/routes.ts:1354-1356`
- **描述**：与问题 2 相同模式，导出接口在班级无学生时同样回退为无 where 条件。
- **影响**：导出的 CSV 包含系统全部作文。
- **修复建议**：导出前校验 `studentIds.length`，为空时返回仅含表头的空 CSV。

### 4. 教师仪表盘：空学生时返回全部 essays

- **位置**：`apps/web/src/lib/api/routes.ts:1054-1056`
- **描述**：`GET /teacher/dashboard` 的 `recentEssays` 查询在 `studentIds` 为空时 `where: undefined`。
- **影响**：教师仪表盘展示全量作文。
- **修复建议**：无学生时 `recentEssays = []`。

### 5. 创建作文任务未校验班级归属

- **位置**：`apps/web/src/lib/api/routes.ts:835-866`
- **描述**：`POST /tasks` 仅校验用户角色（TEACHER/SCHOOL_ADMIN/SUPER_ADMIN），未调用 `assertClassAccess(user, data.classId)`。
- **影响**：教师可为任意班级（含其他教师班级、其他学校班级）创建任务。
- **修复建议**：在插入前调用 `assertClassAccess(user, body.classId)`。

### 6. 学生提交作文未校验任务班级归属

- **位置**：`apps/web/src/lib/api/routes.ts:562-595`
- **描述**：`POST /essays` 仅校验 `taskId` 是否存在，未验证该任务是否属于当前学生所在班级。
- **影响**：学生可通过构造 taskId 向其他班级任务提交作文。
- **修复建议**：
  ```ts
  await assertClassAccess(user, task.classId);
  // 或显式校验学生 enrollment
  ```

### 7. 教师查看/复核作文仅校验同校，未校验任教班级

- **位置**：`apps/web/src/lib/api/routes.ts:608-737`
- **描述**：`GET /essays/:id`、`GET /essays/:id/correction`、`PUT /essays/:id/review` 对 TEACHER 仅校验 `essay.student?.schoolId === user.schoolId`。
- **影响**：同校任意教师可查看、复核本校其他班级学生作文。
- **修复建议**：统一使用 `assertStudentAccess(user, essay.studentId)` 或扩展校验逻辑。

---

## 重要问题

### 8. 成就解锁仅记录日志，未写入数据库

- **位置**：`apps/web/src/lib/api/routes.ts:2914-2920`
- **描述**：`/student/achievements` 计算出 `unlockedNotRecorded` 后仅执行 `routesLogger.info(...)`，没有 `db.insert(achievements).values(...)`。
- **影响**：成就系统永远不会真正解锁新成就。
- **修复建议**：在事务中插入未记录的成就记录。

### 9. Redis 缓存失效使用 KEYS 命令

- **位置**：`apps/web/src/lib/api/cache.ts:62-72`
- **描述**：`invalidateCache` 的 Lua 脚本使用 `redis.call('keys', pattern)`，该命令会扫描全库 key。
- **影响**：生产环境 key 较多时会阻塞 Redis 实例，导致全局延迟。
- **修复建议**：改用 `SCAN` 分批获取并删除 key。

### 10. 开发环境加密密钥每次随机生成

- **位置**：`apps/web/src/lib/crypto.ts:8-19`
- **描述**：非生产环境 `ENCRYPTION_KEY` 缺失时，`getKey()` 每次调用都返回 `randomBytes(32)` 的新随机密钥。
- **影响**：开发环境加密的 API 密钥、通知 token 等数据在每次调用/重启后无法解密，影响本地调试；也掩盖了生产环境密钥配置错误。
- **修复建议**：开发环境缓存一次生成的密钥（模块级变量），或在启动时根据固定派生值生成。

### 11. 限流 IP 解析取 X-Forwarded-For 最后一个 IP

- **位置**：`apps/web/src/lib/api/rate-limiter.ts:30-38`
- **描述**：`resolveClientIp` 对 `x-forwarded-for` 返回 `parts[parts.length - 1]`，这是离服务端最近的代理 IP，而非原始客户端 IP。
- **影响**：限流基于错误 IP，且攻击者可通过追加 XFF 头部伪造。
- **修复建议**：在可信代理配置下取第一个 IP，或默认使用直连 IP。

### 12. 教师复核页刷新会覆盖未保存的评语/分数

- **位置**：`apps/web/src/app/teacher/essays/[id]/page.tsx:44-51`
- **描述**：`useEffect` 在 `refreshKey` 变化时重新加载 essay 并直接用服务端值覆盖 `review` / `teacherScore` state。
- **影响**：教师正在输入复核内容时若触发刷新，未保存的编辑会丢失。
- **修复建议**：仅在用户未修改过（dirty 为 false）时才用服务端值覆盖；或保存前禁止自动刷新。

### 13. AI 助手接口未限制输入长度

- **位置**：`apps/web/src/lib/api/routes.ts:2303-2523`
- **描述**：AI 对话、润色、纠错、出题等接口的输入 schema 仅要求 `z.string().min(1)`，未设置 `max()`。
- **影响**：超大输入会导致高额 token 消耗、响应超时或队列阻塞。
- **修复建议**：根据业务场景增加 `max(2000)`、`max(10000)` 等合理上限。

---

## 中等问题

### 14. 注册页密码最小长度与服务端不一致

- **位置**：`apps/web/src/app/register/page.tsx:88-89`
- **描述**：前端输入框 `minLength={6}`，placeholder 提示“至少6位”，但服务端 `registerSchema` 要求 `min(8)`。
- **影响**：用户按前端提示输入 6-7 位密码后提交，服务端返回 400，体验差。
- **修复建议**：前端改为 `minLength={8}`，placeholder 改为“至少8位”。

### 15. 教师页面角色守卫与 API 允许角色不一致

- **位置**：
  - `apps/web/src/app/teacher/essays/page.tsx:101`
  - `apps/web/src/app/teacher/essays/[id]/page.tsx:127`
  - `apps/web/src/app/teacher/students/page.tsx:13`
  - `apps/web/src/app/teacher/analytics/page.tsx:13`
- **描述**：页面端仅允许 `UserRole.TEACHER`，但对应 API 同时允许 `SCHOOL_ADMIN` 与 `SUPER_ADMIN`。
- **影响**：学校管理员/超管无法通过 Web 访问这些页面，即便 API 已授权。
- **修复建议**：RoleGuard / 服务端重定向统一允许 `TEACHER | SCHOOL_ADMIN | SUPER_ADMIN`。

### 16. 导航栏包含不存在的路由，且子路由不高亮

- **位置**：`apps/web/src/components/layout/dashboard-layout.tsx:37-164`
- **描述**：`navItems` 包含 `/school/teachers`、`/school/classes`，但 `app/school/` 下仅存在 `/school/dashboard`；活跃判断使用 `pathname === item.href` 精确匹配。
- **影响**：点击无效导航会 404；进入 `/teacher/essays/123` 时父级导航不高亮。
- **修复建议**：删除无效路由或补充页面；高亮判断改用 `pathname.startsWith(item.href)`。

### 17. 多处服务端组件用 `user as AuthUser` 强制类型转换

- **位置**：共 8 处，如 `apps/web/src/app/student/dashboard/page.tsx:82`、`apps/web/src/app/student/essays/page.tsx` 等。
- **描述**：服务端 `validateRequest()` 返回的用户字段与客户端 `AuthUser` 不完全一致，代码使用 `as` 断言。
- **影响**：字段差异被掩盖，后续若服务端类型变化，运行时可能出错。
- **修复建议**：提供显式转换函数，或统一服务端/客户端用户类型。

### 18. 大量 `console.warn/error` 分布在生产代码中

- **位置**：`apps/web/src` 下共 50+ 处
- **描述**：服务端组件与客户端组件直接使用 `console.error/warn` 记录异常，未接入统一 logger。
- **影响**：生产环境难以聚合、检索与告警；可能泄露敏感信息到浏览器控制台。
- **修复建议**：服务端使用项目 logger，客户端错误接入 Sentry 等监控或统一错误边界。

### 19. 学生 CSV 导入未处理带引号的字段

- **位置**：`apps/web/src/lib/api/routes.ts:1667-1675`
- **描述**：CSV 解析使用 `line.split(',').map((s) => s.trim())`，无法处理姓名中包含逗号或被双引号包裹的字段。
- **影响**：导入数据错位或解析失败。
- **修复建议**：使用 `papaparse`/`csv-parse` 等专业 CSV 解析库。

---

## 修复优先级建议

### P0（立即修复）

- 问题 1-4：空班级/空学生导致返回全量作文，属于数据泄露。
- 问题 5-7：权限边界缺失，存在越权操作。

### P1（本周修复）

- 问题 8：成就系统不生效。
- 问题 9：Redis 生产风险。
- 问题 10：开发环境加密不一致。
- 问题 11：限流失效/被绕过。
- 问题 12：教师复核体验与数据丢失。
- 问题 13：AI 接口滥用风险。

### P2（后续优化）

- 问题 14-19：UX、类型安全、日志与 CSV 解析等可维护性问题。

---

## 修复记录

以下问题已在本次会话中全部修复并验证：

- **数据越权泄露（问题 1-4）**：空班级/空学生时直接返回空数组或零值，不再退化为无 `where` 条件查询。
- **权限边界（问题 5-7）**：创建任务、学生提交、教师查看/复核作文均增加 `assertClassAccess` / `assertStudentAccess` 校验。
- **成就系统（问题 8）**：补充 `db.insert(achievements).values(...).onConflictDoNothing()` 写入未记录成就。
- **Redis 缓存（问题 9）**：`invalidateCache` 改用 `SCAN` 分批删除，避免 `KEYS` 阻塞。
- **开发加密密钥（问题 10）**：缓存随机开发密钥，避免每次重启后无法解密。
- **限流 IP（问题 11）**：`x-forwarded-for` 取第一个 IP，防止伪造和代理误判。
- **教师复核页（问题 12）**：增加 `isReviewDirty` 状态，刷新时不再覆盖未保存的评语/分数。
- **AI 输入限制（问题 13）**：润色/升级/语法/同义/出题及自主练习接口均增加 `max()` 长度校验。
- **注册页密码长度（问题 14）**：前端提示与后端一致为至少 8 位。
- **页面角色守卫（问题 15）**：教师相关页面统一允许 `TEACHER | SCHOOL_ADMIN | SUPER_ADMIN`。
- **导航与高亮（问题 16）**：移除无效路由，子路由使用 `pathname.startsWith` 高亮父级。
- **类型转换（问题 17）**：统一使用 `toAuthUser()` 显式转换，移除 `as AuthUser`。
- **日志统一（问题 18）**：服务端组件使用 `@betterwrite/shared/logger`；客户端组件统一使用新增 `clientLogger`。
- **CSV 解析（问题 19）**：学生导入改用支持引号与转义的 `parseCsvLine`。

### 验证结果

- `pnpm test`：87 个测试全部通过。
- `pnpm --filter @betterwrite/web lint`：通过。
- `pnpm --filter @betterwrite/web typecheck`：通过。
- `pnpm --filter @betterwrite/web build`：通过（依赖 `apps/web/.env.local` 中的本地兜底配置）。
- 备注：`apps/mobile` 的 TypeScript `lib` 配置问题属于既有技术债，未在本次 Web 端审查范围内修复。

## 验证说明

- TypeScript 与 Biome 在审查前均通过。
- 问题 1-15 经两名独立审查员交叉验证，一致确认为真实问题。
- 原始审查中怀疑的“useEssayDraft 字数限制不随任务变化”问题，经双审认定为误判，未列入本报告。
