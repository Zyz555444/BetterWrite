# BetterWrite 生产就绪优化计划

## 背景与目标

项目已完成 Phase 7 的功能开发与基础测试（`pnpm -r typecheck`、`pnpm exec biome check`、`pnpm test`、`pnpm -r build` 均通过）。当前需要进一步打磨，使其达到“开箱即用、可稳定部署生产”的状态。

本次优化的核心目标：
1. **解耦 AI 批改与 Web 请求**：当前 `apps/web/src/lib/api/routes.ts` 使用 `processCorrection({ essayId }).catch(...)` 在 Web 进程中 fire-and-forget 执行 AI 调用，存在重启丢任务、资源争用、无法重试等问题。
2. **补齐运行时基础设施**：环境变量校验、健康检查、结构化日志、CORS、容器资源限制与网络隔离。
3. **确保 Docker Compose 一键启动**：`docker compose up` 后即可运行 Web + Worker + Redis + 数据库迁移 + 健康检查。

## 关键现状

- **技术栈**：Next.js 16 App Router、Hono API（`/api/[...route]`）、Drizzle ORM + libsql、Lucia 认证、Redis（ioredis）、Docker Compose。
- **Worker 现状**：`apps/worker/src/index.ts` 只导出 `processCorrection` 与 `performOcr`，没有独立进程入口；`docker/Dockerfile.worker` 也没有 `CMD`，容器启动后无事可做。
- **健康检查**：`/api/health` 仅检查数据库，未检查 Redis。
- **环境变量**：无运行时校验，`.env.production.example` 已存在但缺少部分生产必填项说明。
- **安全**：Next.js 已配置安全响应头，但 Hono API 未显式配置 CORS；Cookie 缺少 `httpOnly`。
- **CI/CD**：GitHub Actions 已配置 CI（lint/typecheck/test/build/docker build）与 CD（推送 ghcr.io 镜像）。

## 推荐方案

### 1. 引入 BullMQ + Redis 作为真正的后台任务队列

这是解决 fire-and-forget 问题的最可靠方案。项目已部署 Redis，且 `processCorrection` 本身幂等（会跳过 `status === 'completed'`），非常适合队列化。

变更点：
- 新增 `packages/shared/src/queue.ts`：定义队列名与 Job 数据结构。
- 新增 `packages/shared/src/env.ts`：使用 Zod 校验并导出统一的环境变量，生产环境强制要求 `REDIS_URL` 与强 `NEXTAUTH_SECRET`。
- 新增 `apps/web/src/lib/api/queue.ts`：封装 BullMQ `Queue` 生产者。
- 改造 `apps/worker/src/index.ts`：在保持原有导出的前提下，当作为独立进程启动时（`node dist/index.js`）启动 BullMQ `Worker` 消费队列，并监听 `SIGTERM/SIGINT` 优雅退出。
- 改造 `apps/web/src/lib/api/routes.ts`：将 `POST /essays` 与 `POST /student/practice/deep` 中的 `processCorrection(...)` 替换为 `addCorrectionJob(essayId)`。

### 2. 健康检查与可观测性

- 增强 `/api/health`：同时检查数据库与 Redis，任一失败返回 503。
- Worker 增加独立 HTTP health server（端口 `WORKER_HEALTH_PORT`，默认 8080），供 Docker healthcheck 使用。
- 引入 `pino` 结构化日志，先替换 worker 与队列相关日志，其余 `console.log` 保留以避免改动过大。

### 3. 安全加固

- Hono API 增加 CORS 中间件，读取 `CORS_ORIGIN` 环境变量（逗号分隔）。
- `apps/web/src/lib/auth.ts` 为 Cookie 增加 `httpOnly: true`。
- `apps/web/src/instrumentation.ts` 在 Node.js runtime 启动时触发环境变量校验。

### 4. Docker 与部署加固

- 修改 `docker/Dockerfile.worker`：添加 `CMD ["node", "dist/index.js"]`、`EXPOSE 8080`、内置 `HEALTHCHECK`。
- 修改 `docker/docker-compose.yml`：
  - 增加 `frontend` / `backend` 网络隔离，仅 Web 暴露于 `frontend`。
  - 为 `web`、`worker`、`redis` 增加 `deploy.resources.limits`。
  - 为 `worker` 增加基于 HTTP `/health` 的健康检查。
  - 增加可选 `backup` service（profile=backup），定时备份 SQLite 数据卷。
