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

# Check full .dockerignore
print("=== .dockerignore 完整内容 ===")
run('cat -n /www/wwwroot/BetterWrite/.dockerignore')

# Check if lockfile is in git
print("\n=== Git 中的 lockfile ===")
run('cd /www/wwwroot/BetterWrite && git ls-files pnpm-lock.yaml')
run('cd /www/wwwroot/BetterWrite && git check-ignore -v pnpm-lock.yaml 2>&1')

# Check actual file
print("\n=== 实际文件 ===")
run('ls -lh /www/wwwroot/BetterWrite/pnpm-lock.yaml')
run('file /www/wwwroot/BetterWrite/pnpm-lock.yaml')

# Try building with explicit context
print("\n=== 测试构建上下文大小 ===")
run('cd /www/wwwroot/BetterWrite && docker build --no-cache -f docker/Dockerfile.migrate -t test:latest . 2>&1 | grep -E "transferring context|ERROR|lockfile"', timeout=120)

ssh.close()
