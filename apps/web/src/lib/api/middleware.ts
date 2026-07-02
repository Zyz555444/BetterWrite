import { lucia } from '@/lib/auth';
import { type UserRoleType, hasRequiredRole } from '@betterwrite/shared';
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
  };
}

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
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
