# BetterWrite

BetterWrite — 深圳中考英语作文 AI 辅导系统。面向教师、学生与学校管理员，提供作文任务管理、AI 智能批改、学情分析、错题本与教学资源等功能。

## 技术栈

- **Web**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS
- **API**: Hono + Lucia Auth + Zod
- **Database**: SQLite (libsql) + Drizzle ORM
- **Cache / Rate-limiting**: Redis
- **Task Queue**: 内置 worker（作文异步批改）
- **Monorepo**: pnpm workspaces + Turbo
- **Deployment**: Docker + Docker Compose

## 目录

- [快速开始](#快速开始)
- [Docker 一键部署](#docker-一键部署)
- [环境变量](#环境变量)
- [默认账号](#默认账号)
- [升级与备份](#升级与备份)
- [开发](#开发)
- [许可证](#许可证)

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/BetterWrite.git
cd BetterWrite
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少配置以下项：

- `NEXTAUTH_SECRET`：随机字符串，生产环境务必修改
- `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY`：至少配置一个 AI 供应商

### 4. 初始化数据库

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000，使用[默认账号](#默认账号)登录。

## Docker 一键部署

推荐用于生产或演示环境，已包含 Web、Worker、Redis、自动迁移。

### 1. 准备环境变量

```bash
cp .env.production.example .env.production
# 编辑 .env.production，配置 NEXTAUTH_SECRET 与 AI Key
```

### 2. 启动服务

```bash
docker compose --env-file .env.production -f docker/docker-compose.yml up -d
```

该命令会依次完成：

1. 启动 Redis
2. 运行数据库迁移（migrate 服务，一次性）
3. 启动作文批改 Worker
4. 启动 Next.js Web 服务

### 3. 初始化演示数据

首次部署后，运行种子脚本创建默认管理员、教师、学生账号：

```bash
docker compose --env-file .env.production -f docker/docker-compose.yml run --rm seed
```

> 种子脚本会写入固定邮箱，重复执行将因唯一约束失败，属于预期行为。

### 4. 访问应用

打开浏览器访问 http://localhost:3000（端口可通过 `WEB_PORT` 修改）。

### 5. 查看日志

```bash
# Web 服务
docker logs -f betterwrite-web

# Worker
docker logs -f betterwrite-worker
```

### 6. 停止服务

```bash
docker compose --env-file .env.production -f docker/docker-compose.yml down
```

## 环境变量

| 变量 | 说明 | 开发示例 | 生产示例 |
|------|------|----------|----------|
| `DATABASE_URL` | SQLite / libsql 连接地址 | `file:./local.db` | `file:/app/data/betterwrite.db` |
| `DATABASE_AUTH_TOKEN` | 远程 libsql 认证令牌（可选） | - | - |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379` | `redis://redis:6379` |
| `NEXTAUTH_SECRET` | Lucia 会话加密密钥 | 任意字符串 | `openssl rand -base64 32` |
| `NEXT_PUBLIC_API_URL` | 前端 API 基地址 | `http://localhost:3000` | `http://localhost:3000` |
| `OPENAI_API_KEY` | OpenAI API Key | - | - |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | - | - |
| `ANTHROPIC_API_KEY` | Anthropic API Key | - | - |
| `EXPO_ACCESS_TOKEN` | 推送通知令牌（可选） | - | - |
| `WEB_PORT` | Web 服务对外端口 | `3000` | `3000` |

## 默认账号

执行 `pnpm db:seed` 或 Docker `seed` 服务后，系统会创建以下账号：

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 超级管理员 | `superadmin@betterwrite.cn` | `admin123` |
| 学校管理员 | `admin@school.com` | `admin123` |
| 教师 | `teacher@school.com` | `admin123` |
| 学生 | `student@school.com` | `admin123` |

> 生产环境务必修改默认密码或删除默认账号。

## 升级与备份

### 升级

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker compose --env-file .env.production -f docker/docker-compose.yml up -d --build
```

### 备份数据库

数据库以 SQLite 文件形式存储在 Docker volume `betterwrite_sqlite-data` 中。

```bash
# 备份
docker run --rm -v betterwrite_sqlite-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/betterwrite-db-backup.tar.gz -C /data .

# 恢复（谨慎操作，会覆盖当前数据）
docker run --rm -v betterwrite_sqlite-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/betterwrite-db-backup.tar.gz -C /data
```

## 开发

```bash
# 启动所有开发服务
pnpm dev

# 仅启动 Web
pnpm --filter @betterwrite/web dev

# 运行测试
pnpm test

# 代码检查
pnpm lint
pnpm typecheck

# 数据库迁移与种子
pnpm db:migrate
pnpm db:seed
pnpm db:studio
```

## 项目结构

```
BetterWrite/
├── apps/
│   ├── web/              # Next.js Web 应用
│   ├── worker/           # 作文批改 Worker
│   └── mobile/           # 移动端（Expo/React Native）
├── packages/
│   ├── db/               # Drizzle ORM 与数据库 schema
│   ├── ai/               # AI 批改引擎与 provider 路由
│   ├── shared/           # 共享类型与工具函数
│   ├── design-system/    # UI 组件与设计 token
│   └── tsconfig/         # 共享 TypeScript 配置
├── docker/               # Docker 镜像与 Compose 编排
├── docs/                 # 架构与接口文档
└── .github/workflows/    # CI/CD
```

## 生产建议

### 部署前检查清单

1. **会话密钥**: 修改 `.env.production` 中的 `NEXTAUTH_SECRET`，长度必须 ≥ 32 字符。生成命令：
   ```bash
   openssl rand -base64 32
   ```
2. **AI 供应商**: 配置 `OPENAI_API_KEY`、`DEEPSEEK_API_KEY` 或 `ANTHROPIC_API_KEY` 中至少一个，否则批改将使用模拟评分。
3. **默认账号**: 首次启动后使用种子服务创建默认账号，生产环境务必修改默认密码或删除默认账号。
4. **HTTPS**: 使用反向代理并配置 TLS 证书。项目已提供 Nginx 示例：
   ```bash
   # 准备证书到 docker/nginx/certs/fullchain.pem 与 privkey.pem
   docker compose --env-file .env.production \
     -f docker/docker-compose.yml \
     -f docker/docker-compose.nginx.yml up -d
   ```
5. **备份**: 启用 backup profile 定期创建一致性备份：
   ```bash
   docker compose --env-file .env.production -f docker/docker-compose.yml --profile backup up -d
   ```
6. **日志轮转**: docker-compose.yml 已配置每个容器最多保留 3 个 100MB 日志文件，如需调整可修改 `logging` 配置。
7. **CORS**: 如需跨域访问 API，在 `.env.production` 中设置 `CORS_ORIGIN`（逗号分隔）。留空时禁止跨域请求，仅允许同源访问。
8. **数据库迁移**: migrate 服务内置 3 次重试，避免 SQLite 偶发锁冲突导致启动失败。

### 常见问题

- **Web / Worker 反复重启**：检查 `.env.production` 中 `NEXTAUTH_SECRET` 是否为空或长度不足 32，以及 `REDIS_URL` 是否可解析。
- **健康检查失败**：Web 服务访问 `/api/health` 会校验数据库、Redis 与任务队列；Worker 健康端点会校验数据库与 Redis 连通性。
- **Worker 因 Redis 断连退出**：当 Redis 长期不可达时，Worker 会主动退出，由 Docker `restart: unless-stopped` 自动重启恢复，属于正常行为。
- **备份文件损坏**：Backup 服务已使用 SQLite 在线备份（`.backup` 命令），避免直接复制正在写入的数据库文件。
- **无真实 AI 批改**：未配置 AI Key 时，系统会自动降级为模拟评分，并在日志中提示 `No AI provider configured`。
- **SQLite 写入冲突**：Docker Compose 默认使用单 SQLite 文件与单 Worker 实例，避免多进程同时写入；高并发场景请迁移至 libsql server / Turso。

## 许可证

MIT
