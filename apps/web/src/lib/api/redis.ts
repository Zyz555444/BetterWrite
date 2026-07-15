import { logger } from '@betterwrite/shared/logger';
import { Redis } from 'ioredis';

const redisLogger = logger.child({ component: 'redis' });
const redisUrl = process.env.REDIS_URL;

let redis: Redis | null = null;
let connectionFailed = false;

export function getRedis(): Redis | null {
  if (!redisUrl) return null;
  if (connectionFailed) return null;
  if (!redis) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    redis.on('error', (err) => {
      redisLogger.warn({ err }, '[Redis] connection error');
      connectionFailed = true;
    });
    redis.on('connect', () => {
      connectionFailed = false;
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