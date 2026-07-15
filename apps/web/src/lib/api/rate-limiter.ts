import { logger } from '@betterwrite/shared/logger';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { getRedis } from './redis';

const rateLimitLogger = logger.child({ component: 'rate-limit' });

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 60_000).unref();

function resolveClientIp(headers: Record<string, string | undefined>): string {
  const xRealIp = headers['x-real-ip'];
  if (xRealIp) return xRealIp.trim();

  const xff = headers['x-forwarded-for'];
  if (xff) {
    const parts = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[0];
  }
  return '127.0.0.1';
}

export const rateLimit = (maxRequests = MAX_REQUESTS, windowMs = WINDOW_MS) => {
  return createMiddleware(async (c, next) => {
    const ip = resolveClientIp({
      'x-real-ip': c.req.header('x-real-ip'),
      'x-forwarded-for': c.req.header('x-forwarded-for'),
    });
    const key = `${c.req.routePath}:${ip}`;
    const now = Date.now();
    const resetAt = now + windowMs;

    const redis = getRedis();
    if (redis) {
      try {
        const count = await redis.incr(`rate_limit:${key}`);
        if (count === 1) {
          await redis.pexpire(`rate_limit:${key}`, windowMs);
        }
        if (count > maxRequests) {
          throw new HTTPException(429, { message: '请求过于频繁，请稍后再试' });
        }
        await next();
        c.res.headers.set('X-RateLimit-Limit', String(maxRequests));
        c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)));
        c.res.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
        return;
      } catch (err) {
        if (err instanceof HTTPException) throw err;
        rateLimitLogger.warn({ err }, '[RateLimit] Redis failed, falling back to memory');
      }
    }

    let entry = memoryStore.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt };
      memoryStore.set(key, entry);
    }
    entry.count++;

    if (entry.count > maxRequests) {
      throw new HTTPException(429, { message: '请求过于频繁，请稍后再试' });
    }

    await next();

    c.res.headers.set('X-RateLimit-Limit', String(maxRequests));
    c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    c.res.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  });
};