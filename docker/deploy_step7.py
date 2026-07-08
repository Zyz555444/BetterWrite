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

# Upload modified Dockerfiles
print("=== 上传修改后的 Dockerfiles ===")
sftp = ssh.open_sftp()

dockerfiles = [
    (r'c:\Users\xy122\Documents\trae_projects\BetterWrite\docker\Dockerfile.migrate', '/www/wwwroot/BetterWrite/docker/Dockerfile.migrate'),
]

for local, remote in dockerfiles:
    sftp.put(local, remote)
    print(f"上传: {os.path.basename(local)}")

sftp.close()

# Verify lockfile exists
print("\n=== 验证 lockfile ===")
run('ls -lh /www/wwwroot/BetterWrite/pnpm-lock.yaml')
run('head -3 /www/wwwroot/BetterWrite/pnpm-lock.yaml')

# Check .dockerignore
print("\n=== 检查 .dockerignore ===")
run('cat /www/wwwroot/BetterWrite/.dockerignore | grep -i lock')

# Build migrate with no-cache
print("\n=== 构建 migrate 镜像 (no-cache) ===")
run('cd /www/wwwroot/BetterWrite && docker build --no-cache -f docker/Dockerfile.migrate -t betterwrite-migrate:latest . 2>&1 | tail -30', timeout=600)

ssh.close()
print("\n=== 完成 ===")
