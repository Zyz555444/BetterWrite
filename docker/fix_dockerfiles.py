import paramiko
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=60)

def run(cmd, timeout=30):
    print(f'\n$ {cmd[:150]}...' if len(cmd) > 150 else f'\n$ {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out)
    if err: print(f'ERR: {err}')
    return out, err

# Check if dockerignore still exists
print("=== 检查 .dockerignore ===")
run('ls -la /www/wwwroot/BetterWrite/.dockerignore*')
run('ls -la /www/wwwroot/.dockerignore 2>/dev/null || echo "no parent"')

# Check lockfile
print("\n=== 检查 lockfile ===")
run('ls -lh /www/wwwroot/BetterWrite/pnpm-lock.yaml')
run('head -3 /www/wwwroot/BetterWrite/pnpm-lock.yaml')

# Update Dockerfiles to use --no-frozen-lockfile
print("\n=== 更新 Dockerfiles ===")
sftp = ssh.open_sftp()

# Read and update Dockerfile.worker
worker_content = """FROM node:24-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

FROM base AS builder
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json .npmrc ./
COPY packages ./packages
COPY apps/worker ./apps/worker

RUN pnpm install --no-frozen-lockfile
RUN pnpm turbo run build --filter=@betterwrite/worker

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/apps/worker/dist ./dist
COPY --from=builder --chown=node:node /app/apps/worker/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/turbo.json ./turbo.json
COPY --from=builder --chown=node:node /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=node:node /app/.npmrc ./.npmrc

RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \\
  CMD node -e "http.get('http://localhost:8080/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
"""

# Read and update Dockerfile.web
web_content = """FROM node:24-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json .npmrc ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --no-frozen-lockfile
RUN pnpm turbo run build --filter=@betterwrite/web...

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public

RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
"""

with sftp.open('/www/wwwroot/BetterWrite/docker/Dockerfile.worker', 'w') as f:
    f.write(worker_content)
print("更新 Dockerfile.worker")

with sftp.open('/www/wwwroot/BetterWrite/docker/Dockerfile.web', 'w') as f:
    f.write(web_content)
print("更新 Dockerfile.web")

sftp.close()

# Build worker
print("\n=== 构建 worker 镜像 ===")
run('cd /www/wwwroot/BetterWrite && docker build --no-cache -f docker/Dockerfile.worker -t betterwrite-worker:latest . 2>&1', timeout=600)

ssh.close()
print("\n=== 完成 ===")
