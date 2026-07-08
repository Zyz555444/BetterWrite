import paramiko
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=60)

def run(cmd, timeout=300):
    print(f'\n$ {cmd[:150]}...' if len(cmd) > 150 else f'\n$ {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out)
    if err: print(f'ERR: {err}')
    return out, err

# Step 1: Upload .env via SFTP
print("=== Step 1: 上传 .env 文件 ===")
sftp = ssh.open_sftp()

env_content = """# BetterWrite 生产环境配置
DATABASE_URL=file:/app/data/betterwrite.db
DATABASE_AUTH_TOKEN=
REDIS_URL=redis://redis:6379
NEXTAUTH_SECRET=Q3TzW2nP4k6L9R8sV1bX7yM0jH5gKcAeDfNhUiYpBxq
NEXT_PUBLIC_API_URL=https://api.cosky.top
CORS_ORIGIN=https://www.cosky.top,https://admin.cosky.top,https://app.cosky.top
NODE_ENV=production
LOG_LEVEL=info
WEB_PORT=3000
WORKER_HEALTH_PORT=8080
WORKER_CONCURRENCY=2
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
ANTHROPIC_API_KEY=
EXPO_ACCESS_TOKEN=
"""

with sftp.open('/www/wwwroot/BetterWrite/.env', 'w') as f:
    f.write(env_content)
print(".env 文件已上传")
sftp.close()

run('cat /www/wwwroot/BetterWrite/.env')

# Step 2: 查看 docker compose 文件
print("\n=== Step 2: 查看 docker compose 配置 ===")
run('ls -la /www/wwwroot/BetterWrite/docker/')

# Step 3: 构建 migrate 镜像
print("\n=== Step 3: 构建 migrate 镜像 ===")
run('cd /www/wwwroot/BetterWrite && docker build -f docker/Dockerfile.migrate -t betterwrite-migrate:latest .', timeout=600)

ssh.close()
print("\n=== 第三阶段完成 ===")
