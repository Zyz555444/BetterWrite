import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=60)

def run(cmd, timeout=30):
    print(f'\n$ {cmd[:150]}...' if len(cmd) > 150 else f'\n$ {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out)
    if err: print(f'ERR: {err}')
    return out, err

print("=== 等待构建完成... ===")
target_images = ['betterwrite-migrate', 'betterwrite-worker', 'betterwrite-web']

for i in range(60):
    time.sleep(10)
    images, _ = run('docker images')
    
    missing = [img for img in target_images if img not in images]
    if not missing:
        print(f"\n所有镜像构建成功! (等待{(i+1)*10}秒)")
        run('docker images')
        run('docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"')
        break
    else:
        print(f"[{(i+1)*10}s] 等待中... 缺失: {', '.join(missing)}")

print("\n=== 系统状态 ===")
run('uptime')
run('free -m')
run('df -h /')

ssh.close()
