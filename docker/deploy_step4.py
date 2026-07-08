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

# Check if lockfile exists
print("=== 检查 lockfile ===")
run('ls -la /www/wwwroot/BetterWrite/pnpm-lock.yaml 2>&1')
run('cat /www/wwwroot/BetterWrite/.gitignore')
run('cat /www/wwwroot/BetterWrite/.dockerignore')

# Check git status
print("\n=== 检查 git 状态 ===")
run('cd /www/wwwroot/BetterWrite && git log --oneline -5')
run('cd /www/wwwroot/BetterWrite && git ls-files | grep lock')

ssh.close()
