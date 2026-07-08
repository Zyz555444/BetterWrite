import paramiko

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

print("=== 系统状态 ===")
run('uptime; echo ---; free -m; echo ---; df -h /')

print("\n=== Docker 镜像 ===")
run('docker images')

print("\n=== 项目文件 ===")
run('ls -lh /www/wwwroot/BetterWrite/pnpm-lock.yaml')
run('ls -lh /www/wwwroot/BetterWrite/docker/Dockerfile.migrate')
run('head -12 /www/wwwroot/BetterWrite/docker/Dockerfile.migrate')

print("\n=== 构建日志 ===")
run('cat /tmp/build.log 2>/dev/null || echo "no build log"')

ssh.close()
