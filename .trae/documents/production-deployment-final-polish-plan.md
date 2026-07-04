# BetterWrite 生产部署最终打磨计划

## 摘要

在已完成 BullMQ 队列解耦、Zod 环境校验、Docker Compose 编排、Pino 结构化日志等工作的基础上，本次“最终打磨”聚焦剩余的生产稳定性隐患与部署体验缺口，目标是在普通 Linux/Windows(Docker Desktop) 服务器上实现 `docker compose up -d` 即可稳定运行，且关键配置与安全行为无歧义。

本次计划要补齐的短板：
1. 修复 CORS 中间件在 `CORS_ORIGIN` 为空时的潜在跨域放行问题。
2. 统一服务端剩余 `console.*` 日志到 Pino，避免生产日志格式混乱且无法通过 `LOG_LEVEL` 控制。
3. 增强 Worker 健壮性：健康检查纳入 Redis 连通性，Redis 长期不可达时主动退出让容器重启。
4. 加固 Docker 运行安全：Web / Worker / Migrate 镜像以非 root 用户运行。
5. 提升迁移服务可靠性：增加简单重试，避免偶发锁冲突导致整批服务无法启动。
6. 提供 Nginx 反向代理示例配置，便于用户直接套用 HTTPS 生产部署。
7. 验证 Docker Compose 一键启动与健康检查全部通过。

## 现状分析

### 已具备的良好基础
- `docker/docker-compose.yml` 已拆分 `frontend` / `backend` 网络、资源限制、日志轮转、健康检查、backup profile。
- `packages/shared/src/env.ts` 已用 Zod 校验环境变量，生产环境强制 `REDIS_URL` 与 `NEXTAUTH_SECRET ≥ 32`。
- `packages/shared/src/logger.ts` 提供 Pino logger，生产输出 JSON，开发使用 pino-pretty。
- `apps/web/src/lib/api/routes.ts` 与 `apps/worker/src/index.ts` 已改用 Pino 记录主要接口与批改流程日志。
- CI/CD 工作流已覆盖 lint、typecheck、test、build、Docker 构建与镜像推送。

### 仍然存在的生产稳定性隐患

#### 1. CORS 配置存在潜在安全风险
**文件**：`apps/web/src/lib/api/routes.ts`（第 88-103 行）

当前实现：
```typescript
const allowedOrigins = env.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return undefined;
    return allowedOrigins.includes(origin) ? origin : null;
  },
  credentials: true,
}));
```

问题：当 `CORS_ORIGIN` 为空且请求未携带 `Origin` 头时，回调返回 `undefined`。Hono 的 CORS 中间件对 `undefined` 的处理可能等同于不限制，实际行为取决于框架版本，存在“空配置下意外允许跨域”的风险。

#### 2. 服务端仍存在多处 `console.*` 日志
**文件**：
- `apps/web/src/lib/api/redis.ts`：Redis 连接错误使用 `console.error`。
- `apps/web/src/lib/api/cache.ts`：Redis 读写失败使用 `console.warn`。
- `apps/web/src/lib/api/rate-limiter.ts`：Redis 限流失败回退内存时使用 `console.warn`。
- `apps/worker/src/ocr.ts`：OCR 失败与降级使用 `console.error/warn`。
- `packages/ai/src/router.ts`：Provider fallback 使用 `console.warn`。
- `apps/web/src/instrumentation.ts`：启动 stuck essays 重置使用 `console.log/error`。

问题：这些日志无法通过 `LOG_LEVEL` 统一控制，JSON 采集时格式不一致；部分错误日志缺少上下文字段。

#### 3. Worker 健康检查未覆盖 Redis
**文件**：`apps/worker/src/index.ts`（第 252-275 行）

当前 `/health` 检查 `worker.isRunning()` 与数据库连通性，但未检查 Redis 连通性。若 Redis 故障，Worker 无法消费/重试作业，却仍会被 Docker 视为健康容器。

#### 4. Worker 对 Redis 断连缺乏主动退出策略
**文件**：`apps/worker/src/index.ts`

当前仅监听 `SIGTERM/SIGINT` 优雅退出，未监听 Redis `close` / `end` 事件。若 Redis 长期不可用，Worker 可能挂起而不是退出重启，影响任务恢复。

#### 5. Docker 镜像以 root 运行
**文件**：`docker/Dockerfile.web`、`docker/Dockerfile.worker`、`docker/Dockerfile.migrate`

