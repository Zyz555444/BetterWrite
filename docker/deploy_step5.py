import paramiko

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

# Check lockfile content
print("=== 检查 lockfile ===")
run('head -5 /www/wwwroot/BetterWrite/pnpm-lock.yaml')
run('wc -l /www/wwwroot/BetterWrite/pnpm-lock.yaml')

# Check dockerignore for lockfile exclusion
print("\n=== 检查 .dockerignore ===")
run('grep -n "lock" /www/wwwroot/BetterWrite/.dockerignore || echo "no lock exclusion"')
run('grep -n "pnpm" /www/wwwroot/BetterWrite/.dockerignore')

# Try building with verbose to see what's in context
print("\n=== 测试构建上下文 ===")
run('cd /www/wwwroot/BetterWrite && docker build --no-cache -f docker/Dockerfile.migrate -t betterwrite-migrate:latest . 2>&1 | head -50', timeout=120)

ssh.close()
