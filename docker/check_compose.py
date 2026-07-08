import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=10)

    commands = [
        ('检查docker-compose文件', 'find /www/wwwroot -name "docker-compose*.yml" -o -name "docker-compose*.yaml" 2>/dev/null'),
        ('检查.env文件', 'find /www/wwwroot -name ".env*" 2>/dev/null'),
        ('检查项目结构', 'ls -la /www/wwwroot/CodeZone/ 2>/dev/null || echo "CodeZone目录不存在"'),
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
