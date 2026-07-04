# BetterWrite 生产部署稳定性打磨计划

## 摘要

本次优化聚焦“修复生产部署稳定性问题”，在已有的队列解耦、环境校验、Docker 编排基础上，补齐当前影响“开箱即用”的短板：

1. 修复 Vitest 对 `@betterwrite/shared/*` 子路径的模块解析错误，确保测试可稳定运行。
2. 添加 `.dockerignore` 并优化 Dockerfile，缩小构建上下文与镜像体积，加快部署。
3. 统一 Web API 与 Worker 的日志输出，全面使用 Pino 结构化日志替代 `console.log`。
4. 增强 Worker 健康检查，纳入数据库连通性校验。
5. 将 SQLite 备份从“直接 cp”改为在线安全备份，避免复制过程中文件损坏。
6. 完善 docker-compose.yml 的日志轮转、restart 策略等生产细节。
7. 更新 README 生产部署章节，补充检查清单与常见问题。
8. 跑完全部验证（typecheck、lint、test、build、Docker 构建）。

## 现状分析

### 已具备的良好基础
- `docker/docker-compose.yml` 已拆分 frontend/backend 网络，配置资源限制、healthcheck、backup profile。
- `packages/shared/src/env.ts` 使用 Zod 校验环境变量，生产环境强制 `REDIS_URL` 与 `NEXTAUTH_SECRET ≥ 32`。
- `packages/shared/src/logger.ts` 已提供 Pino logger，开发环境启用 pino-pretty。
- `apps/web/src/lib/api/queue.ts` + `apps/worker/src/index.ts` 已通过 BullMQ 解耦 AI 批改。
- `apps/web/src/lib/api/routes.ts` 已配置 CORS、/api/health 检查数据库与 Redis。
- CI/CD 已配置 lint、typecheck、test、Docker 构建。

### 当前影响生产稳定的具体问题

#### 1. 测试子路径模块解析失败
- `apps/web/src/lib/api/routes.ts` 等源码导入 `@betterwrite/shared/env`、`@betterwrite/shared/logger`、`@betterwrite/shared/queue`。
- `vitest.config.ts` 的 alias 仅映射 `@betterwrite/shared -> packages/shared/src/index.ts`，未覆盖子路径，运行 `pnpm test` 会报 `Cannot find module '@betterwrite/shared/env'`。

#### 2. Docker 构建上下文过大，镜像臃肿
- 仓库根目录缺少 `.dockerignore`，构建时会将 `.git`、`.next`、`node_modules`、`local.db`、测试文件等全部传入 Docker daemon。
- `docker/Dockerfile.migrate` 复制整个 `apps` 目录，但仅运行 `db:migrate`。
- `docker/Dockerfile.worker` 复制整份 `node_modules` 与 `packages`，包含 devDependencies 与构建产物。

#### 3. 日志未完全统一
- `apps/web/src/lib/api/routes.ts` 大量接口仍使用 `console.log` / `console.error` / `console.warn`。
- `apps/worker/src/index.ts` 的 `processCorrection` 函数仍使用 `console.log` / `console.error`。
- 统一使用 `logger` 后可与 `LOG_LEVEL` 联动，并便于后续接入日志采集。

#### 4. Worker 健康检查不够完整
- Worker 健康端点仅判断 `worker.isRunning()`，未校验数据库连接。若数据库文件损坏或不可写，worker 会不断失败作业。

#### 5. SQLite 备份存在数据损坏风险
- `docker-compose.yml` 的 `backup` 服务使用 `cp /data/betterwrite.db /backup/...`，若在复制时 Web/Worker 正在写入，可能得到不一致的备份。

#### 6. docker-compose.yml 生产细节待完善
- 未配置容器日志大小限制，长期运行可能占满磁盘。
- `web` / `worker` 的 `depends_on` 条件正确，但可补充 `restart` 策略一致性检查。

#### 7. 文档与示例可进一步贴近生产
- `.env.production.example` 中 `NEXTAUTH_SECRET=change-me-to-a-strong-random-secret` 长度不足 32，直接复制会导致生产环境校验失败。
- README 中缺少“首次部署后必须修改默认密码”以外的生产检查清单。

## 计划变更

### 1. 修复 Vitest 子路径模块解析
**文件**：`vitest.config.ts`

**变更内容**：
- 将 alias 规则从 `@betterwrite/shared -> packages/shared/src/index.ts` 改为基于 package.json exports 的解析，或显式为每个子路径添加 alias：
  - `@betterwrite/shared/env -> packages/shared/src/env.ts`
  - `@betterwrite/shared/logger -> packages/shared/src/logger.ts`
  - `@betterwrite/shared/queue -> packages/shared/src/queue.ts`
