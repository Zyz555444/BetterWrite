import { logger } from '@betterwrite/shared/logger';
import { getRedis } from './redis';

const cacheLogger = logger.child({ component: 'cache' });

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<unknown>>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 60_000).unref();

export async function memoizeAsync<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(`cache:${key}`);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      cacheLogger.warn({ err }, '[Cache] Redis read failed');
    }
  }

  const existing = memoryStore.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) {
    return existing.value;
  }

  const value = await fn();

  if (redis) {
    try {
      await redis.setex(
        `cache:${key}`,
        Math.max(1, Math.ceil(ttlMs / 1000)),
        JSON.stringify(value),
      );
    } catch (err) {
      cacheLogger.warn({ err }, '[Cache] Redis write failed');
    }
  }

  memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidateCache(prefix: string): void {
  const redis = getRedis();
  if (redis) {
    redis
      .eval(
        "local keys = redis.call('keys', ARGV[1] .. '*')\nfor i=1,#keys,1 do\n  redis.call('del', keys[i])\nend\nreturn #keys",
        0,
        `cache:${prefix}`,
      )
      .catch((err) => cacheLogger.warn({ err }, '[Cache] Redis invalidation failed'));
  }

  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
    }
  }
}