当前所有运行时镜像默认使用 root 用户启动 Node 进程，违反最小权限原则；且 `/app/data` 目录权限未显式声明，可能导致非 root 切换后 SQLite 写入失败。

#### 6. 数据库迁移服务没有重试
**文件**：`docker/docker-compose.yml` 中 `migrate` 服务

`depends_on` 使用 `condition: service_completed_successfully`。若迁移因 SQLite 文件锁或短暂 IO 错误失败一次，整个 Compose 启动即失败，需要手动重跑。

#### 7. 缺少生产反向代理示例
项目未提供 Nginx / Traefik / Caddy 配置。用户需要自行编写 HTTPS 反向代理，增加“开箱即用”门槛。

#### 8. Docker Compose 一键启动尚未最终验证
之前的优化尚未完整跑过 `docker compose --env-file .env.production -f docker/docker-compose.yml up -d --build` 的全链路验证，包括健康检查、种子服务、作文提交流程。

## 计划变更

### 1. 修复 CORS 安全配置
**文件**：`apps/web/src/lib/api/routes.ts`

**变更内容**：
- 当 `CORS_ORIGIN` 为空时，拒绝所有跨域请求；当配置了具体来源时，只允许匹配的来源。
- 实现方式：
  ```typescript
  const allowedOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  app.use('*', cors({
    origin: (origin) => {
      if (!origin) return null;
      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
  }));
  ```

**原因**：明确“空配置 = 禁止跨域”，消除框架对 `undefined` 解释的依赖，符合生产安全预期。

### 2. 统一剩余服务端日志到 Pino
#### 2.1 `apps/web/src/lib/api/redis.ts`
- 引入 `logger` from `@betterwrite/shared/logger`。
- 将 `console.error('[Redis] connection error:', err.message)` 改为 `redisLogger.warn({ err }, '[Redis] connection error')`。

#### 2.2 `apps/web/src/lib/api/cache.ts`
- 引入 `logger`。
- 将三处 `console.warn` 替换为 `cacheLogger.warn({ err }, '[Cache] ...')`。

#### 2.3 `apps/web/src/lib/api/rate-limiter.ts`
- 引入 `logger`。
- 将 Redis 失败回退内存的 `console.warn` 替换为 `rateLimitLogger.warn({ err }, '[RateLimit] Redis failed, falling back to memory')`。

#### 2.4 `apps/worker/src/ocr.ts`
- 引入 `logger` from `@betterwrite/shared/logger`。
- 将 OCR 重试、超时、未配置 API Key 的 `console.error/warn` 替换为 `ocrLogger.warn/error`。

#### 2.5 `packages/ai/src/router.ts`
- 引入 `logger` from `@betterwrite/shared/logger`。
- 将 `console.warn(`Provider ${primary.name} failed, trying fallback`, error)` 改为 `aiLogger.warn({ err: error, provider: primary.name }, 'AI provider failed, trying fallback')`。

#### 2.6 `apps/web/src/instrumentation.ts`
- 引入 `logger`。
- 将 `console.log` / `console.error` 替换为 `instrumentationLogger.info` / `error`。

**原因**：生产日志统一为 JSON 结构化输出，可通过 `LOG_LEVEL` 控制噪声；服务端异常便于检索与告警。

### 3. 增强 Worker 健康检查（含 Redis）
**文件**：`apps/worker/src/index.ts`

**变更内容**：
- 在 `/health` 端点中增加 Redis 连通性检查（复用 `connection.ping()` 或新建轻量 Redis 实例 ping）。
- 响应新增 `redis` 字段：
  ```json
  { "status": "ok", "queue": "essay-corrections", "database": "ok", "redis": "ok" }
  ```
- 仅当 `worker.isRunning() && database === 'ok' && redis === 'ok'` 时返回 200，否则 503。

**原因**：让 Docker 在 Redis 故障时能够识别 worker 不健康并触发重启/编排恢复。

### 4. Worker Redis 断连主动退出
**文件**：`apps/worker/src/index.ts`

**变更内容**：
- 监听 Redis connection 的 `close` 与 `end` 事件：
  ```typescript
  connection.on('close', () => workerLogger.warn('Redis connection closed'));
  connection.on('end', async () => {
    workerLogger.error('Redis connection ended, shutting down worker');
    await shutdown('Redis end');
  });
  ```
- 确保 `shutdown` 函数幂等，避免重复调用。

**原因**：Redis 是 Worker 的必要依赖，长期断连时主动退出容器，依赖 Docker `restart: unless-stopped` 自动恢复。