- 更新 `.env.production.example`：补充 `CORS_ORIGIN`、`LOG_LEVEL`、`WORKER_HEALTH_PORT`、`WORKER_CONCURRENCY`。

### 5. 数据库迁移

- 运行 `pnpm db:generate`，确保 `packages/db/migrations/*.sql` 与当前 schema 一致。若已存在则检查是否需要新增迁移。

### 6. 测试与 CI 适配

- 更新 `apps/web/src/lib/api/__tests__/routes.test.ts`：将 `processCorrection` 的 mock 替换为 `addCorrectionJob` 的 mock。
- 更新 `turbo.json` `globalEnv`，将新增环境变量加入列表。

## 待修改/新增文件清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `packages/shared/src/env.ts` | 新建 | Zod 环境变量校验 |
| `packages/shared/src/logger.ts` | 新建 | pino 结构化日志 |
| `packages/shared/src/queue.ts` | 新建 | 队列常量与类型 |
| `packages/shared/src/index.ts` | 修改 | 导出 env / logger / queue |
| `packages/shared/package.json` | 修改 | 增加 `pino` 依赖（`pino-pretty` 为 devDependency） |
| `apps/web/src/lib/api/queue.ts` | 新建 | BullMQ 生产者封装 |
| `apps/web/src/lib/api/routes.ts` | 修改 | CORS、health 增强、fire-and-forget 替换 |
| `apps/web/src/lib/api/cache.ts` | 可选修改 | 改用 shared logger |
| `apps/web/src/lib/api/rate-limiter.ts` | 可选修改 | 改用 shared logger |
| `apps/web/src/lib/auth.ts` | 修改 | Cookie 增加 httpOnly |
| `apps/web/src/instrumentation.ts` | 修改 | 启动时触发 env 校验 |
| `apps/web/src/lib/api/__tests__/routes.test.ts` | 修改 | 更新 mock |
| `apps/web/package.json` | 修改 | 增加 `bullmq`、`pino` |
| `apps/worker/src/index.ts` | 重写 | 增加 BullMQ Worker + health server + graceful shutdown |
| `apps/worker/package.json` | 修改 | 增加 `bullmq`、`ioredis`、`pino` |
| `docker/Dockerfile.worker` | 修改 | 添加 CMD、EXPOSE、HEALTHCHECK |
| `docker/docker-compose.yml` | 修改 | 网络隔离、资源限制、worker healthcheck、backup service |
| `.env.production.example` | 修改 | 补充新环境变量 |
| `turbo.json` | 修改 | 补充 globalEnv |
| `packages/db/migrations/*.sql` | 生成/检查 | 确保迁移文件与 schema 一致 |

## 验证步骤

1. **本地依赖与类型**
   - `pnpm install`
   - `pnpm -r typecheck`
   - `pnpm exec biome check .`
   - `pnpm test`
   - `pnpm -r build`

2. **数据库迁移**
   - `pnpm db:generate`
   - 确认 `packages/db/migrations/` 下生成/更新了 SQL 文件

3. **Docker Compose 端到端验证**
   - `docker compose -f docker/docker-compose.yml up --build -d`
   - 等待 `migrate` 服务成功退出
   - `curl http://localhost:3000/api/health` 返回 `database: ok, redis: ok`
   - Worker 日志显示 `Worker starting` 与 health server 监听
   - 学生提交作文后，`/api/essays` 返回 `status: pending`
   - Worker 处理完成后，数据库 `essays.status` 变为 `completed`
   - 停止 Redis 后，`/api/health` 返回 503，worker healthcheck 失败

4. **CI/CD**
   - 推送分支后确认 GitHub Actions 的 CI 与 CD workflow 全部通过。

## 实施优先级

- **P0（必须）**：BullMQ 队列、Worker 独立进程、环境变量校验、health 增强、routes.ts 改造、Dockerfile.worker CMD、测试 mock 更新。
- **P1（强烈建议）**：CORS、Cookie httpOnly、Docker Compose 网络/资源限制、worker healthcheck、pino 日志。
- **P2（可选）**：backup service、完整 logger 替换、OpenTelemetry 等高级可观测性。
