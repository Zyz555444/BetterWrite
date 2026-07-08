import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=60)

def run_bg(cmd):
    """Run command in background, return immediately"""
    print(f'$ {cmd}')
    stdin, stdout, stderr = ssh.exec_command(f'nohup {cmd} > /tmp/build.log 2>&1 & echo $!')
    pid = stdout.read().decode().strip()
    print(f"PID: {pid}")
    return pid

def check_build(pid):
    """Check if build is still running"""
    stdin, stdout, stderr = ssh.exec_command(f'ps -p {pid} -o pid= 2>/dev/null')
    return stdout.read().decode().strip() == pid

def tail_log(lines=20):
    stdin, stdout, stderr = ssh.exec_command(f'tail -{lines} /tmp/build.log')
    return stdout.read().decode()

# Build migrate in background
print("=== 后台构建 migrate 镜像 ===")
pid = run_bg('cd /www/wwwroot/BetterWrite && docker build --no-cache -f docker/Dockerfile.migrate -t betterwrite-migrate:latest .')

# Poll for completion
print("等待构建完成...")
for i in range(60):
    time.sleep(10)
    if not check_build(pid):
        print(f"\n构建完成! (第{(i+1)*10}秒)")
        print(tail_log(30))
        break
    else:
        log = tail_log(5)
        if log.strip():
            print(f"[{i*10}s] {log.strip().split(chr(10))[-1]}")

# Check result
print("\n=== 构建结果 ===")
stdin, stdout, stderr = ssh.exec_command('docker images betterwrite-migrate')
print(stdout.read().decode())

ssh.close()
