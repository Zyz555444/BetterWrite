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

# Step 1: 清理旧镜像
print("=== Step 1: 清理旧镜像 ===")
run('docker rmi betterwrite-migrate:latest betterwrite-worker:latest 2>/dev/null; echo done')

# Step 2: 克隆仓库
print("\n=== Step 2: 克隆 BetterWrite 仓库 ===")
run('rm -rf /www/wwwroot/BetterWrite && git clone https://github.com/Zyz555444/BetterWrite.git /www/wwwroot/BetterWrite --depth 1')

# Step 3: 验证克隆
print("\n=== Step 3: 验证克隆 ===")
run('ls /www/wwwroot/BetterWrite/ | head -20')
run('cat /www/wwwroot/BetterWrite/.env.production | head -30')

# Step 4: 设置 .env
print("\n=== Step 4: 设置 .env 文件 ===")
run('cd /www/wwwroot/BetterWrite && cp .env.production .env')

ssh.close()
print("\n=== 第二阶段完成 ===")