- 保留 `@betterwrite/shared` 主入口的 alias。

**原因**：Vitest 默认不会解析 workspace 包内部的 subpath exports，必须显式配置别名才能正确加载 `env.ts`、`logger.ts`、`queue.ts`。

### 2. 添加 `.dockerignore`
**文件**：新增 `.dockerignore`

**变更内容**：
- 排除：`node_modules`、`.git`、`.turbo`、`.next`、`dist`、`coverage`、`.env*`、`*.md`、测试文件、本地 SQLite 文件（`*.db`）、IDE 配置等。
- 允许保留：`package.json`、`pnpm-workspace.yaml`、`turbo.json`、`.npmrc`、`apps/**`、`packages/**` 的源码。

**原因**：减小构建上下文，避免敏感文件（如 `.env.local`）和本地数据库进入镜像，同时加快 CI 与本地 Docker 构建。

### 3. 优化 Docker 镜像
#### 3.1 `docker/Dockerfile.worker`
**变更内容**：
- 继续使用多阶段构建。
- builder 阶段仅复制 `apps/worker`、`packages/shared`、`packages/db`、`packages/ai`（worker 实际依赖）。
- runner 阶段仅复制生产依赖：通过 `pnpm deploy --filter=@betterwrite/worker --prod /prod/worker` 生成精简的 `node_modules`，或使用 `pnpm prune --prod`。
- 最终镜像仅保留 `dist`、生产 `node_modules`、`package.json`。
- 健康检查保持现有 HTTP 探针。

**原因**：减小 worker 镜像体积，避免 devDependencies 与源码进入生产镜像，降低攻击面。

#### 3.2 `docker/Dockerfile.web`
**变更内容**：
- 复制范围限定为构建所需的最小 monorepo 部分：`packages/ai`、`packages/db`、`packages/shared`、`packages/design-system`、`apps/web`。
- 保留 `standalone` 输出方式。
- 验证 `.next/standalone` 是否包含运行时所需的 workspace 依赖。

**原因**：减少构建上下文，避免不必要的包触发重建缓存失效。

#### 3.3 `docker/Dockerfile.migrate`
**变更内容**：
- 仅复制 `packages/db` 与必要根配置，不复制整个 `apps` 目录。

**原因**：迁移服务只需要 db 包与 drizzle-kit，减少镜像体积和构建时间。

### 4. 统一使用 Pino 结构化日志
#### 4.1 `apps/web/src/lib/api/routes.ts`
**变更内容**：
- 顶部已导入 `logger`，将接口内所有 `console.log` / `console.warn` / `console.error` 替换为 `logger.info` / `logger.warn` / `logger.error`。
- 保持现有 `[API /xxx]` 前缀作为 `logger.child({ component: 'routes' })` 的 `msg` 文本，便于搜索。
- 错误对象通过 Pino 的 `err` 字段传递，例如 `logger.error({ err, userId }, '[API /xxx] error')`。

**原因**：与 `LOG_LEVEL` 配置联动，避免生产环境输出调试日志；JSON 格式便于日志采集与告警。

#### 4.2 `apps/worker/src/index.ts`
**变更内容**：
- `processCorrection` 与辅助函数中所有 `console.log` / `console.error` / `console.warn` 替换为 `workerLogger.info` / `warn` / `error`。
- 使用 `workerLogger.child({ essayId })` 为每篇作文创建带上下文的 logger。

**原因**：worker 是后台长驻进程，结构化日志对排查失败作业至关重要。

### 5. 增强 Worker 健康检查
**文件**：`apps/worker/src/index.ts`

**变更内容**：
- 在 `/health` 端点中增加数据库连通性检查：尝试执行一次轻量查询（如 `db.query.users.findFirst({ columns: { id: true } })`）。
- 仅当 `worker.isRunning()` 为 true 且数据库可访问时返回 HTTP 200；否则返回 503。

**原因**：避免健康容器实际无法写入数据库，导致作业无限失败重试。

### 6. SQLite 安全在线备份
**文件**：`docker/docker-compose.yml`

**变更内容**：
- 将 `backup` 服务的基础镜像从 `alpine:latest` 改为 `keinos/sqlite3:latest`（或 `alpine` + 安装 `sqlite`）。
- 备份命令改为使用 SQLite 在线备份：
  ```sh
  sqlite3 /data/betterwrite.db ".backup /backup/betterwrite-$(date +%Y%m%d-%H%M%S).db"
  ```
