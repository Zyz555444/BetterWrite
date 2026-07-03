import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// 内存存储：适用于单实例部署（本项目使用 SQLite，天然单实例）。
// 若需多实例/容器化部署，应替换为 Redis 等外部共享存储。
const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 60_000).unref();

// 解析客户端真实 IP。
// 优先 x-real-ip（由可信反向代理设置）；对 x-forwarded-for 取最右侧条目
// （最接近服务端的一跳，由可信代理写入），而非客户端可控的最左侧条目，
// 避免攻击者伪造 X-Forwarded-For 绕过限流。
function resolveClientIp(headers: Record<string, string | undefined>): string {
  const xRealIp = headers['x-real-ip'];
  if (xRealIp) return xRealIp.trim();

  const xff = headers['x-forwarded-for'];
  if (xff) {
    const parts = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
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

    let entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      throw new HTTPException(429, {
        message: '请求过于频繁，请稍后再试',
      });
    }

    await next();

    // 在 next() 之后写入响应头，避免被下游 handler 覆盖。
    c.res.headers.set('X-RateLimit-Limit', String(maxRequests));
    c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    c.res.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  });
};
