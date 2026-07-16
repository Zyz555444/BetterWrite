import { logger } from '@betterwrite/shared/logger';
import { Redis } from 'ioredis';

const redisLogger = logger.child({ component: 'redis' });
const redisUrl = process.env.REDIS_URL;

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!redisUrl) return null;
  if (!redis) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 200, 5_000),
    });
    redis.on('error', (err) => {
      // Bug #91: 之前错误后会置 connectionFailed=true 然后 getRedis() 永远返回 null，
      // 强制下游 fallback 到内存 store，导致分布式部署下 rate limit / cache 形同虚设。
      // 改为仅打日志，依赖 ioredis 自带 retryStrategy 在 background 重新连接，
      // 单次命令失败由调用方 try/catch 处理。client 始终存在。
      redisLogger.warn({ err: err instanceof Error ? err.message : String(err) }, '[Redis] error');
    });
  }
  return redis;
}

export async function pingRedis(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
