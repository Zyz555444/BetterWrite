import { lucia } from '@/lib/auth';
import { apiTokens, db } from '@betterwrite/db';
import { type UserRoleType, hasRequiredRole } from '@betterwrite/shared';
import { and, eq, gt } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { cookies } from 'next/headers';

export interface AuthVariables {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRoleType;
    schoolId: string | null;
    studentNo: string | null;
    avatarUrl: string | null;
    isActive: boolean;
  };
}

// Bug #219: 节流 lastUsedAt 写入阈值（5 分钟）。移动端高频请求（如每秒 1 次心跳
// / 自动同步）会触发 authMiddleware，每个请求都同步更新 lastUsedAt 字段相当于
// 每秒/每次都写一次 api_tokens 行，是无意义的 IO 浪费（lastUsedAt 只用于"最近活跃
// 设备"展示，分钟级精度已足够）。在 5 分钟内只写一次，显著降低 DB 写压力。
const LAST_USED_THROTTLE_MS = 5 * 60_000;
const lastUsedWriteCache = new Map<string, number>(); // tokenId -> lastWriteMs

// 周期性清理过期 tokenId 缓存，避免 map 随 token 增长无限膨胀。
setInterval(() => {
  const now = Date.now();
  for (const [key, lastWrite] of lastUsedWriteCache) {
    if (now - lastWrite > LAST_USED_THROTTLE_MS * 2) {
      lastUsedWriteCache.delete(key);
    }
  }
}, 10 * 60_000).unref();

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const now = new Date().toISOString();
    const record = await db.query.apiTokens.findFirst({
      where: and(eq(apiTokens.token, token), gt(apiTokens.expiresAt, now)),
      with: { user: true },
    });
    if (!record || !record.user || !record.user.isActive) {
      throw new HTTPException(401, { message: 'Token 无效或已过期' });
    }
    // Bug #219: 仅当 lastUsedAt 距今超过 5 分钟才写库；高频请求降为低频写。
    // 用 tokenId 作缓存 key（不是 token 全文，减少 map entry 体积）。
    const nowMs = Date.now();
    const lastWrite = lastUsedWriteCache.get(record.id) ?? 0;
    if (nowMs - lastWrite >= LAST_USED_THROTTLE_MS) {
      lastUsedWriteCache.set(record.id, nowMs);
      // fire-and-forget 写入；即便失败也不影响请求本身
      void db
        .update(apiTokens)
        .set({ lastUsedAt: now })
        .where(eq(apiTokens.id, record.id))
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[Auth] failed to update lastUsedAt', err);
        });
    }
    c.set('user', {
      id: record.user.id,
      email: record.user.email,
      name: record.user.name,
      role: record.user.role as UserRoleType,
      schoolId: record.user.schoolId,
      studentNo: record.user.studentNo,
      avatarUrl: record.user.avatarUrl,
      isActive: record.user.isActive,
    });
    await next();
    return;
  }

  const sessionId = (await cookies()).get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    throw new HTTPException(401, { message: '请先登录' });
  }

  const { user, session } = await lucia.validateSession(sessionId);

  if (session?.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    (await cookies()).set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  }
  if (!session) {
    const sessionCookie = lucia.createBlankSessionCookie();
    (await cookies()).set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    throw new HTTPException(401, { message: '登录已过期，请重新登录' });
  }

  if (!user) {
    throw new HTTPException(401, { message: '请先登录' });
  }

  // 已被管理员停用的用户即使 session 仍有效也禁止访问。
  if (!user.isActive) {
    await lucia.invalidateSession(session.id);
    throw new HTTPException(403, { message: '账号已停用，请联系管理员' });
  }

  c.set('user', user);
  await next();
});

export const requireRole = (...allowedRoles: UserRoleType[]) => {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: '请先登录' });
    }

    const hasRole = allowedRoles.some(
      (role) => user.role === role || hasRequiredRole(user.role, role),
    );
    if (!hasRole) {
      throw new HTTPException(403, { message: '权限不足' });
    }

    await next();
  });
};

export const requireActiveUser = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: '请先登录' });
  }
  await next();
});
