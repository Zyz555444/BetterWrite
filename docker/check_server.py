import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=10)
    print("SSH连接成功!")

    # 检查Docker
    stdin, stdout, stderr = ssh.exec_command('docker --version 2>&1; echo "==="; docker compose version 2>&1; echo "==="; ls /www/wwwroot/ 2>&1; echo "==="; df -h / 2>&1; echo "==="; free -m 2>&1')
    output = stdout.read().decode()
    print(output)

except Exception as e:
    print(f"连接失败: {e}")
finally:
    ssh.close()
