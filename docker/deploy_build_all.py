import paramiko
import time

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

# Step 1: Build worker image
print("=== Step 1: 构建 worker 镜像 ===")
run('cd /www/wwwroot/BetterWrite && docker build --no-cache -f docker/Dockerfile.worker -t betterwrite-worker:latest . 2>&1', timeout=600)

# Step 2: Build web image
print("\n=== Step 2: 构建 web 镜像 ===")
run('cd /www/wwwroot/BetterWrite && docker build --no-cache -f docker/Dockerfile.web -t betterwrite-web:latest . 2>&1', timeout=900)

# Step 3: Check all images
print("\n=== Step 3: 检查所有镜像 ===")
run('docker images')

ssh.close()
print("\n=== 构建完成 ===")
