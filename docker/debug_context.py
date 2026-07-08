import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=60)

def run(cmd, timeout=30):
    print(f'\n$ {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out)
    if err: print(f'ERR: {err}')

# Check for parent .dockerignore
print("=== 检查父目录 .dockerignore ===")
run('ls -la /www/wwwroot/.dockerignore 2>/dev/null || echo "no parent dockerignore"')
run('ls -la /www/.dockerignore 2>/dev/null || echo "no grandparent dockerignore"')

# Check what files are in the project root
print("\n=== 项目根目录文件 ===")
run('ls -la /www/wwwroot/BetterWrite/ | head -30')

# Try building with explicit file copy
print("\n=== 尝试手动复制 lockfile 到 docker 目录 ===")
run('cp /www/wwwroot/BetterWrite/pnpm-lock.yaml /www/wwwroot/BetterWrite/docker/pnpm-lock.yaml')
run('ls -lh /www/wwwroot/BetterWrite/docker/')

# Build from docker directory
print("\n=== 从 docker 目录构建 ===")
run('cd /www/wwwroot/BetterWrite/docker && docker build -f Dockerfile.migrate -t betterwrite-migrate:latest .. 2>&1 | tail -30', timeout=300)

ssh.close()