### 5. Docker 镜像以非 root 用户运行
#### 5.1 `docker/Dockerfile.web`
**变更内容**：
- runner 阶段创建并切换到 `node` 用户：
  ```dockerfile
  RUN addgroup -g 1001 -S nodejs && adduser -S node -u 1001
  USER node
  ```
- 确保 `/app` 目录在 `COPY` 后属于 `node` 用户。
- `EXPOSE 3000` 与 `CMD` 保持不变。

#### 5.2 `docker/Dockerfile.worker`
**变更内容**：
- runner 阶段同样切换 `node` 用户。
- 数据卷挂载点 `/app/data` 在运行时由 Docker volume 提供，权限需通过 compose 中 `user: "1001:1001"` 或镜像内预创建目录保证可写。

#### 5.3 `docker/Dockerfile.migrate`
**变更内容**：
- runner 阶段切换 `node` 用户。
- 确保 `/app/data` 目录存在且 `node` 用户可写。

#### 5.4 `docker/docker-compose.yml`
- 为 `web`、`worker`、`migrate` 服务统一声明 `user: "1001:1001"`（与镜像内 `node` 用户一致），避免 volume 挂载后 UID/GID 不一致导致 SQLite 写入失败。

**原因**：遵循容器最小权限原则，降低运行时安全风险。

### 6. 迁移服务增加重试
**文件**：`docker/Dockerfile.migrate`

**变更内容**：
- 将 `CMD ["pnpm", "turbo", "run", "db:migrate"]` 改为带重试的入口脚本：
  ```dockerfile
  RUN printf '%s\n' '#!/bin/sh' 'for i in 1 2 3; do' '  echo "Migration attempt $i..."' '  pnpm turbo run db:migrate && exit 0' '  sleep 5' 'done' 'echo "Migration failed after 3 attempts"' 'exit 1' > /app/migrate.sh && chmod +x /app/migrate.sh
  CMD ["/app/migrate.sh"]
  ```

**原因**：排除 SQLite 偶发锁/IO 错误导致的启动失败，提升“开箱即用”成功率。

### 7. 提供 Nginx 反向代理示例
**新增文件**：`docker/nginx/nginx.conf` 与 `docker/docker-compose.nginx.yml`

**变更内容**：
- `docker/nginx/nginx.conf`：提供生产 HTTPS 反向代理模板，包含：
  - `server` 监听 80 重定向到 443
  - `server` 监听 443 并配置 `ssl_certificate` / `ssl_certificate_key` 占位
  - `location /` 代理到 `betterwrite-web:3000`
  - 传递 `X-Forwarded-For`、`X-Forwarded-Proto`、`X-Real-IP`
  - 启用 gzip
- `docker/docker-compose.nginx.yml`：扩展主 compose，增加 `nginx` 服务挂载 `docker/nginx/nginx.conf` 与 TLS 证书目录。

**原因**：让用户可以直接套用示例配置启用 HTTPS，无需从零编写反向代理。

### 8. Web 健康检查可选增强（队列状态）
**文件**：`apps/web/src/lib/api/routes.ts`

**变更内容**：
- 在 `/api/health` 中，当 `env.REDIS_URL` 存在时，除 ping Redis 外，尝试检查 `correctionQueue` 是否可达（例如 `await correctionQueue.count()`），并将结果加入响应字段 `queue`。
- 若队列检查失败，`redis` 或 `queue` 字段标记为 `error`。

**原因**：Web 不仅依赖 Redis 连通，还依赖 BullMQ Queue 能正常操作；早期发现队列异常。

### 9. 更新文档
**文件**：`README.md`

**变更内容**：
- 在“生产建议”中补充：
  - CORS 留空时的默认安全行为。
  - 使用 `docker-compose.nginx.yml` 启用 HTTPS 反向代理的简要说明。
  - 迁移服务具备自动重试。
- 在“常见问题”中补充：
  - Worker 因 Redis 断连退出属于正常恢复行为，Docker 会自动重启。
  - 若使用 SQLite，避免多个进程同时写入；当前架构已通过单 volume + 单 worker 实例避免。

## 假设与决策

