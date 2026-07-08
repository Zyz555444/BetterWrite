import paramiko
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=10)

sftp = ssh.open_sftp()

# Create target directory
print("=== 创建目标目录 ===")
stdin, stdout, stderr = ssh.exec_command('mkdir -p /www/wwwroot/BetterWrite')
print(stdout.read().decode())

# Files to upload (relative to project root)
# We'll upload docker compose files, env, and dockerfiles first
project_root = r'c:\Users\xy122\Documents\trae_projects\BetterWrite'

files_to_upload = [
    ('docker/docker-compose.yml', '/www/wwwroot/BetterWrite/docker-compose.yml'),
    ('docker/docker-compose.lowmem.yml', '/www/wwwroot/BetterWrite/docker-compose.lowmem.yml'),
    ('docker/Dockerfile.web', '/www/wwwroot/BetterWrite/Dockerfile.web'),
    ('docker/Dockerfile.worker', '/www/wwwroot/BetterWrite/Dockerfile.worker'),
    ('docker/Dockerfile.migrate', '/www/wwwroot/BetterWrite/Dockerfile.migrate'),
    ('.env.production', '/www/wwwroot/BetterWrite/.env'),
]

for local_rel, remote_path in files_to_upload:
    local_path = os.path.join(project_root, local_rel)
    if os.path.exists(local_path):
        print(f"上传: {local_rel} -> {remote_path}")
        sftp.put(local_path, remote_path)
    else:
        print(f"跳过(不存在): {local_path}")

sftp.close()
ssh.close()
print("=== 上传完成 ===")
