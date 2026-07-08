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

# Check context issue
run('ls -la /www/wwwroot/BetterWrite/pnpm-lock.yaml')
run('cd /www/wwwroot/BetterWrite && ls *.yaml *.yml')

# Try building with verbose context output
print('\n=== 尝试构建并查看上下文 ===')
run('cd /www/wwwroot/BetterWrite && docker build --no-cache -f docker/Dockerfile.migrate -t betterwrite-migrate:latest . 2>&1 | head -40', timeout=120)

ssh.close()
