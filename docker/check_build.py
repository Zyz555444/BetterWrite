import paramiko

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

# Check build log
print("=== 构建日志 ===")
run('cat /tmp/build.log 2>/dev/null | tail -50')

# Check images
print("\n=== 检查镜像 ===")
run('docker images')

# Check disk and memory
print("\n=== 系统状态 ===")
run('df -h /')
run('free -m')

ssh.close()
