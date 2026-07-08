import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=10)

    commands = [
        ('检查/www/wwwroot目录', 'ls -la /www/wwwroot/'),
        ('检查Docker镜像', 'docker images'),
        ('检查运行中的容器', 'docker ps -a'),
        ('检查Node.js', 'node --version 2>&1; pnpm --version 2>&1'),
    ]

    for name, cmd in commands:
        print(f"\n=== {name} ===")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        output = stdout.read().decode()
        err = stderr.read().decode()
        if output:
            print(output)
        if err:
            print(f"ERR: {err}")

except Exception as e:
    print(f"连接失败: {e}")
finally:
    ssh.close()
