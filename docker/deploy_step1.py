import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

max_retries = 3
for i in range(max_retries):
    try:
        print(f"尝试连接 (第{i+1}次)...")
        ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=15)
        print("连接成功!")
        break
    except Exception as e:
        print(f"连接失败: {e}")
        if i < max_retries - 1:
            time.sleep(5)
        else:
            raise

def run(cmd, timeout=300):
    print(f'$ {cmd[:120]}...' if len(cmd) > 120 else f'$ {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out)
    if err: print(f'ERR: {err}')
    return out, err

# Step 1: Check SSH keys
print("=== Step 1: 检查 SSH key ===")
run('cat ~/.ssh/id_rsa.pub 2>/dev/null || echo "NO SSH KEY"')
run('cat ~/.ssh/id_ed25519.pub 2>/dev/null || echo "NO ED25519 KEY"')

# Step 2: Try cloning with HTTPS
print("\n=== Step 2: 尝试克隆仓库 ===")
run('rm -rf /www/wwwroot/BetterWrite && git clone https://github.com/Zyz555444/BetterWrite.git /www/wwwroot/BetterWrite --depth 1 2>&1')

# Step 3: Verify clone
print("\n=== Step 3: 验证克隆结果 ===")
run('ls -la /www/wwwroot/BetterWrite/ 2>&1')
run('cat /www/wwwroot/BetterWrite/.env.example 2>&1')

ssh.close()
print("\n=== 完成 ===")
