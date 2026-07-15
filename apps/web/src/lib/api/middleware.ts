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
    await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, record.id));
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