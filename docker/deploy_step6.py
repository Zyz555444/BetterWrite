import paramiko
import os

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

# Upload lockfile from local project
print("=== 上传 pnpm-lock.yaml ===")
local_lock = r'c:\Users\xy122\Documents\trae_projects\BetterWrite\pnpm-lock.yaml'
sftp = ssh.open_sftp()
sftp.put(local_lock, '/www/wwwroot/BetterWrite/pnpm-lock.yaml')
print(f"上传完成: {os.path.getsize(local_lock)} bytes")
sftp.close()

# Verify
run('ls -la /www/wwwroot/BetterWrite/pnpm-lock.yaml')
run('head -3 /www/wwwroot/BetterWrite/pnpm-lock.yaml')

# Check what docker sees in context
print("\n=== 检查构建上下文 ===")
run('cd /www/wwwroot/BetterWrite && docker buildx build --print=summary -f docker/Dockerfile.migrate . 2>&1 | head -20', timeout=30)

# Try building migrate
print("\n=== 构建 migrate 镜像 ===")
run('cd /www/wwwroot/BetterWrite && docker build -f docker/Dockerfile.migrate -t betterwrite-migrate:latest .', timeout=600)

ssh.close()
print("\n=== 完成 ===")
