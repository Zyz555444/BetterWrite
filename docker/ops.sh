#!/bin/bash
# ============================================================
# BetterWrite 部署后运维脚本集 — /opt/betterwrite/scripts/
# ============================================================

cd /opt/betterwrite
ENV_FILE=".env.production"
COMPOSE="docker compose -f docker/docker-compose.yml -f docker/docker-compose.lowmem.yml --env-file $ENV_FILE"

case "$1" in
  status)
    echo "=== Containers ==="
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1
    echo
    echo "=== Resource usage ==="
    docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}" 2>&1
    echo
    echo "=== Health ==="
    for svc in redis web worker; do
      health=$(docker inspect --format='{{.State.Health.Status}}' betterwrite-$svc 2>/dev/null)
      echo "  $svc: ${health:-n/a}"
    done
    echo
    echo "=== Disk ==="
    df -h / | tail -1
    echo
    echo "=== Logs (last 20) ==="
    docker compose -f docker/docker-compose.yml -f docker/docker-compose.lowmem.yml --env-file $ENV_FILE logs --tail=20 2>&1
    ;;

  logs)
    service="${2:-web}"
    $COMPOSE logs -f --tail=100 $service
    ;;

  restart)
    service="${2:-}"
    if [ -z "$service" ]; then
      $COMPOSE restart
    else
      $COMPOSE restart $service
    fi
    ;;

  pull)
    # 拉取最新代码并重建
    git pull origin main 2>&1 || echo "Not a git repo or pull failed"
    $COMPOSE build
    $COMPOSE up -d
    ;;

  backup)
    # 备份 SQLite 数据库到 /opt/backups/
    mkdir -p /opt/backups
    dbfile=$(docker volume inspect betterwrite_sqlite-data --format='{{.Mountpoint}}' 2>/dev/null)/betterwrite.db
    if [ -f "$dbfile" ]; then
      cp "$dbfile" /opt/backups/betterwrite-$(date +%Y%m%d-%H%M%S).db
      echo "Backup saved: /opt/backups/betterwrite-$(date +%Y%m%d-%H%M%S).db"
      # 保留最近 7 份
      ls -t /opt/backups/betterwrite-*.db | tail -n +8 | xargs -r rm
    else
      echo "Database file not found at $dbfile"
    fi
    ;;

  migrate)
    $COMPOSE up migrate
    ;;

  seed)
    $COMPOSE --profile tools up seed
    ;;

  shell)
    service="${2:-web}"
    docker exec -it betterwrite-$service sh
    ;;

  *)
    echo "Usage: $0 {status|logs|restart|pull|backup|migrate|seed|shell} [service]"
    exit 1
    ;;
esac
