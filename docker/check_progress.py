import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=60)

def run(cmd, timeout=30):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    return stdout.read().decode(), stderr.read().decode()

# Check docker build status
print("检查构建进度...")
for i in range(60):
    time.sleep(10)
    out, err = run('docker images | grep -E "betterwrite|REPOSITORY"')
    print(f"[{i*10}s]")
    if out:
        print(out)
    else:
        print("无镜像")
    
    # Check running containers
    out2, err2 = run('docker ps --format "{{.Names}}\t{{.Status}}"')
    if out2:
        print("运行中容器:")
        print(out2)
    
    # Check memory
    out3, err3 = run('free -m | grep Mem')
    if out3:
        print(f"内存: {out3.strip()}")

ssh.close()
