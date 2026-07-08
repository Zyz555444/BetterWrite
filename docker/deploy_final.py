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

# Build web image
print("=== 构建 web 镜像 ===")
run('cd /www/wwwroot/BetterWrite && docker build --no-cache -f docker/Dockerfile.web -t betterwrite-web:latest .', timeout=600)

# Build worker image
print("\n=== 构建 worker 镜像 ===")
run('cd /www/wwwroot/BetterWrite && docker build --no-cache -f docker/Dockerfile.worker -t betterwrite-worker:latest .', timeout=600)

# Check images
print("\n=== 检查所有镜像 ===")
run('docker images')

# Start services
print("\n=== 启动服务 ===")
run('cd /www/wwwroot/BetterWrite && docker compose -f docker/docker-compose.yml -f docker/docker-compose.lowmem.yml up -d', timeout=120)

# Check containers
print("\n=== 检查容器状态 ===")
run('docker ps -a')

ssh.close()
print("\n=== 部署完成 ===")
