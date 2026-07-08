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

# Check current state
print("=== 当前状态 ===")
run('docker images')
run('free -m')
run('df -h /')

# The issue: lockfile is 365KB but build context is only 5.44KB
# Let me try a different approach - install pnpm on server and build directly
print("\n=== 在服务器上直接构建 ===")
run('cd /www/wwwroot/BetterWrite && pnpm install --no-frozen-lockfile 2>&1 | tail -20', timeout=600)

# Verify install
print("\n=== 验证安装 ===")
run('cd /www/wwwroot/BetterWrite && pnpm list 2>&1 | head -10')

ssh.close()