- 保留 `BACKUP_INTERVAL` 环境变量。

**原因**：`.backup` 命令会创建一致性快照，避免直接复制正在写入的数据库文件导致损坏。

### 7. 完善 docker-compose.yml 生产细节
**文件**：`docker/docker-compose.yml`

**变更内容**：
- 为 `web`、`worker`、`redis` 服务添加日志限制：
  ```yaml
  logging:
    driver: "json-file"
    options:
      max-size: "100m"
      max-file: "3"
  ```
- 检查并统一所有生产服务的 `restart: unless-stopped`。
- 确保 `backup` 服务在 profile 外不会自动启动。
- 可选：为 `web` 添加 `read_only: true` 并配合 tmpfs（如 Next.js 运行时需要写 `/tmp`），但需验证 standalone 模式是否兼容。本次计划保守处理：先仅添加日志限制，不启用 read_only。

### 8. 更新环境变量示例与 README
#### 8.1 `.env.production.example`
**变更内容**：
- 将 `NEXTAUTH_SECRET=change-me-to-a-strong-random-secret` 改为占位提示：`# 必须 >= 32 字符，生成命令：openssl rand -base64 32`。
- 添加 `LOG_LEVEL` 默认值说明。
- 补充 `CORS_ORIGIN` 为空时的行为说明（允许同域，禁止跨域）。

#### 8.2 `README.md`
**变更内容**：
- 在“生产建议”中补充检查清单：
  1. 修改 `NEXTAUTH_SECRET`（≥32 字符）。
  2. 配置至少一个 AI Key。
  3. 修改或删除默认账号。
  4. 配置反向代理与 HTTPS。
  5. 启用 backup profile 并定期导出备份。
  6. 配置 Docker 日志轮转。
- 补充“常见问题”：若 `docker compose up` 后 web/worker 反复重启，检查 `.env.production` 中 `NEXTAUTH_SECRET` 长度与 `REDIS_URL`。

## 假设与决策

- **不引入外部数据库**：继续使用 SQLite（libsql）作为默认数据库，保留 README 中提到的迁移至 Turso/libsql server 的建议。本次优化重点是让 SQLite 方案稳定可用。
- **不引入 Kubernetes / Terraform**：保持 Docker Compose 作为“开箱即用”的部署方式。
- **不引入 Prometheus**：可观测性增强属于用户未选择的“增加可观测性”范畴，本次不纳入。
- **Pino transport 配置不变**：生产环境不配置 transport，输出 JSON；开发环境使用 pino-pretty。
- **Vitest alias 方案**：优先采用显式子路径 alias，简单直接，不改动 package.json exports（避免影响构建）。
- **Docker 镜像瘦身**：worker 使用 `pnpm deploy --prod` 生成精简产物；若实际构建中发现 workspace 链接问题，回退到 `pnpm install --prod` 在 runner 阶段重新安装。

## 验证步骤

完成所有变更后，必须按顺序执行：

1. **依赖安装**
   ```bash
   pnpm install
   ```

2. **类型检查**
   ```bash
   pnpm -r typecheck
   ```

3. **代码检查**
   ```bash
   pnpm exec biome check --write
   ```

4. **测试**
   ```bash
   pnpm test
   ```
   预期：所有测试通过，不再出现 `@betterwrite/shared/env` 模块解析错误。

5. **构建**
   ```bash
   pnpm -r build
   ```

6. **Docker 镜像构建**
   ```bash
   docker build -f docker/Dockerfile.web -t betterwrite-web .
   docker build -f docker/Dockerfile.worker -t betterwrite-worker .
   docker build -f docker/Dockerfile.migrate -t betterwrite-migrate .
   ```

7. **Docker Compose 一键启动**
   ```bash
   cp .env.production.example .env.production
   # 编辑 .env.production，设置 NEXTAUTH_SECRET 与可选的 AI Key
   docker compose --env-file .env.production -f docker/docker-compose.yml up -d --build
   ```
   预期：`web` 与 `worker` 服务健康检查通过，`/api/health` 返回 `{"status":"ok","database":"ok","redis":"ok"}`。

8. **功能验证**
   - 使用种子服务创建默认账号。
   - 学生提交作文后，状态从 `pending` 变为 `correcting` 再到 `completed`。
   - Worker 日志以 JSON 格式输出，无 `console.log`。

## 计划文件

- 计划路径：`c:\Users\xy122\Documents\trae_projects\BetterWrite\.trae\documents\production-deployment-polish-plan.md`
