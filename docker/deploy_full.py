import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

print("连接服务器...")
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=30)
print("SSH连接成功!")

def run(cmd, timeout=300):
    print(f'\n$ {cmd[:150]}...' if len(cmd) > 150 else f'\n$ {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out)
    if err: print(f'ERR: {err}')
    return out, err

# Step 1: 检查环境
print("=== Step 1: 检查服务器环境 ===")
run('uptime')
run('free -m')
run('df -h /')
run('docker --version')
run('docker compose version')
run('git --version')

# Step 2: 清理旧镜像释放空间
print("\n=== Step 2: 清理旧镜像 ===")
run('docker rmi betterwrite-migrate:latest betterwrite-worker:latest 2>/dev/null; echo done')

# Step 3: 克隆仓库
print("\n=== Step 3: 克隆 BetterWrite 仓库 ===")
run('rm -rf /www/wwwroot/BetterWrite && git clone https://github.com/Zyz555444/BetterWrite.git /www/wwwroot/BetterWrite --depth 1')

# Step 4: 验证克隆
print("\n=== Step 4: 验证 ===")
run('ls /www/wwwroot/BetterWrite/')
run('cat /www/wwwroot/BetterWrite/.env.production | head -30')

ssh.close()
print("\n=== 第一阶段完成 ===")
