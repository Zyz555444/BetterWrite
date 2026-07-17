import { db, sessions, users } from '@betterwrite/db';
import type { UserRoleType } from '@betterwrite/shared';
import { logger } from '@betterwrite/shared/logger';
import { DrizzleSQLiteAdapter } from '@lucia-auth/adapter-drizzle';
import { Lucia } from 'lucia';
import { cookies } from 'next/headers';
import { cache } from 'react';

const adapter = new DrizzleSQLiteAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  },
  getUserAttributes: (attributes) => {
    return {
      id: attributes.id,
      email: attributes.email,
      name: attributes.name,
      role: attributes.role as UserRoleType,
      schoolId: attributes.schoolId,
      studentNo: attributes.studentNo,
      avatarUrl: attributes.avatarUrl,
      isActive: attributes.isActive,
    };
  },
});

// Bug #46: 统一导出 Lucia 的 session cookie 名称，避免在 middleware.ts 等地方硬编码
// "auth_session" 与 lucia 实际 cookie 名称不一致导致鉴权失效。
export const SESSION_COOKIE_NAME = lucia.sessionCookieName;

export const validateRequest = cache(async () => {
  const sessionId = (await cookies()).get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    return { user: null, session: null };
  }

  // Bug #262: 之前直接 await lucia.validateSession(sessionId) 无 try/catch，
  // 任意外部异常（DB 暂时性错误、Lucia adapter 抛错、malformed sessionId）都会
  // propagate 到 RSC，让整个页面渲染失败并把内部错误信息泄漏给前端。
  // 改为 try/catch：DB 错误时 fallback 到未登录（用户刷新即可），不向客户端泄漏。
  let result: Awaited<ReturnType<typeof lucia.validateSession>>;
  try {
    result = await lucia.validateSession(sessionId);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      '[Auth] validateSession threw, falling back to anonymous',
    );
    return { user: null, session: null };
  }
  try {
    if (result.session?.fresh) {
      const sessionCookie = lucia.createSessionCookie(result.session.id);
      (await cookies()).set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
    if (!result.session) {
      const sessionCookie = lucia.createBlankSessionCookie();
      (await cookies()).set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : 'unknown' },
      '[Auth] validateRequest cookie error',
    );
  }
  return result;
});

export type AuthUser = Awaited<ReturnType<typeof validateRequest>>['user'];

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      id: string;
      email: string;
      name: string;
      role: string;
      schoolId: string | null;
      studentNo: string | null;
      avatarUrl: string | null;
      isActive: boolean;
    };
  }
}
