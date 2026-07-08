import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=60)

def run(cmd, timeout=600):
    print(f'\n$ {cmd[:150]}...' if len(cmd) > 150 else f'\n$ {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out)
    if err: print(f'ERR: {err}')
    return out, err

# Verify files
print("=== 验证文件 ===")
run('ls -lh /www/wwwroot/BetterWrite/pnpm-lock.yaml')
run('head -5 /www/wwwroot/BetterWrite/docker/Dockerfile.migrate')

# Build migrate
print("\n=== 构建 migrate 镜像 ===")
run('cd /www/wwwroot/BetterWrite && docker build -f docker/Dockerfile.migrate -t betterwrite-migrate:latest . 2>&1', timeout=600)

# Check result
print("\n=== 检查镜像 ===")
run('docker images')

ssh.close()
