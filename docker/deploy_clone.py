import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=10)

def run(cmd, timeout=300):
    print(f'$ {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out)
    if err: print(f'ERR: {err}')
    return out, err

# Step 1: Clone repo
print("=== Step 1: 克隆 BetterWrite 仓库 ===")
run('rm -rf /www/wwwroot/BetterWrite && git clone https://github.com/Zyz555444/BetterWrite.git /www/wwwroot/BetterWrite --depth 1')

# Step 2: Setup .env
print("\n=== Step 2: 设置 .env 文件 ===")
run('cp /www/wwwroot/BetterWrite/.env /www/wwwroot/BetterWrite/.env.local 2>/dev/null; ls -la /www/wwwroot/BetterWrite/.env*')

# Step 3: Check docker compose files
print("\n=== Step 3: 检查 docker compose 文件 ===")
run('ls -la /www/wwwroot/BetterWrite/docker/docker-compose*.yml')

# Step 4: Build web image (worker and migrate already exist)
print("\n=== Step 4: 构建 web 镜像 ===")
run('cd /www/wwwroot/BetterWrite && docker build -f docker/Dockerfile.web -t betterwrite-web:latest .', timeout=600)

ssh.close()
