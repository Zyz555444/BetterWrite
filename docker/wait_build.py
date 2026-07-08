import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=60)

def run(cmd, timeout=30):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    return stdout.read().decode(), stderr.read().decode()

# Check if docker is running
print("检查构建进度...")
for i in range(30):
    time.sleep(15)
    out, err = run('docker ps -a --filter "ancestor=node:24-alpine" --format "{{.Status}}"')
    if out.strip():
        print(f"[{i*15}s] 构建中...")
    else:
        print("构建已完成")
        break

# Check result
print("\n=== 构建结果 ===")
out, err = run('docker images')
print(out)

ssh.close()
