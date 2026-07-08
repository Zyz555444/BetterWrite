import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('103.79.186.155', username='root', password='Sz555444', timeout=10)

cmds = [
    ('所有docker镜像详情', 'docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.ID}}"'),
    ('检查web镜像', 'docker image inspect betterwrite-web:latest 2>&1 | head -5'),
    ('检查migrate镜像', 'docker image inspect betterwrite-migrate:latest 2>&1 | head -5'),
    ('检查worker镜像', 'docker image inspect betterwrite-worker:latest 2>&1 | head -5'),
    ('查看已上传文件', 'ls -la /www/wwwroot/BetterWrite/'),
    ('查看.env内容(脱敏)', 'grep -v SECRET /www/wwwroot/BetterWrite/.env | head -20'),
    ('检查git remote', 'cd /www/wwwroot/CodeZone && git remote -v 2>&1'),
    ('检查GitHub CLI', 'gh --version 2>&1'),
]

for name, cmd in cmds:
    print(f'\n=== {name} ===')
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(out)
    if err: print(f'ERR: {err}')

ssh.close()