- **不切换默认数据库**：继续以 SQLite（libsql）作为 Docker Compose 默认方案，保持单节点“开箱即用”。README 已提示高写入场景可切换至 Turso/libsql server。
- **不引入 Kubernetes / 服务网格**：保持 Docker Compose 为主部署方式，Nginx 仅作为可选反向代理示例。
- **不引入 Prometheus / OpenTelemetry**：本次聚焦部署稳定性，可观测性已在 Pino JSON 日志层面完成基础统一。
- **非 root 用户方案**：Alpine 镜像使用系统自带的 `node` 用户（UID 1001），并在 compose 中显式 `user: "1001:1001"`，确保 volume 挂载后权限一致。
- **CORS 安全策略**：明确“未配置 = 禁止跨域”，与浏览器同源策略一致；需要跨域时必须在 `.env.production` 中显式配置。
- **迁移重试策略**：3 次尝试、间隔 5 秒，覆盖偶发 IO/锁错误；持续 schema 错误仍会失败，需要人工排查。

## 验证步骤

完成所有变更后，必须按顺序执行：

1. **本地静态验证**
   ```bash
   pnpm install
   pnpm -r typecheck
   pnpm exec biome check .
   pnpm test
   pnpm -r build
   ```

2. **Docker 镜像构建**
   ```bash
   docker build -f docker/Dockerfile.web -t betterwrite-web .
   docker build -f docker/Dockerfile.worker -t betterwrite-worker .
   docker build -f docker/Dockerfile.migrate -t betterwrite-migrate .
   ```

3. **Docker Compose 一键启动**
   ```bash
   cp .env.production.example .env.production
   # 编辑 .env.production，设置 NEXTAUTH_SECRET（≥32 字符）
   docker compose --env-file .env.production -f docker/docker-compose.yml up -d --build
   ```
   预期：
   - `redis` 健康检查通过。
   - `migrate` 成功完成并退出。
   - `worker` 健康检查返回 HTTP 200，响应包含 `database: ok, redis: ok`。
   - `web` 健康检查返回 HTTP 200，响应包含 `database: ok, redis: ok`。

4. **初始化与功能验证**
   ```bash
   docker compose --env-file .env.production -f docker/docker-compose.yml run --rm seed
   ```
   - 使用默认学生账号登录 http://localhost:3000。
   - 提交一篇作文，观察 `essays.status` 从 `pending` → `correcting` → `completed`。
   - Worker 日志为 JSON 格式，无 `console.log`。

5. **故障恢复验证（可选但建议）**
   ```bash
   docker stop betterwrite-redis
   # 等待 15-30 秒
   curl -f http://localhost:3000/api/health  # 应返回 503
   docker start betterwrite-redis
   # 等待恢复后，/api/health 应重新返回 200
   ```

6. **Nginx 反向代理验证（可选）**
   ```bash
   # 准备 TLS 证书 docker/nginx/certs/fullchain.pem 与 privkey.pem
   docker compose --env-file .env.production -f docker/docker-compose.yml -f docker/docker-compose.nginx.yml up -d
   curl -k https://localhost/api/health
   ```

## 待修改/新增文件清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/web/src/lib/api/routes.ts` | 修改 | 修复 CORS 安全配置；增强 /api/health 队列检查 |
| `apps/web/src/lib/api/redis.ts` | 修改 | console.error → Pino logger |
| `apps/web/src/lib/api/cache.ts` | 修改 | console.warn → Pino logger |
| `apps/web/src/lib/api/rate-limiter.ts` | 修改 | console.warn → Pino logger |
| `apps/worker/src/ocr.ts` | 修改 | console.error/warn → Pino logger |
| `packages/ai/src/router.ts` | 修改 | console.warn → Pino logger |
| `apps/web/src/instrumentation.ts` | 修改 | console.log/error → Pino logger |
| `apps/worker/src/index.ts` | 修改 | 健康检查增加 Redis；增加 Redis 断连退出逻辑 |
| `docker/Dockerfile.web` | 修改 | 非 root 用户运行 |
| `docker/Dockerfile.worker` | 修改 | 非 root 用户运行 |
| `docker/Dockerfile.migrate` | 修改 | 非 root 用户运行；迁移重试脚本 |
| `docker/docker-compose.yml` | 修改 | 声明 `user: "1001:1001"` 等运行时安全 |
| `docker/nginx/nginx.conf` | 新增 | Nginx HTTPS 反向代理示例 |
| `docker/docker-compose.nginx.yml` | 新增 | 扩展 compose，加入 nginx 服务 |
| `README.md` | 修改 | 补充 CORS、HTTPS、迁移重试、故障恢复说明 |

## 计划文件

- 计划路径：`c:\Users\xy122\Documents\trae_projects\BetterWrite\.trae\documents\production-deployment-final-polish-plan.md`
