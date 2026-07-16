import { randomUUID } from 'node:crypto';
import { lucia } from '@/lib/auth';
import { decrypt, encrypt, maskKey } from '@/lib/crypto';
import {
  type GrammarResult,
  checkGrammar,
  getSynonyms,
  polishEssay,
  upgradeSentences,
} from '@betterwrite/ai';
import {
  achievements,
  aiConversations,
  announcements,
  apiCallLogs,
  apiConfigs,
  apiTokens,
  classEnrollments,
  classes,
  db,
  deviceTokens,
  errorBooks,
  essayDrafts,
  essayTasks,
  essays,
  practiceExercises,
  questionBank,
  schools,
  studentTags,
  teachingResources,
  users,
} from '@betterwrite/db';
import {
  AchievementTier,
  AiAssistantMode,
  ExerciseType,
  StudentTag,
  TeachingResourceType,
  UserRole,
  calculateAbilityRadar,
  calculateClassRank,
  calculateErrorStats,
  calculateProgressCurve,
  calculateScoreDistribution,
  checkAchievements,
  countWords,
} from '@betterwrite/shared';
import type {
  Achievement,
  AdminDashboardStats,
  AiAssistantResult,
  AiConversation,
  AnnouncementItem,
  ApiCallLogItem,
  ApiConfigItem,
  DailyQuote,
  ErrorBookGroup,
  EssayDraft,
  PracticeExercise,
  QuestionBankItem,
  SchoolStats,
  SchoolWithStats,
  StudentProgress,
} from '@betterwrite/shared';
import { DEDUCTION_RULES, SCORE_TIERS, SCORING_WEIGHTS } from '@betterwrite/shared';
import { env } from '@betterwrite/shared/env';
import { logger } from '@betterwrite/shared/logger';
import { performOcr } from '@betterwrite/worker';
import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { and, count, desc, eq, gt, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getAiRouter } from '../ai/router';
import { memoizeAsync } from './cache';
import { authMiddleware, requireRole } from './middleware';
import type { AuthVariables } from './middleware';
import { addCorrectionJob, correctionQueue } from './queue';
import { rateLimit } from './rate-limiter';
import { pingRedis } from './redis';

const app = new Hono<{ Variables: AuthVariables }>().basePath('/api');

const routesLogger = logger.child({ component: 'routes' });

// ========== CORS ==========
const allowedOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

app.use(
  '*',
  cors({
    origin: (origin) => {
      // 浏览器同域请求不携带 Origin 头，返回 null 表示不设置 CORS 头，不会拦截同域请求。
      if (!origin) return null;
      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
  }),
);

// ========== Error Handling ==========
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ success: false, error: err.message }, err.status);
  }
  routesLogger.error({ err }, 'API Error:');
  return c.json({ success: false, error: '服务器内部错误' }, 500);
});

app.notFound((c) => c.json({ success: false, error: '接口不存在' }, 404));

// ========== Access Control Helpers ==========
// 防止 IDOR：教师只能访问自己所教班级/学生，学校管理员只能访问本校数据。
type AuthUser = AuthVariables['user'];

async function assertClassAccess(user: AuthUser, classId: string): Promise<boolean> {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
  if (!cls) return false;
  if (user.role === UserRole.SCHOOL_ADMIN) return cls.schoolId === user.schoolId;
  if (user.role === UserRole.TEACHER) return cls.teacherId === user.id;
  return false;
}

async function assertStudentAccess(user: AuthUser, studentId: string): Promise<boolean> {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  const student = await db.query.users.findFirst({ where: eq(users.id, studentId) });
  if (!student) return false;
  if (user.role === UserRole.SCHOOL_ADMIN) return student.schoolId === user.schoolId;
  if (user.role === UserRole.TEACHER) {
    const enrollments = await db.query.classEnrollments.findMany({
      where: and(eq(classEnrollments.userId, studentId), eq(classEnrollments.role, 'student')),
      with: { class: true },
    });
    return enrollments.some((en) => en.class?.teacherId === user.id);
  }
  return false;
}

// Bug #109: 多个 endpoint 直接 Number(query ?? '50') 在传入 ?limit=abc 时得到 NaN，
// 会导致 DB 报错或被 LIMIT NaN 静默忽略。这里集中处理并兜底。
function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}
function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

// ========== Health ==========
app.get('/health', async (c) => {
  const timestamp = new Date().toISOString();
  let database: 'ok' | 'error' = 'ok';
  let redis: 'ok' | 'error' | 'disabled' = 'disabled';
  let queue: 'ok' | 'error' | 'disabled' = 'disabled';

  try {
    await db.query.users.findFirst({ columns: { id: true } });
  } catch (err) {
    logger.error({ err }, '[Health] Database check failed');
    database = 'error';
  }

  if (env.REDIS_URL) {
    const redisOk = await pingRedis();
    redis = redisOk ? 'ok' : 'error';

    if (correctionQueue && redis === 'ok') {
      try {
        await correctionQueue.count();
        queue = 'ok';
      } catch (err) {
        logger.error({ err }, '[Health] Queue check failed');
        queue = 'error';
      }
    } else if (correctionQueue) {
      queue = 'error';
    }
  }

  const ok =
    database === 'ok' &&
    (redis === 'ok' || redis === 'disabled') &&
    (queue === 'ok' || queue === 'disabled');
  return c.json({ status: ok ? 'ok' : 'error', timestamp, database, redis, queue }, ok ? 200 : 503);
});

// ========== Auth ==========
const loginSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(1, '请输入密码'),
});

// Bug #123: 渐进式登录失败锁定 —— 同一 email 在 15 分钟窗口内连续失败 5 次，
// 锁定 15 分钟，防止攻击者无限次尝试常见密码。
const LOGIN_FAIL_WINDOW_MS = 15 * 60_000;
const LOGIN_FAIL_THRESHOLD = 5;
const LOGIN_LOCKOUT_MS = 15 * 60_000;
interface LoginFailEntry {
  count: number;
  windowStart: number;
  lockedUntil: number;
}
const loginFailStore = new Map<string, LoginFailEntry>();

// 周期性清理过期记录，避免 map 无限增长。
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginFailStore) {
    if (entry.lockedUntil <= now && now - entry.windowStart > LOGIN_FAIL_WINDOW_MS) {
      loginFailStore.delete(key);
    }
  }
}, 5 * 60_000).unref();

function getLoginFailEntry(key: string): LoginFailEntry {
  const now = Date.now();
  let entry = loginFailStore.get(key);
  if (!entry || now - entry.windowStart > LOGIN_FAIL_WINDOW_MS) {
    entry = { count: 0, windowStart: now, lockedUntil: 0 };
    loginFailStore.set(key, entry);
  }
  return entry;
}

function isLoginLocked(key: string): { locked: true; retryAfterSec: number } | { locked: false } {
  const entry = loginFailStore.get(key);
  if (!entry || entry.lockedUntil === 0) return { locked: false };
  const now = Date.now();
  if (entry.lockedUntil > now) {
    return { locked: true, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { locked: false };
}

function recordLoginFailure(key: string): void {
  const entry = getLoginFailEntry(key);
  entry.count += 1;
  if (entry.count >= LOGIN_FAIL_THRESHOLD) {
    entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  }
}

function clearLoginFailures(key: string): void {
  loginFailStore.delete(key);
}

app.post('/auth/login', rateLimit(10, 60_000), zValidator('json', loginSchema), async (c) => {
  // Bug #55: 邮箱小写规范化；Bug #49: 在 db 查询前先做一次 bcrypt 假比对，保证
  // 即便用户不存在也走过一次 bcrypt cost，规避攻击者通过响应时差枚举有效邮箱。
  const raw = c.req.valid('json');
  const email = raw.email.toLowerCase().trim();
  const password = raw.password;

  // Bug #123: 渐进式锁定检查 —— 失败次数过多时直接返回 429，避免无限试错。
  const lockKey = `login:${email}`;
  const lockState = isLoginLocked(lockKey);
  if (lockState.locked) {
    return c.json(
      {
        success: false,
        error: `登录失败次数过多，请 ${Math.ceil(lockState.retryAfterSec / 60)} 分钟后再试`,
      },
      429,
      { 'Retry-After': String(lockState.retryAfterSec) },
    );
  }

  const DUMMY_HASH =
    '$2a$10$CwTycUXWue0Thq9StjUM0uJ8jG4dNiQB2nCsjC/9o7RXh2v7Z8g6u';
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const passwordValid = await bcrypt.compare(password, hashToCompare);

  if (!user || !user.isActive || !passwordValid) {
    // Bug #123: 同样记录失败次数，无论用户是否存在（让 attacker 无法用
    // "邮箱不存在" 与 "密码错误" 的差异推断有效账户）。
    recordLoginFailure(lockKey);
    return c.json({ success: false, error: '邮箱或密码错误' }, 401);
  }

  // 登录成功，清除失败计数。
  clearLoginFailures(lockKey);

  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);

  await db
    .update(users)
    .set({ lastLoginAt: new Date().toISOString() })
    .where(eq(users.id, user.id));

  return c.json(
    {
      success: true,
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
      },
    },
    200,
    {
      'Set-Cookie': sessionCookie.serialize(),
    },
  );
});

// Bug #126: 弱密码黑名单，常见弱密码必须拒绝（即便长度合规）。
const WEAK_PASSWORDS = new Set([
  'password',
  'password1',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty12',
  'qwerty123',
  'abc12345',
  'iloveyou1',
  'admin123',
  'welcome1',
  'monkey123',
  'football1',
  'letmein12',
  '1q2w3e4r',
  'sunshine1',
  'princess1',
  'betterwrite',
  'betterwrite1',
  'better1234',
]);

function assertNotWeakPassword(password: string): string | null {
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return '密码过于简单，请使用包含字母与数字的更强组合';
  }
  // 必须同时包含字母与数字
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return '密码必须同时包含字母与数字';
  }
  return null;
}

const registerSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少8位'),
  // Bug #121: 限长 + 过滤控制字符，避免 XSS 向量与排版错乱；后续会再过一道 DOMPurify。
  name: z
    .string()
    .min(1, '请输入姓名')
    .max(100, '姓名过长')
    .regex(/^[^\u0000-\u001f\u007f]+$/, '姓名包含非法控制字符'),
  // Bug #44: 仅允许注册学生角色；教师/学校管理员必须由 super_admin 后台创建，
  // 防止任何人通过公开注册接口越权获取教师身份。
  role: z.literal(UserRole.STUDENT).default(UserRole.STUDENT),
  schoolCode: z.string().optional(),
  classCode: z.string().optional(),
});

app.post('/auth/register', rateLimit(5, 60_000), zValidator('json', registerSchema), async (c) => {
  // Bug #55: 邮箱小写规范化，避免 "User@x.com" 和 "user@x.com" 视为不同账号。
  const raw = c.req.valid('json');
  const { password, name, role, schoolCode, classCode } = raw;
  const email = raw.email.toLowerCase().trim();

  // Bug #126: 弱密码黑名单
  const weakErr = assertNotWeakPassword(password);
  if (weakErr) {
    return c.json({ success: false, error: weakErr }, 400);
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return c.json({ success: false, error: '该邮箱已被注册' }, 409);
  }

  const now = new Date().toISOString();
  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  let schoolId: string | null = null;
  if (schoolCode) {
    // Bug #128 + #129: 之前 schoolCode 任意值都被静默忽略，导致：
    // 1) 用户以为已加入学校，实际孤儿用户
    // 2) 停用学校（isActive=false）仍能被人注册进去
    // 改为：先按 code（统一大写）查学校；不存在/停用/未传 classCode 但 class 找不到都返回 400。
    const normalizedCode = schoolCode.trim().toUpperCase();
    const school = await db.query.schools.findFirst({
      where: eq(schools.code, normalizedCode),
      columns: { id: true, isActive: true },
    });
    if (!school) {
      return c.json({ success: false, error: '学校代码不存在' }, 400);
    }
    if (!school.isActive) {
      return c.json({ success: false, error: '学校已停用，无法注册' }, 400);
    }
    schoolId = school.id;
  }

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    name,
    role,
    schoolId,
    createdAt: now,
    updatedAt: now,
  });

  if (classCode && schoolId) {
    const classRecord = await db.query.classes.findFirst({
      where: and(eq(classes.code, classCode), eq(classes.schoolId, schoolId)),
    });
    if (classRecord) {
      await db.insert(classEnrollments).values({
        id: randomUUID(),
        classId: classRecord.id,
        userId,
        role: role === UserRole.TEACHER ? 'teacher' : 'student',
        createdAt: now,
      });
    }
  }

  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);

  return c.json(
    {
      success: true,
      data: {
        userId,
        name,
        email,
        role,
        schoolId,
      },
    },
    201,
    {
      'Set-Cookie': sessionCookie.serialize(),
    },
  );
});

// Bug #192: /auth/logout 无 rateLimit，被登录状态可被刷废 DB session 表 + 写日志风暴。
// 限制 10/min + 50/day（正常用户不会一天登出 50 次）。
app.post(
  '/auth/logout',
  rateLimit(10, 60_000),
  rateLimit(50, 24 * 60 * 60_000),
  authMiddleware,
  async (c) => {
    // Bug #53: 用 lucia.readSessionCookie 解析 cookie header，避免自己写 regex 漏掉
    // URL 编码、引号、空格等边界情况。
    const cookieHeader = c.req.header('cookie');
    const sessionId = lucia.readSessionCookie(cookieHeader ?? '');
    if (sessionId) {
      await lucia.invalidateSession(sessionId);
    }
    const sessionCookie = lucia.createBlankSessionCookie();
    return c.json({ success: true }, 200, {
      'Set-Cookie': sessionCookie.serialize(),
    });
  },
);

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(8, '新密码至少8位'),
});

app.put(
  '/auth/password',
  authMiddleware,
  rateLimit(5, 60_000),
  zValidator('json', passwordChangeSchema),
  async (c) => {
    const user = c.get('user');
    const { currentPassword, newPassword } = c.req.valid('json');
    routesLogger.info({ userId: user.id }, '[API PUT /auth/password]');

    // Bug #158: 改密路径在三种情况下响应时长差异巨大（无 record 立即返 / 记录存在但旧密码错 / 旧密码对），
    // 攻击者通过响应时差可推断"旧密码是否正确"，进而把改密端点当成"密码验证"端点爆破。
    // 修复：统一走一次 DUMMY_HASH bcrypt（不存在/禁用时）+ 不匹配时再做一次假 hash 抵消 hash(newPassword) 的耗时，
    // 使三条分支的响应时长大致一致。
    const DUMMY_HASH =
      '$2a$10$CwTycUXWue0Thq9StjUM0uJ8jG4dNiQB2nCsjC/9o7RXh2v7Z8g6u';

    const record = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { id: true, passwordHash: true, isActive: true },
    });
    const hashToCompare = record?.isActive ? record.passwordHash : DUMMY_HASH;
    const valid = await bcrypt.compare(currentPassword, hashToCompare);
    if (!record || !record.isActive) {
      return c.json({ success: false, error: '用户不存在或已禁用' }, 401);
    }
    if (!valid) {
      routesLogger.warn({ userId: user.id }, '[API PUT /auth/password] current password mismatch');
      // 与成功路径对齐：成功后会有一次 bcrypt.hash(newPassword)，此处做一次假 hash 抵消时差。
      await bcrypt.compare(currentPassword, DUMMY_HASH);
      return c.json({ success: false, error: '当前密码错误' }, 401);
    }

    if (currentPassword === newPassword) {
      return c.json({ success: false, error: '新密码不能与当前密码相同' }, 400);
    }

    // Bug #126: 改密也走弱密码校验
    const weakErr = assertNotWeakPassword(newPassword);
    if (weakErr) {
      return c.json({ success: false, error: weakErr }, 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();
    await db.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, user.id));

    // Bug #45: 改密后立刻失效该用户的所有 session（保留当前 session），
    // 避免旧密码仍在其它设备/浏览器生效时被中间人/盗号利用。
    await lucia.invalidateUserSessions(user.id);
    // 当前 session 被上面的方法一并失效，重新创建一个新的 session。
    const newSession = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(newSession.id);

    routesLogger.info({ userId: user.id }, '[API PUT /auth/password] password updated');
    return c.json(
      { success: true },
      200,
      { 'Set-Cookie': sessionCookie.serialize() },
    );
  },
);

app.get('/auth/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    },
  });
});

// ========== Mobile Auth (Bearer Token) ==========
const tokenLoginSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(1, '请输入密码'),
  platform: z.enum(['ios', 'android']),
  deviceName: z.string().optional(),
});

app.post(
  '/auth/token',
  // Bug #131: 移动端 token 登录的限流比 /auth/login 宽松（10/min），对移动端
  // 攻击者相当于绕过；收紧到 5/min + 30/day，与 /auth/login 一致。
  rateLimit(5, 60_000),
  rateLimit(30, 24 * 60 * 60_000),
  zValidator('json', tokenLoginSchema),
  async (c) => {
    // Bug #55: 邮箱小写规范化；Bug #49: 假用户不存在时也走一次 bcrypt 假比对，
    // 让响应时长不可用于枚举有效邮箱。
    const raw = c.req.valid('json');
    const { platform, deviceName } = raw;
    const email = raw.email.toLowerCase().trim();
    const password = raw.password;
    routesLogger.info({ email: email, platform: platform }, '[API /auth/token]');

    // Bug #130: 移动端 token 登录必须复用 #123 渐进式锁定，否则攻击者只需
    // 切换到 /auth/token 即可绕过对 /auth/login 的失败计数。
    const lockKey = `login:${email}`;
    const lockState = isLoginLocked(lockKey);
    if (lockState.locked) {
      return c.json(
        {
          success: false,
          error: `登录失败次数过多，请 ${Math.ceil(lockState.retryAfterSec / 60)} 分钟后再试`,
        },
        429,
        { 'Retry-After': String(lockState.retryAfterSec) },
      );
    }

    const DUMMY_HASH =
      '$2a$10$CwTycUXWue0Thq9StjUM0uJ8jG4dNiQB2nCsjC/9o7RXh2v7Z8g6u';
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const passwordValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.isActive || !passwordValid) {
      // Bug #130: 同样记录失败次数，统一与 /auth/login 的失败窗口合并。
      recordLoginFailure(lockKey);
      return c.json({ success: false, error: '邮箱或密码错误' }, 401);
    }
    clearLoginFailures(lockKey);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const token = randomUUID();

    await db.insert(apiTokens).values({
      id: randomUUID(),
      userId: user.id,
      token,
      platform,
      deviceName: deviceName ?? null,
      expiresAt,
      lastUsedAt: now,
      createdAt: now,
    });

    await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, user.id));

    routesLogger.info({ userId: user.id }, '[API /auth/token] login success');
    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
        },
      },
    });
  },
);

app.get('/auth/tokens', authMiddleware, async (c) => {
  const user = c.get('user');
  routesLogger.info({ userId: user.id }, '[API /auth/tokens]');
  const list = await db.query.apiTokens.findMany({
    where: and(eq(apiTokens.userId, user.id), gt(apiTokens.expiresAt, new Date().toISOString())),
    columns: {
      id: true,
      platform: true,
      deviceName: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: desc(apiTokens.createdAt),
  });
  return c.json({ success: true, data: list });
});

// Bug #161: /auth/tokens 只读，无法注销。设备丢失/离职时用户必须能撤销自己的 token。
// 仅允许撤销自己 userId 下的 token，避免越权。
app.delete('/auth/tokens/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  routesLogger.info({ userId: user.id, id: id }, '[API DELETE /auth/tokens/:id]');
  const deleted = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id)))
    .returning({ id: apiTokens.id });
  if (deleted.length === 0) {
    return c.json({ success: false, error: 'Token 不存在或无权操作' }, 404);
  }
  return c.json({ success: true });
});

const deviceTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

app.post('/auth/device-token', authMiddleware, zValidator('json', deviceTokenSchema), async (c) => {
  const user = c.get('user');
  const { token, platform } = c.req.valid('json');
  routesLogger.info({ userId: user.id, platform: platform }, '[API /auth/device-token]');
  const now = new Date().toISOString();

  const existing = await db.query.deviceTokens.findFirst({
    where: and(eq(deviceTokens.userId, user.id), eq(deviceTokens.token, token)),
  });

  if (existing) {
    await db.update(deviceTokens).set({ updatedAt: now }).where(eq(deviceTokens.id, existing.id));
  } else {
    await db.insert(deviceTokens).values({
      id: randomUUID(),
      userId: user.id,
      token,
      platform,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({ success: true });
});

// ========== OCR ==========
// Next.js App Router API route body 上限 ~4.5MB；base64 膨胀约 4/3，限制为 4MB base64 ≈ 3MB 原图。
const MAX_OCR_BASE64_BYTES = 4 * 1024 * 1024;
const ocrSchema = z.object({
  imageBase64: z
    .string()
    .min(1)
    .max(MAX_OCR_BASE64_BYTES, '图片过大，请小于 4MB（base64 编码后）'),
  taskId: z.string().optional(),
});

app.post(
  '/essays/ocr',
  // Bug #54: 学生无限制调用 OCR 会消耗 Google Vision 配额/触发额外费用，
  // 加一层 10/min + 200/day 的 rate limit。
  rateLimit(10, 60_000),
  rateLimit(200, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', ocrSchema),
  async (c) => {
    const user = c.get('user');
    const { imageBase64, taskId } = c.req.valid('json');
    routesLogger.info({ userId: user.id, taskId: taskId ?? 'none' }, '[API /essays/ocr]');

    try {
      const result = await performOcr(imageBase64);
      routesLogger.info(
        { userId: user.id, confidence: result.confidence, contentLength: result.content.length },
        '[API /essays/ocr]',
      );
      return c.json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      routesLogger.error({ userId: user.id, err: message }, '[API /essays/ocr] error');
      // Bug #7: OCR 未配置时返回 503，让前端能区分"服务未配置"和"调用失败"
      if (message.includes('OCR 服务未配置')) {
        return c.json(
          { success: false, error: 'OCR 服务暂未配置，请联系管理员' },
          503,
        );
      }
      return c.json({ success: false, error: 'OCR 识别失败' }, 500);
    }
  },
);

// ========== Notifications ==========
app.post(
  '/notifications/test',
  // Bug #133: 测试推送无 rateLimit，攻击者可点爆 Expo 推送配额/被计费。
  // 限制 3/min + 20/day。
  rateLimit(3, 60_000),
  rateLimit(20, 24 * 60 * 60_000),
  authMiddleware,
  async (c) => {
    const user = c.get('user');
    routesLogger.info({ userId: user.id }, '[API /notifications/test]');

    const tokens = await db.query.deviceTokens.findMany({
      where: eq(deviceTokens.userId, user.id),
    });

    if (tokens.length === 0) {
      return c.json({ success: false, error: '未注册推送设备' }, 400);
    }

    const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;
    if (!expoAccessToken) {
      return c.json({ success: false, error: '推送服务未配置' }, 503);
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      title: 'BetterWrite 测试推送',
      body: '这是一条测试推送通知',
      sound: 'default' as const,
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expoAccessToken}`,
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      routesLogger.error({ status: res.status }, '[API /notifications/test] push failed');
      return c.json({ success: false, error: '推送发送失败' }, 500);
    }

    routesLogger.info({ userId: user.id, sent: messages.length }, '[API /notifications/test]');
    return c.json({ success: true, data: { sent: messages.length } });
  },
);

// ========== Essays ==========
// 作文内容最大 50KB（远超过正常 200 词作文的 1KB 上限，足够覆盖附件/格式但拦截 DoS）。
const MAX_ESSAY_CONTENT_BYTES = 50 * 1024;
const essaySchema = z.object({
  content: z
    .string()
    .min(1, '作文内容不能为空')
    .max(MAX_ESSAY_CONTENT_BYTES, '作文内容过长，请控制在 50KB 以内'),
  taskId: z.string().optional(),
  title: z.string().max(200, '标题过长').optional(),
});

app.post(
  '/essays',
  // Bug #156: 作文提交无 rateLimit；学生可短时间刷大量作文挤爆 BullMQ + OpenAI 配额 + DB。
  // 限制 10/min + 50/day（每篇都触发 AI 批改，开销大）。
  rateLimit(10, 60_000),
  rateLimit(50, 24 * 60 * 60_000),
  authMiddleware,
  zValidator('json', essaySchema),
  async (c) => {
    const user = c.get('user');
    const { content, taskId, title } = c.req.valid('json');
    const wordCount = countWords(content);
    const now = new Date().toISOString();
    const essayId = randomUUID();

    if (taskId) {
      const task = await db.query.essayTasks.findFirst({ where: eq(essayTasks.id, taskId) });
      if (!task) {
        return c.json({ success: false, error: '作文任务不存在' }, 404);
      }
      const enrolled = await db.query.classEnrollments.findFirst({
        where: and(
          eq(classEnrollments.classId, task.classId),
          eq(classEnrollments.userId, user.id),
        ),
      });
      if (!enrolled) {
        return c.json({ success: false, error: '无权提交该任务' }, 403);
      }
      // 服务端字数范围校验（Bug #3 修复）：未达下限或超出上限均拒绝提交，避免无效批改。
      if (wordCount < task.wordLimitMin) {
        return c.json(
          { success: false, error: `作文字数不足，最少需要 ${task.wordLimitMin} 词` },
          400,
        );
      }
      if (wordCount > task.wordLimitMax) {
        return c.json(
          { success: false, error: `作文超出字数上限，最多 ${task.wordLimitMax} 词` },
          400,
        );
      }
    }

    const [essay] = await db
      .insert(essays)
      .values({
        id: essayId,
        studentId: user.id,
        taskId: taskId ?? null,
        title: title ?? null,
        content,
        wordCount,
        status: 'pending',
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // 修复 Bug #26：先入队成功再提交 essay，避免 Redis 不可用时留下永远 pending 的孤儿数据。
    // 反之若先 INSERT essay，再 addCorrectionJob 抛错，essay 已被持久化却永远不会被批改。
    await addCorrectionJob(essayId);

    return c.json({ success: true, data: essay });
  },
);

// 失败作文重试接口（Bug #6 修复）：允许学生 / 老师对 status='failed' 的作文重新入队。
app.post(
  '/essays/:id/retry',
  // Bug #57: 之前无 rateLimit，学生可以反复点 retry 把 worker 队列塞满；
  // 限制每用户 5/min + 30/day，避免滥用。
  rateLimit(5, 60_000),
  rateLimit(30, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.STUDENT, UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const start = Date.now();
    routesLogger.info({ userId: user.id, essayId: id }, '[API /essays/:id/retry]');

    const essay = await db.query.essays.findFirst({
      where: eq(essays.id, id),
      with: { student: { columns: { id: true, schoolId: true } } },
    });
    if (!essay) return c.json({ success: false, error: '作文不存在' }, 404);

    // Bug #162: 之前对 SCHOOL_ADMIN 走无条件 `user.role === UserRole.SCHOOL_ADMIN` 分支，
    // 跨校可重试任意作文。改为统一走"owner OR super_admin OR (school_admin && same school) OR (teacher && has class)"。
    const canAccess =
      essay.studentId === user.id ||
      user.role === UserRole.SUPER_ADMIN ||
      (user.role === UserRole.SCHOOL_ADMIN && essay.student?.schoolId === user.schoolId) ||
      (user.role === UserRole.TEACHER && (await assertStudentAccess(user, essay.studentId)));
    if (!canAccess) {
      return c.json({ success: false, error: '无权操作该作文' }, 403);
    }

    if (essay.status !== 'failed') {
      return c.json(
        { success: false, error: `仅失败作文可重试，当前状态：${essay.status}` },
        400,
      );
    }

    // Bug #141: 之前先 read 再 write 无原子保证，并发两次 retry 都会读到 'failed'
    // 然后都入队，导致同一篇作文在 worker 队列里出现两次。
    // 改为：UPDATE 仅在 status='failed' 时才落 status='pending'，影响 0 行说明
    // 被并发抢占，立即放弃入队。
    const now = new Date().toISOString();
    const claim = await db
      .update(essays)
      .set({ status: 'pending', updatedAt: now, correctedAt: null })
      .where(and(eq(essays.id, id), eq(essays.status, 'failed')))
      .returning({ id: essays.id });

    if (claim.length === 0) {
      return c.json(
        { success: false, error: '该作文已被其他操作重试或状态已变更' },
        409,
      );
    }

    await addCorrectionJob(id);

    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, essayId: id, duration: duration },
      '[API /essays/:id/retry]',
    );
    return c.json({ success: true });
  },
);

app.get('/essays/my', authMiddleware, async (c) => {
  const user = c.get('user');
  const list = await db.query.essays.findMany({
    where: eq(essays.studentId, user.id),
    orderBy: desc(essays.createdAt),
    limit: 50,
    with: { correction: true },
  });
  return c.json({ success: true, data: list });
});

app.get('/essays/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  routesLogger.info({ userId: user.id, role: user.role, essayId: id }, '[API /essays/:id]');
  const essay = await db.query.essays.findFirst({
    where: eq(essays.id, id),
    with: { correction: true, student: { columns: { id: true, schoolId: true } }, task: true },
  });
  if (!essay) return c.json({ success: false, error: 'Not found' }, 404);

  // Bug #162: 之前对 SCHOOL_ADMIN 走无条件 `user.role === UserRole.SCHOOL_ADMIN` 分支，
  // 跨校可查看任意学生的作文（含批改内容）。改为与 /essays/:id/review 一致：
  // SCHOOL_ADMIN 必须同校。Teacher 走 assertStudentAccess（校验所教班级）。
  const canAccess =
    essay.studentId === user.id ||
    user.role === UserRole.SUPER_ADMIN ||
    (user.role === UserRole.SCHOOL_ADMIN && essay.student?.schoolId === user.schoolId) ||
    (user.role === UserRole.TEACHER && (await assertStudentAccess(user, essay.studentId)));

  if (!canAccess) {
    routesLogger.warn({ userId: user.id, essayId: id }, '[API /essays/:id] access denied');
    return c.json({ success: false, error: '无权查看' }, 403);
  }

  routesLogger.info({ userId: user.id, essayId: id }, '[API /essays/:id] access granted');
  return c.json({ success: true, data: essay });
});

app.get('/essays/:id/correction', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  routesLogger.info(
    { userId: user.id, role: user.role, essayId: id },
    '[API /essays/:id/correction]',
  );
  const essay = await db.query.essays.findFirst({
    where: eq(essays.id, id),
    with: { correction: true, student: { columns: { id: true, schoolId: true } } },
  });
  if (!essay) {
    routesLogger.warn({ id: id }, '[API /essays/:id/correction] essay not found');
    return c.json({ success: false, error: 'Not found' }, 404);
  }

  // Bug #162: 同样的跨校 IDOR 修复，与 /essays/:id 一致。
  const canAccess =
    essay.studentId === user.id ||
    user.role === UserRole.SUPER_ADMIN ||
    (user.role === UserRole.SCHOOL_ADMIN && essay.student?.schoolId === user.schoolId) ||
    (user.role === UserRole.TEACHER && (await assertStudentAccess(user, essay.studentId)));

  if (!canAccess) {
    routesLogger.warn(
      { userId: user.id, essayId: id },
      '[API /essays/:id/correction] access denied',
    );
    return c.json({ success: false, error: '无权查看' }, 403);
  }

  if (!essay.correction) {
    routesLogger.info({ essayId: id }, '[API /essays/:id/correction] no correction yet');
    return c.json({ success: false, error: '批改结果尚未生成' }, 404);
  }

  routesLogger.info({ essayId: id }, '[API /essays/:id/correction] returning correction');
  return c.json({ success: true, data: essay.correction });
});

const essayReviewSchema = z
  .object({
    teacherReview: z.string().min(1, '评语不能为空').max(2000, '评语过长').optional(),
    // 作文满分 15 分；教师评分应在此区间（Bug #4 修复）。
    teacherScore: z.number().min(0, '分数不能小于0').max(15, '分数不能大于15').optional(),
  })
  .refine((d) => d.teacherReview !== undefined || d.teacherScore !== undefined, {
    message: '至少需要提供评语或分数',
  });

app.put(
  '/essays/:id/review',
  // Bug #199: 教师复核作文无 rateLimit，可被脚本反复触发写库。
  rateLimit(30, 60_000),
  rateLimit(500, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  zValidator('json', essayReviewSchema),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const { teacherReview, teacherScore } = c.req.valid('json');
    routesLogger.info(
      {
        userId: user.id,
        role: user.role,
        essayId: id,
        hasReview: teacherReview !== undefined,
        hasScore: teacherScore !== undefined,
      },
      '[API PUT /essays/:id/review]',
    );

    const essay = await db.query.essays.findFirst({
      where: eq(essays.id, id),
      with: { student: { columns: { id: true, schoolId: true } } },
    });
    if (!essay) {
      routesLogger.warn({ essayId: id }, '[API PUT /essays/:id/review] essay not found');
      return c.json({ success: false, error: '作文不存在' }, 404);
    }

    const canAccess =
      user.role === UserRole.SUPER_ADMIN ||
      (user.role === UserRole.SCHOOL_ADMIN && essay.student?.schoolId === user.schoolId) ||
      (user.role === UserRole.TEACHER && (await assertStudentAccess(user, essay.studentId)));

    if (!canAccess) {
      routesLogger.warn(
        { userId: user.id, essayId: id, role: user.role },
        '[API PUT /essays/:id/review] access denied',
      );
      return c.json({ success: false, error: '无权复核该作文' }, 403);
    }

    const now = new Date().toISOString();
    const [updated] = await db
      .update(essays)
      .set({
        ...(teacherReview !== undefined ? { teacherReview } : {}),
        ...(teacherScore !== undefined ? { teacherScore } : {}),
        updatedAt: now,
      })
      .where(eq(essays.id, id))
      .returning();

    routesLogger.info({ essayId: id }, '[API PUT /essays/:id/review] review saved');
    return c.json({ success: true, data: updated });
  },
);

app.get(
  '/essays',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    routesLogger.info({ userId: user.id, role: user.role }, '[API /essays]');
    let conditions: SQL[] = [];

    if (user.role === UserRole.TEACHER && user.schoolId) {
      const classIds = await db.query.classes.findMany({
        where: eq(classes.teacherId, user.id),
        columns: { id: true },
      });
      const ids = classIds.map((c) => c.id);
      if (ids.length === 0) {
        return c.json({ success: true, data: [] });
      }
      const enrollments = await db.query.classEnrollments.findMany({
        where: inArray(classEnrollments.classId, ids),
        columns: { userId: true },
      });
      const studentIds = enrollments.map((e) => e.userId);
      if (studentIds.length === 0) {
        return c.json({ success: true, data: [] });
      }
      conditions = studentIds.map((id) => eq(essays.studentId, id));
    } else if (user.role === UserRole.SCHOOL_ADMIN && user.schoolId) {
      // Bug #47: 之前 SCHOOL_ADMIN 完全没有范围过滤，会读到全校/所有学校的作文；
      // 改为通过 schoolId 过滤 users → essays。
      const schoolStudents = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.schoolId, user.schoolId), eq(users.role, UserRole.STUDENT)));
      const studentIds = schoolStudents.map((s) => s.id);
      if (studentIds.length === 0) {
        return c.json({ success: true, data: [] });
      }
      conditions = [inArray(essays.studentId, studentIds)];
    }

    const all = await db.query.essays.findMany({
      where: conditions ? and(...conditions) : undefined,
      orderBy: desc(essays.createdAt),
      limit: 100,
      with: { student: { columns: { id: true, name: true, studentNo: true } }, correction: true },
    });
    routesLogger.info({ userId: user.id, returning: all.length }, '[API /essays]');
    return c.json({ success: true, data: all });
  },
);

// ========== Tasks ==========
app.get('/tasks', authMiddleware, async (c) => {
  const user = c.get('user');
  routesLogger.info({ userId: user.id, role: user.role }, '[API /tasks]');
  let list: (typeof essayTasks.$inferSelect)[];

  if (user.role === UserRole.STUDENT) {
    const enrollments = await db.query.classEnrollments.findMany({
      where: eq(classEnrollments.userId, user.id),
      columns: { classId: true },
    });
    const classIds = enrollments.map((e) => e.classId);
    list = await db.query.essayTasks.findMany({
      where:
        classIds.length > 0
          ? and(inArray(essayTasks.classId, classIds), eq(essayTasks.status, 'published'))
          : undefined,
      orderBy: desc(essayTasks.createdAt),
      limit: 50,
    });
  } else {
    list = await db.query.essayTasks.findMany({
      orderBy: desc(essayTasks.createdAt),
      limit: 50,
    });
  }

  routesLogger.info({ userId: user.id, returning: list.length }, '[API /tasks]');
  return c.json({ success: true, data: list });
});

app.get('/tasks/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const task = await db.query.essayTasks.findFirst({ where: eq(essayTasks.id, id) });
  if (!task) return c.json({ success: false, error: 'Not found' }, 404);
  // 学生只能查看自己所在班级的任务；教师/管理员需有该班级访问权。
  if (user.role === UserRole.STUDENT) {
    const enrolled = await db.query.classEnrollments.findFirst({
      where: and(eq(classEnrollments.classId, task.classId), eq(classEnrollments.userId, user.id)),
    });
    if (!enrolled) return c.json({ success: false, error: '无权访问' }, 403);
  } else if (!(await assertClassAccess(user, task.classId))) {
    return c.json({ success: false, error: '无权访问' }, 403);
  }
  return c.json({ success: true, data: task });
});

const taskSchema = z
  .object({
    title: z.string().min(1, '请输入标题'),
    topicType: z.string().min(1, '请选择体裁'),
    requirements: z.string().min(1, '请输入要求'),
    keyPoints: z.array(z.string()).default([]),
    classId: z.string().min(1, '请选择班级'),
    wordLimitMin: z.number().int().min(20).max(500).default(80),
    wordLimitMax: z.number().int().min(20).max(500).default(125),
    dueDate: z.string().optional(),
  })
  .refine((d) => d.wordLimitMin <= d.wordLimitMax, {
    // Bug #51: 创建/更新 task 时若 min > max，DB 会写入脏数据；前端/服务端字数校验
    // 会一直触发但后端又接受，这里强制 min <= max 拒绝。
    path: ['wordLimitMax'],
    message: '字数上限不能小于下限',
  });

app.post(
  '/tasks',
  // Bug #168: 创建作文任务无 rateLimit，teacher 可批量刷任务。
  rateLimit(20, 60_000),
  rateLimit(200, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  zValidator('json', taskSchema),
  async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');
    routesLogger.info(
      { userId: user.id, title: data.title, classId: data.classId },
      '[API POST /tasks]',
    );

    if (!(await assertClassAccess(user, data.classId))) {
      return c.json({ success: false, error: '无权为该班级创建任务' }, 403);
    }

    const now = new Date().toISOString();
    const id = randomUUID();

    const [task] = await db
      .insert(essayTasks)
      .values({
        id,
        ...data,
        keyPoints: JSON.stringify(data.keyPoints),
        createdBy: user.id,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    routesLogger.info({ id: task.id, title: task.title }, '[API POST /tasks] task created');
    return c.json({ success: true, data: task });
  },
);

const aiTopicGenerateSchema = z.object({
  topic: z.string().min(1, '请输入主题').max(200, '主题过长'),
  topicType: z.string().optional(),
  gradeLevel: z.string().optional(),
  wordLimitMin: z.number().int().min(20).max(500).optional(),
  wordLimitMax: z.number().int().min(20).max(500).optional(),
});

const aiTopicResultSchema = z.object({
  title: z.string(),
  topicType: z.string(),
  topicCategory: z.string(),
  requirements: z.string(),
  keyPoints: z.array(z.string()),
  referenceEssay: z.string(),
});

app.post(
  '/tasks/ai-generate',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  rateLimit(5, 60_000),
  // Bug #134: AI 生成题目单次成本高（≥1k tokens），加 50/day 防止误用/滥用把预算打光。
  rateLimit(50, 24 * 60 * 60_000),
  zValidator('json', aiTopicGenerateSchema),
  async (c) => {
    const user = c.get('user');
    const { topic, topicType, gradeLevel, wordLimitMin, wordLimitMax } = c.req.valid('json');
    const start = Date.now();
    routesLogger.info(
      { userId: user.id, topic: topic, topicType: topicType },
      '[API POST /tasks/ai-generate]',
    );

    const router = getAiRouter();
    if (router.availableNames().length === 0) {
      return c.json({ success: false, error: 'AI 服务未配置，请联系管理员' }, 503);
    }

    const wlMin = wordLimitMin ?? 80;
    const wlMax = wordLimitMax ?? 125;
    const grade = gradeLevel ?? 'Grade 7-9 (Chinese middle school)';
    const typeHint = topicType
      ? `Suggested topic type: ${topicType}.`
      : 'Choose an appropriate topic type (narrative/argumentative/descriptive/practical).';

    const prompt = `You are an English writing teacher for Chinese middle school students. Generate a writing task based on the given topic. ${typeHint} The task must be suitable for ${grade} students with a target word count of ${wlMin}-${wlMax} words. Return JSON with: title (concise English title), topicType (one of narrative/argumentative/descriptive/practical), topicCategory (sub-category in English), requirements (detailed requirements in English, 2-4 sentences), keyPoints (3-5 bullet points students should cover, as string array), referenceEssay (a short model essay within the word limit). Topic: ${topic}`;

    try {
      const generated = await router.executeWithFallback('content', (provider) =>
        provider.completeStructured(prompt, aiTopicResultSchema, { maxOutputTokens: 1024 }),
      );
      const duration = Date.now() - start;
      routesLogger.info(
        { userId: user.id, title: generated.title, duration: duration },
        '[API POST /tasks/ai-generate] generated',
      );
      return c.json({ success: true, data: generated });
    } catch (err) {
      routesLogger.warn(
        { userId: user.id, error: err instanceof Error ? err.message : 'unknown' },
        '[API POST /tasks/ai-generate] AI call failed',
      );
      return c.json({ success: false, error: 'AI 生成失败，请稍后重试' }, 500);
    }
  },
);

app.put(
  '/tasks/:id/publish',
  // Bug #198: publish/close 缺限流；教师脚本失控可反复切状态。
  rateLimit(20, 60_000),
  rateLimit(200, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    routesLogger.info({ userId: user.id, taskId: id }, '[API PUT /tasks/:id/publish]');

    const task = await db.query.essayTasks.findFirst({ where: eq(essayTasks.id, id) });
    if (!task) {
      return c.json({ success: false, error: '任务不存在' }, 404);
    }
    if (!(await assertClassAccess(user, task.classId))) {
      routesLogger.warn(
        { userId: user.id, taskId: id },
        '[API PUT /tasks/:id/publish] access denied',
      );
      return c.json({ success: false, error: '无权操作该任务' }, 403);
    }
    if (task.status === 'published') {
      return c.json({ success: false, error: '任务已发布' }, 400);
    }

    const now = new Date().toISOString();
    const [updated] = await db
      .update(essayTasks)
      .set({ status: 'published', updatedAt: now })
      .where(eq(essayTasks.id, id))
      .returning();

    routesLogger.info(
      { taskId: id, prevStatus: task.status },
      '[API PUT /tasks/:id/publish] published',
    );
    return c.json({ success: true, data: updated });
  },
);

app.put(
  '/tasks/:id/close',
  // Bug #198: 同 publish，加 20/min + 200/day。
  rateLimit(20, 60_000),
  rateLimit(200, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    routesLogger.info({ userId: user.id, taskId: id }, '[API PUT /tasks/:id/close]');

    const task = await db.query.essayTasks.findFirst({ where: eq(essayTasks.id, id) });
    if (!task) {
      return c.json({ success: false, error: '任务不存在' }, 404);
    }
    if (!(await assertClassAccess(user, task.classId))) {
      routesLogger.warn(
        { userId: user.id, taskId: id },
        '[API PUT /tasks/:id/close] access denied',
      );
      return c.json({ success: false, error: '无权操作该任务' }, 403);
    }
    if (task.status === 'draft') {
      return c.json({ success: false, error: '草稿任务请先发布' }, 400);
    }
    if (task.status === 'closed') {
      return c.json({ success: false, error: '任务已结束' }, 400);
    }

    const now = new Date().toISOString();
    const [updated] = await db
      .update(essayTasks)
      .set({ status: 'closed', updatedAt: now })
      .where(eq(essayTasks.id, id))
      .returning();

    routesLogger.info({ taskId: id, prevStatus: task.status }, '[API PUT /tasks/:id/close] closed');
    return c.json({ success: true, data: updated });
  },
);

// ========== Teacher Classes ==========
app.get('/teacher/classes', authMiddleware, requireRole(UserRole.TEACHER), async (c) => {
  const user = c.get('user');
  routesLogger.info({ userId: user.id }, '[API /teacher/classes]');

  const myClasses = await db.query.classes.findMany({
    where: eq(classes.teacherId, user.id),
    with: { enrollments: true },
  });

  const classStats = myClasses.map((cls) => ({
    id: cls.id,
    name: cls.name,
    grade: cls.grade,
    studentCount: (cls.enrollments ?? []).filter((e) => e.role === 'student').length,
  }));

  routesLogger.info({ userId: user.id, returning: classStats.length }, '[API /teacher/classes]');
  return c.json({ success: true, data: classStats });
});

// ========== Teacher Dashboard ==========
app.get('/teacher/dashboard', authMiddleware, requireRole(UserRole.TEACHER), async (c) => {
  const user = c.get('user');
  routesLogger.info({ userId: user.id }, '[API /teacher/dashboard]');

  const data = await memoizeAsync(`teacher_dash:${user.id}`, 60_000, async () => {
    const myClasses = await db.query.classes.findMany({
      where: eq(classes.teacherId, user.id),
      with: { enrollments: true },
    });

    const classIds = myClasses.map((cls) => cls.id);
    const allEnrollments = myClasses.flatMap((cls) => cls.enrollments ?? []);
    const studentIds = allEnrollments.filter((e) => e.role === 'student').map((e) => e.userId);

    const [recentTasks, recentEssays] = await Promise.all([
      db.query.essayTasks.findMany({
        where: classIds.length > 0 ? inArray(essayTasks.classId, classIds) : undefined,
        orderBy: desc(essayTasks.createdAt),
        limit: 5,
      }),
      studentIds.length > 0
        ? db.query.essays.findMany({
            where: inArray(essays.studentId, studentIds),
            orderBy: desc(essays.createdAt),
            limit: 10,
            with: {
              student: { columns: { id: true, name: true, studentNo: true } },
              task: true,
              correction: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const pendingEssays = recentEssays.filter(
      (e) => e.status === 'pending' || e.status === 'correcting',
    ).length;
    const completedEssays = recentEssays.filter((e) => e.status === 'completed');
    const averageScore =
      completedEssays.length > 0
        ? completedEssays.reduce((sum, e) => sum + (e.totalScore ?? 0), 0) / completedEssays.length
        : null;

    const classStats = myClasses.map((cls) => ({
      id: cls.id,
      name: cls.name,
      grade: cls.grade,
      studentCount: (cls.enrollments ?? []).filter((e) => e.role === 'student').length,
    }));

    routesLogger.info(
      {
        userId: user.id,
        classes: myClasses.length,
        students: studentIds.length,
        pending: pendingEssays,
      },
      '[API /teacher/dashboard]',
    );

    return {
      stats: {
        totalClasses: myClasses.length,
        totalStudents: studentIds.length,
        pendingEssays,
        averageScore,
      },
      classes: classStats,
      recentTasks,
      recentEssays,
    };
  });

  return c.json({ success: true, data });
});

// ========== Teacher Analytics ==========
app.get(
  '/teacher/analytics/class/:classId',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const classId = c.req.param('classId');
    const start = Date.now();
    routesLogger.info({ userId: user.id, classId: classId }, '[API /teacher/analytics/class]');

    // 1. 校验班级存在
    const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!cls) return c.json({ success: false, error: '班级不存在' }, 404);
    if (!(await assertClassAccess(user, classId))) {
      return c.json({ success: false, error: '无权访问该班级' }, 403);
    }

    // 2. 获取班级学生 IDs
    const enrollments = await db.query.classEnrollments.findMany({
      where: and(eq(classEnrollments.classId, classId), eq(classEnrollments.role, 'student')),
      columns: { userId: true },
    });
    const studentIds = enrollments.map((e) => e.userId);

    // 3. 获取班级所有已批改作文
    const allEssays =
      studentIds.length > 0
        ? await db.query.essays.findMany({
            where: inArray(essays.studentId, studentIds),
            with: { correction: true, task: true },
          })
        : [];
    const completedEssays = allEssays.filter((e) => e.status === 'completed' && e.correction);

    // 4. 平均分趋势：按 task 分组
    const taskMap = new Map<string, { taskTitle: string; scores: number[] }>();
    for (const e of completedEssays) {
      const taskId = e.taskId ?? 'no-task';
      const taskTitle = e.task?.title ?? '未命名任务';
      if (!taskMap.has(taskId)) taskMap.set(taskId, { taskTitle, scores: [] });
      if (e.totalScore !== null) taskMap.get(taskId)?.scores.push(e.totalScore);
    }
    const scoreTrend = Array.from(taskMap.entries())
      .map(([taskId, { taskTitle, scores }]) => ({
        taskId,
        taskTitle,
        averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        essayCount: scores.length,
      }))
      .sort((a, b) => b.essayCount - a.essayCount)
      .slice(0, 10);

    // 5. 分数分布
    const allScores = completedEssays
      .map((e) => e.totalScore)
      .filter((s): s is number => s !== null);
    const scoreDistribution = calculateScoreDistribution(allScores);

    // 6. 高频错误 Top10
    const allErrors: Array<{ type: string }> = [];
    for (const e of completedEssays) {
      try {
        const errs = JSON.parse(e.correction?.errors ?? '[]');
        if (Array.isArray(errs)) {
          for (const err of errs) {
            if (err.type) allErrors.push({ type: err.type });
          }
        }
      } catch {}
    }
    const topErrors = calculateErrorStats(allErrors).slice(0, 10);

    // 7. 体裁对比
    const topicTypeMap = new Map<string, { scores: number[]; count: number }>();
    for (const e of completedEssays) {
      const tt = e.task?.topicType ?? 'unknown';
      let entry = topicTypeMap.get(tt);
      if (!entry) {
        entry = { scores: [], count: 0 };
        topicTypeMap.set(tt, entry);
      }
      entry.count++;
      if (e.totalScore !== null) entry.scores.push(e.totalScore);
    }
    const topicTypeComparison = Array.from(topicTypeMap.entries()).map(
      ([topicType, { scores, count }]) => ({
        topicType,
        averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        essayCount: count,
      }),
    );

    const averageScore =
      allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
    const duration = Date.now() - start;

    routesLogger.info(
      { userId: user.id, classId: classId, essays: completedEssays.length, duration: duration },
      '[API /teacher/analytics/class]',
    );

    return c.json({
      success: true,
      data: {
        classId,
        className: cls.name,
        totalStudents: studentIds.length,
        totalEssays: completedEssays.length,
        averageScore,
        scoreTrend,
        scoreDistribution,
        topErrors,
        topicTypeComparison,
      },
    });
  },
);

app.get(
  '/teacher/analytics/student/:studentId',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const studentId = c.req.param('studentId');
    const start = Date.now();
    routesLogger.info(
      { userId: user.id, studentId: studentId },
      '[API /teacher/analytics/student]',
    );

    const student = await db.query.users.findFirst({ where: eq(users.id, studentId) });
    if (!student) return c.json({ success: false, error: '学生不存在' }, 404);
    if (!(await assertStudentAccess(user, studentId))) {
      return c.json({ success: false, error: '无权访问该学生' }, 403);
    }

    const studentEssays = await db.query.essays.findMany({
      where: eq(essays.studentId, studentId),
      orderBy: desc(essays.createdAt),
      limit: 20,
      with: { correction: true, task: true },
    });
    const completedEssays = studentEssays.filter((e) => e.status === 'completed' && e.correction);

    // 五维能力平均
    const abilities = { topicAdherence: 0, content: 0, language: 0, structure: 0, presentation: 0 };
    let abilityCount = 0;
    for (const e of completedEssays) {
      if (e.correction) {
        abilities.topicAdherence += e.correction.topicAdherenceScore ?? 0;
        abilities.content += e.correction.contentScore ?? 0;
        abilities.language += e.correction.languageScore ?? 0;
        abilities.structure += e.correction.structureScore ?? 0;
        abilities.presentation += e.correction.presentationScore ?? 0;
        abilityCount++;
      }
    }
    if (abilityCount > 0) {
      abilities.topicAdherence /= abilityCount;
      abilities.content /= abilityCount;
      abilities.language /= abilityCount;
      abilities.structure /= abilityCount;
      abilities.presentation /= abilityCount;
    }

    // 分数趋势
    const scoreTrend = completedEssays
      .slice()
      .reverse()
      .map((e) => ({
        essayId: e.id,
        title: e.title ?? e.task?.title ?? '未命名',
        score: e.totalScore ?? 0,
        submittedAt: e.submittedAt,
      }));

    // 错误分布
    const allErrors: Array<{ type: string }> = [];
    for (const e of completedEssays) {
      try {
        const errs = JSON.parse(e.correction?.errors ?? '[]');
        if (Array.isArray(errs))
          for (const err of errs) if (err.type) allErrors.push({ type: err.type });
      } catch {}
    }
    const errorDistribution = calculateErrorStats(allErrors);

    const allScores = completedEssays
      .map((e) => e.totalScore)
      .filter((s): s is number => s !== null);
    const averageScore =
      allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
    const duration = Date.now() - start;

    routesLogger.info(
      { userId: user.id, studentId: studentId, essays: completedEssays.length, duration: duration },
      '[API /teacher/analytics/student]',
    );

    return c.json({
      success: true,
      data: {
        studentId,
        studentName: student.name,
        totalEssays: completedEssays.length,
        averageScore,
        abilities,
        scoreTrend,
        errorDistribution,
        recentEssays: studentEssays.slice(0, 5).map((e) => ({
          id: e.id,
          title: e.title ?? e.task?.title ?? '未命名作文',
          status: e.status,
          totalScore: e.totalScore,
          wordCount: e.wordCount,
          submittedAt: e.submittedAt,
        })),
      },
    });
  },
);

app.get(
  '/teacher/analytics/class/:classId/export',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const classId = c.req.param('classId');
    const start = Date.now();
    routesLogger.info(
      { userId: user.id, classId: classId },
      '[API /teacher/analytics/class/export]',
    );

    const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!cls) return c.json({ success: false, error: '班级不存在' }, 404);
    if (!(await assertClassAccess(user, classId))) {
      return c.json({ success: false, error: '无权访问该班级' }, 403);
    }

    const enrollments = await db.query.classEnrollments.findMany({
      where: and(eq(classEnrollments.classId, classId), eq(classEnrollments.role, 'student')),
      columns: { userId: true },
    });
    const studentIds = enrollments.map((e) => e.userId);

    const allEssays =
      studentIds.length > 0
        ? await db.query.essays.findMany({
            where: inArray(essays.studentId, studentIds),
            with: {
              student: { columns: { id: true, name: true, studentNo: true } },
              task: true,
              correction: true,
            },
            orderBy: desc(essays.createdAt),
          })
        : [];

    const escapeCSV = (val: string | number | null | undefined): string => {
      const s = String(val ?? '');
      if (/^[=@+\-]/.test(s)) {
        return `"'${s}"`;
      }
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const header = '学生姓名,学号,作文标题,体裁,词数,状态,总分,提交时间\n';
    const rows = allEssays
      .map((e) =>
        [
          escapeCSV(e.student?.name),
          escapeCSV(e.student?.studentNo),
          escapeCSV(e.title ?? e.task?.title),
          escapeCSV(e.task?.topicType),
          e.wordCount,
          e.status,
          e.totalScore ?? '',
          e.submittedAt,
        ].join(','),
      )
      .join('\n');
    const csv = `\uFEFF${header}${rows}`;
    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, classId: classId, rows: allEssays.length, duration: duration },
      '[API /teacher/analytics/class/export]',
    );

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="class-${classId}-essays.csv"`,
      },
    });
  },
);

// ========== Teacher Students ==========
app.get(
  '/teacher/students',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const classId = c.req.query('classId');
    const keyword = c.req.query('keyword')?.trim().toLowerCase();
    const start = Date.now();
    routesLogger.info(
      { userId: user.id, classId: classId ?? 'all', keyword: keyword ?? '' },
      '[API /teacher/students]',
    );

    // 确定查询的班级范围（按角色隔离，防止跨校/跨班 IDOR）
    let targetClassIds: string[] = [];
    if (classId) {
      if (!(await assertClassAccess(user, classId))) {
        return c.json({ success: false, error: '无权访问该班级' }, 403);
      }
      targetClassIds = [classId];
    } else if (user.role === UserRole.TEACHER) {
      const myClasses = await db.query.classes.findMany({
        where: eq(classes.teacherId, user.id),
        columns: { id: true },
      });
      targetClassIds = myClasses.map((c) => c.id);
    } else if (user.role === UserRole.SCHOOL_ADMIN && user.schoolId) {
      const schoolClasses = await db.query.classes.findMany({
        where: eq(classes.schoolId, user.schoolId),
        columns: { id: true },
      });
      targetClassIds = schoolClasses.map((c) => c.id);
    }
    // SUPER_ADMIN 且未指定 classId 时 targetClassIds 为空，下方查询全部学生。

    // 获取 enrollments
    const enrollments =
      targetClassIds.length > 0
        ? await db.query.classEnrollments.findMany({
            where: and(
              inArray(classEnrollments.classId, targetClassIds),
              eq(classEnrollments.role, 'student'),
            ),
            with: { class: { columns: { id: true, name: true, grade: true } } },
          })
        : user.role === UserRole.SUPER_ADMIN
          ? await db.query.classEnrollments.findMany({
              where: eq(classEnrollments.role, 'student'),
              with: { class: { columns: { id: true, name: true, grade: true } } },
              limit: 200,
            })
          : [];

    // 获取学生用户信息
    const studentIds = enrollments.map((e) => e.userId);
    const students =
      studentIds.length > 0
        ? await db.query.users.findMany({ where: inArray(users.id, studentIds) })
        : [];

    // 获取标签
    const tags =
      studentIds.length > 0
        ? await db.query.studentTags.findMany({ where: inArray(studentTags.studentId, studentIds) })
        : [];
    const tagMap = new Map(tags.map((t) => [t.studentId, t.tag]));

    // 获取每个学生的作文统计
    const essayStats = new Map<
      string,
      { count: number; avgScore: number | null; scores: number[] }
    >();
    if (studentIds.length > 0) {
      const allEssays = await db.query.essays.findMany({
        where: inArray(essays.studentId, studentIds),
        columns: { studentId: true, totalScore: true, status: true },
      });
      for (const e of allEssays) {
        let stat = essayStats.get(e.studentId);
        if (!stat) {
          stat = { count: 0, avgScore: null, scores: [] };
          essayStats.set(e.studentId, stat);
        }
        stat.count++;
        if (e.totalScore !== null) stat.scores.push(e.totalScore);
      }
      for (const stat of essayStats.values()) {
        stat.avgScore =
          stat.scores.length > 0
            ? stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length
            : null;
      }
    }

    // 组装结果并过滤关键词
    let result = enrollments.map((en) => {
      const stu = students.find((s) => s.id === en.userId);
      const stat = essayStats.get(en.userId);
      return {
        id: en.userId,
        name: stu?.name ?? '',
        email: stu?.email ?? '',
        studentNo: stu?.studentNo ?? null,
        classId: en.classId,
        className: en.class?.name ?? '',
        grade: en.class?.grade ?? '',
        tag: tagMap.get(en.userId) ?? null,
        essayCount: stat?.count ?? 0,
        averageScore: stat?.avgScore ?? null,
      };
    });

    if (keyword) {
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(keyword) ||
          (r.studentNo ?? '').toLowerCase().includes(keyword) ||
          r.email.toLowerCase().includes(keyword),
      );
    }

    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, returning: result.length, duration: duration },
      '[API /teacher/students]',
    );
    return c.json({ success: true, data: result });
  },
);

app.get(
  '/teacher/students/:id',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const studentId = c.req.param('id');
    const start = Date.now();
    routesLogger.info({ userId: user.id, studentId: studentId }, '[API /teacher/students/:id]');

    const student = await db.query.users.findFirst({ where: eq(users.id, studentId) });
    if (!student) return c.json({ success: false, error: '学生不存在' }, 404);
    if (!(await assertStudentAccess(user, studentId))) {
      return c.json({ success: false, error: '无权访问该学生' }, 403);
    }

    const enrollments = await db.query.classEnrollments.findMany({
      where: eq(classEnrollments.userId, studentId),
      with: { class: true },
    });

    const tag = await db.query.studentTags.findFirst({
      where: eq(studentTags.studentId, studentId),
    });

    const recentEssays = await db.query.essays.findMany({
      where: eq(essays.studentId, studentId),
      orderBy: desc(essays.createdAt),
      limit: 10,
      with: { task: true, correction: true },
    });

    const completedEssays = recentEssays.filter((e) => e.status === 'completed');
    const allScores = completedEssays
      .map((e) => e.totalScore)
      .filter((s): s is number => s !== null);
    const averageScore =
      allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;

    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, studentId: studentId, essays: recentEssays.length, duration: duration },
      '[API /teacher/students/:id]',
    );

    return c.json({
      success: true,
      data: {
        id: student.id,
        name: student.name,
        email: student.email,
        studentNo: student.studentNo,
        classes: enrollments.map((en) => ({
          id: en.classId,
          name: en.class?.name,
          grade: en.class?.grade,
        })),
        tag: tag?.tag ?? null,
        averageScore,
        essayCount: recentEssays.length,
        recentEssays: recentEssays.map((e) => ({
          id: e.id,
          title: e.title ?? e.task?.title ?? '未命名',
          status: e.status,
          totalScore: e.totalScore,
          wordCount: e.wordCount,
          submittedAt: e.submittedAt,
          topicType: e.task?.topicType ?? null,
        })),
      },
    });
  },
);

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

const importSchema = z.object({
  classId: z.string().min(1, '请选择班级'),
  csv: z.string().min(1, 'CSV 内容不能为空'),
});

app.post(
  '/teacher/students/import',
  // Bug #166: CSV 导入无 rateLimit，teacher 失误可塞 10MB CSV 反复提交。
  rateLimit(5, 60_000),
  rateLimit(50, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  zValidator('json', importSchema),
  async (c) => {
    const user = c.get('user');
    const { classId, csv } = c.req.valid('json');
    const start = Date.now();
    routesLogger.info({ userId: user.id, classId: classId }, '[API /teacher/students/import]');

    // Bug #167: 限制单次导入最大行数 + CSV 字节数，避免一个请求塞 10 万行
    // 把 DB + bcrypt 写满整分钟。
    if (csv.length > 1_000_000) {
      return c.json({ success: false, error: 'CSV 过大，请拆成多次导入（单次 ≤ 1MB）' }, 400);
    }
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length > 1001) {
      return c.json(
        { success: false, error: '单次最多导入 1000 名学生，请拆成多次' },
        400,
      );
    }

    const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!cls) return c.json({ success: false, error: '班级不存在' }, 404);
    if (!(await assertClassAccess(user, classId))) {
      return c.json({ success: false, error: '无权操作该班级' }, 403);
    }

    if (lines.length === 0) return c.json({ success: false, error: 'CSV 为空' }, 400);

    const header = lines[0].toLowerCase().trim();
    const expectedHeader = 'name,email,studentno';
    if (header !== expectedHeader) {
      return c.json(
        {
          success: false,
          error: `CSV 表头应为 "${expectedHeader}"，实际为 "${header}"`,
        },
        400,
      );
    }

    const results: Array<{
      line: number;
      name: string;
      email: string;
      success: boolean;
      password?: string;
      error?: string;
    }> = [];
    let successCount = 0;
    const now = new Date().toISOString();

    // 为每个学生生成 8 位随机密码（避免共享默认密码 123456 的安全风险）。
    const generateRandomPassword = (): string =>
      Array.from({ length: 8 }, () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = parseCsvLine(line);
      if (parts.length < 2) {
        results.push({ line: i + 1, name: '', email: '', success: false, error: '字段不足' });
        continue;
      }
      const [rawName, rawEmail, rawStudentNo] = parts;
      // Bug #120: 邮箱做小写 + trim 规范化；Bug #121: name 限长防止 XSS 攻击向量/排版错乱。
      const name = (rawName ?? '').slice(0, 100);
      const email = (rawEmail ?? '').toLowerCase().trim();
      const studentNo = (rawStudentNo ?? '').slice(0, 50);
      if (!name || !email) {
        results.push({
          line: i + 1,
          name,
          email,
          success: false,
          error: '姓名和邮箱必填',
        });
        continue;
      }

      try {
        // Bug #122: 之前只查 users.findFirst 做软去重，并发导入同邮箱会双写；
        // 改为先尝试 INSERT 并捕获 users.email UNIQUE 冲突转为"邮箱已存在"错误。
        const userId = randomUUID();
        const password = generateRandomPassword();
        const passwordHash = await bcrypt.hash(password, 10);
        try {
          await db.insert(users).values({
            id: userId,
            email,
            passwordHash,
            name,
            role: UserRole.STUDENT,
            schoolId: cls.schoolId,
            studentNo: studentNo || null,
            createdAt: now,
            updatedAt: now,
          });
        } catch (insertErr) {
          const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
          if (/UNIQUE.*users_email|users\.email/i.test(msg) || msg.includes('UNIQUE')) {
            results.push({
              line: i + 1,
              name,
              email,
              success: false,
              error: '邮箱已存在',
            });
            continue;
          }
          throw insertErr;
        }
        await db.insert(classEnrollments).values({
          id: randomUUID(),
          classId,
          userId,
          role: 'student',
          createdAt: now,
        });
        results.push({ line: i + 1, name, email, success: true, password });
        successCount++;
      } catch (err) {
        results.push({
          line: i + 1,
          name,
          email,
          success: false,
          error: err instanceof Error ? err.message : '未知错误',
        });
      }
    }

    const duration = Date.now() - start;
    routesLogger.info(
      {
        userId: user.id,
        classId: classId,
        success: successCount,
        total: lines.length - 1,
        duration: duration,
      },
      '[API /teacher/students/import]',
    );

    return c.json({
      success: true,
      data: { successCount, totalCount: lines.length - 1, results },
    });
  },
);

const tagSchema = z.object({
  tag: z.enum([StudentTag.EXCELLENT, StudentTag.GOOD, StudentTag.IMPROVING, StudentTag.ATTENTION]),
});

app.patch(
  '/teacher/students/:id/tags',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  zValidator('json', tagSchema),
  async (c) => {
    const user = c.get('user');
    const studentId = c.req.param('id');
    const { tag } = c.req.valid('json');
    const start = Date.now();
    routesLogger.info(
      { userId: user.id, studentId: studentId, tag: tag },
      '[API /teacher/students/:id/tags]',
    );

    const student = await db.query.users.findFirst({ where: eq(users.id, studentId) });
    if (!student) return c.json({ success: false, error: '学生不存在' }, 404);
    if (!(await assertStudentAccess(user, studentId))) {
      return c.json({ success: false, error: '无权操作该学生' }, 403);
    }

    const now = new Date().toISOString();
    const existing = await db.query.studentTags.findFirst({
      where: eq(studentTags.studentId, studentId),
    });

    if (existing) {
      await db
        .update(studentTags)
        .set({ tag, updatedBy: user.id, updatedAt: now })
        .where(eq(studentTags.id, existing.id));
    } else {
      await db.insert(studentTags).values({
        id: randomUUID(),
        studentId,
        tag,
        updatedBy: user.id,
        updatedAt: now,
      });
    }

    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, studentId: studentId, tag: tag, duration: duration },
      '[API /teacher/students/:id/tags]',
    );
    return c.json({ success: true, data: { studentId, tag } });
  },
);

// ========== Teacher Resources ==========
app.get(
  '/teacher/resources',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const type = c.req.query('type');
    const topicType = c.req.query('topicType');
    const difficulty = c.req.query('difficulty');
    const limit = parsePositiveInt(c.req.query('limit'), 50, 200);
    const start = Date.now();
    routesLogger.info(
      {
        userId: user.id,
        type: type ?? 'all',
        topicType: topicType ?? 'all',
        difficulty: difficulty ?? 'all',
      },
      '[API /teacher/resources]',
    );

    const conditions: ReturnType<typeof eq>[] = [];
    if (type) conditions.push(eq(teachingResources.type, type));
    if (topicType) conditions.push(eq(teachingResources.topicType, topicType));
    if (difficulty) conditions.push(eq(teachingResources.difficulty, difficulty));

    const list = await db.query.teachingResources.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(teachingResources.createdAt),
      limit: Math.min(limit, 200),
      with: { creator: { columns: { id: true, name: true } } },
    });
    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, returning: list.length, duration: duration },
      '[API /teacher/resources]',
    );
    return c.json({ success: true, data: list });
  },
);

const resourceSchema = z.object({
  type: z.enum([
    TeachingResourceType.SAMPLE,
    TeachingResourceType.SENTENCE,
    TeachingResourceType.CONNECTOR,
    TeachingResourceType.ERROR_CASE,
  ]),
  title: z.string().min(1, '请输入标题'),
  topicType: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  content: z.string().min(1, '请输入内容'),
  highlights: z.string().default(''),
  tags: z.array(z.string()).default([]),
});

app.post(
  '/teacher/resources',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  zValidator('json', resourceSchema),
  async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');
    const start = Date.now();
    routesLogger.info(
      { userId: user.id, type: data.type, title: data.title },
      '[API POST /teacher/resources]',
    );

    // 去重校验
    const existing = await db.query.teachingResources.findFirst({
      where: and(eq(teachingResources.type, data.type), eq(teachingResources.title, data.title)),
    });
    if (existing) {
      routesLogger.warn(
        { userId: user.id, type: data.type, title: data.title },
        '[API POST /teacher/resources] duplicate title',
      );
      return c.json({ success: false, error: '该类型下已存在同名资源' }, 409);
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const [resource] = await db
      .insert(teachingResources)
      .values({
        id,
        type: data.type,
        title: data.title,
        topicType: data.topicType ?? null,
        difficulty: data.difficulty,
        content: data.content,
        highlights: data.highlights,
        tags: JSON.stringify(data.tags),
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const duration = Date.now() - start;
    routesLogger.info(
      { id: resource.id, duration: duration },
      '[API POST /teacher/resources] created',
    );
    return c.json({ success: true, data: resource });
  },
);

app.get(
  '/teacher/resources/:id',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const start = Date.now();
    routesLogger.info({ userId: user.id, id: id }, '[API /teacher/resources/:id]');

    const resource = await db.query.teachingResources.findFirst({
      where: eq(teachingResources.id, id),
      with: { creator: { columns: { id: true, name: true } } },
    });
    if (!resource) return c.json({ success: false, error: '资源不存在' }, 404);

    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, id: id, duration: duration },
      '[API /teacher/resources/:id]',
    );
    return c.json({ success: true, data: resource });
  },
);

const updateResourceSchema = z.object({
  title: z.string().min(1).optional(),
  topicType: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  content: z.string().min(1).optional(),
  highlights: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

app.patch(
  '/teacher/resources/:id',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  zValidator('json', updateResourceSchema),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const start = Date.now();
    routesLogger.info({ userId: user.id, id: id }, '[API PATCH /teacher/resources/:id]');

    const existing = await db.query.teachingResources.findFirst({
      where: eq(teachingResources.id, id),
    });
    if (!existing) return c.json({ success: false, error: '资源不存在' }, 404);

    // Bug #159: 之前只对 TEACHER 校验 createdBy，SCHOOL_ADMIN 可以改/删任意学校的资源（IDOR）。
    // 改为：教师必须是创建者；学校管理员必须是创建者所在学校的 admin；超级管理员允许所有。
    if (user.role === UserRole.TEACHER && existing.createdBy !== user.id) {
      return c.json({ success: false, error: '无权修改他人的资源' }, 403);
    }
    if (user.role === UserRole.SCHOOL_ADMIN) {
      const creator = await db.query.users.findFirst({
        where: eq(users.id, existing.createdBy),
        columns: { schoolId: true },
      });
      if (!creator || creator.schoolId !== user.schoolId) {
        return c.json({ success: false, error: '无权修改其他学校的资源' }, 403);
      }
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.topicType !== undefined) updateData.topicType = data.topicType;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.highlights !== undefined) updateData.highlights = data.highlights;
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);

    const [updated] = await db
      .update(teachingResources)
      .set(updateData)
      .where(eq(teachingResources.id, id))
      .returning();
    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, id: id, duration: duration },
      '[API PATCH /teacher/resources/:id]',
    );
    return c.json({ success: true, data: updated });
  },
);

app.delete(
  '/teacher/resources/:id',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const start = Date.now();
    routesLogger.info({ userId: user.id, id: id }, '[API DELETE /teacher/resources/:id]');

    const existing = await db.query.teachingResources.findFirst({
      where: eq(teachingResources.id, id),
    });
    if (!existing) return c.json({ success: false, error: '资源不存在' }, 404);

    // Bug #159: 同样的 IDOR 修复，与 PATCH 路径一致。
    if (user.role === UserRole.TEACHER && existing.createdBy !== user.id) {
      return c.json({ success: false, error: '无权删除他人的资源' }, 403);
    }
    if (user.role === UserRole.SCHOOL_ADMIN) {
      const creator = await db.query.users.findFirst({
        where: eq(users.id, existing.createdBy),
        columns: { schoolId: true },
      });
      if (!creator || creator.schoolId !== user.schoolId) {
        return c.json({ success: false, error: '无权删除其他学校的资源' }, 403);
      }
    }

    await db.delete(teachingResources).where(eq(teachingResources.id, id));
    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, id: id, duration: duration },
      '[API DELETE /teacher/resources/:id]',
    );
    return c.json({ success: true });
  },
);

// ========== Student Helpers ==========
function safeJsonArray(s: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(s ?? '[]');
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function safeJsonObject(s: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(s ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function syncStudentErrorBook(studentId: string): Promise<number> {
  const completedEssays = await db.query.essays.findMany({
    where: and(eq(essays.studentId, studentId), eq(essays.status, 'completed')),
    with: { correction: true },
  });
  const existing = await db.query.errorBooks.findMany({
    where: eq(errorBooks.studentId, studentId),
    columns: { correctionId: true, original: true },
  });
  // Bug #114: 原用 `${correctionId}::${original}` 字符串拼接，original 包含 `::` 会冲突；
  // 改为键以 JSON 字符串作为 set key，规避拼接碰撞。
  const seen = new Set<string>(existing.map((e) => JSON.stringify([e.correctionId, e.original])));
  const now = new Date().toISOString();
  const newRows: Array<{
    id: string;
    studentId: string;
    essayId: string;
    correctionId: string;
    errorType: string;
    original: string;
    corrected: string;
    explanation: string | null;
    status: 'unresolved';
    createdAt: string;
    updatedAt: string;
  }> = [];
  for (const essay of completedEssays) {
    const correction = essay.correction;
    if (!correction) continue;
    let errors: unknown[] = [];
    try {
      const parsed = JSON.parse(correction.errors ?? '[]');
      if (Array.isArray(parsed)) errors = parsed;
    } catch {
      continue;
    }
    for (const raw of errors) {
      const err = raw as {
        type?: string;
        original?: string;
        corrected?: string;
        explanation?: string;
      };
      if (!err.type || !err.original || !err.corrected) continue;
      const key = JSON.stringify([correction.id, err.original]);
      if (seen.has(key)) continue;
      seen.add(key);
      newRows.push({
        id: randomUUID(),
        studentId,
        essayId: essay.id,
        correctionId: correction.id,
        errorType: String(err.type),
        original: String(err.original),
        corrected: String(err.corrected),
        explanation: err.explanation ? String(err.explanation) : null,
        status: 'unresolved',
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  // Bug #94: 之前每条 error 一次 INSERT，100 个错误就是 100 次 round-trip；
  // 改为单次 batch insert（支持 SQLite 多值 VALUES）。
  if (newRows.length > 0) {
    await db.insert(errorBooks).values(newRows);
  }
  return newRows.length;
}

const ACHIEVEMENT_CATALOG = [
  {
    code: 'essay_10',
    tier: AchievementTier.BRONZE,
    title: '初出茅庐',
    description: '完成10篇作文',
    icon: 'medal-bronze',
  },
  {
    code: 'essay_50',
    tier: AchievementTier.SILVER,
    title: '笔耕不辍',
    description: '完成50篇作文',
    icon: 'medal-silver',
  },
  {
    code: 'essay_100',
    tier: AchievementTier.GOLD,
    title: '百篇达人',
    description: '完成100篇作文',
    icon: 'medal-gold',
  },
  {
    code: 'perfect_score',
    tier: AchievementTier.GOLD,
    title: '满分佳作',
    description: '获得一篇满分作文',
    icon: 'star',
  },
  {
    code: 'progress_streak',
    tier: AchievementTier.SILVER,
    title: '稳步提升',
    description: '连续3次作文进步',
    icon: 'trend-up',
  },
  {
    code: 'first_tier_regular',
    tier: AchievementTier.PLATINUM,
    title: '一等常客',
    description: '平均分达到13分',
    icon: 'crown',
  },
  {
    code: 'grammar_master',
    tier: AchievementTier.GOLD,
    title: '语法大师',
    description: '5篇作文无语法错误',
    icon: 'shield',
  },
];

// ========== Student Error Book ==========
// Bug #124: 之前 /student/errors 每次 list 都会调一次 syncStudentErrorBook 跑全量 JOIN
// + JSON 解析 + N+1 INSERT（已优化为 batch insert，见 Bug #94）。但即便这样，每次
// 列表仍会触发整张 corrections × errorBooks 扫描。改为：30s 内的重复请求跳过 sync。
const studentErrorSyncCache = new Map<string, number>(); // studentId -> lastSyncedAt(ms)
const STUDENT_ERROR_SYNC_TTL_MS = 30_000;

app.get('/student/errors', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const start = Date.now();
  routesLogger.info({ userId: user.id }, '[API /student/errors]');
  const now = Date.now();
  const lastSync = studentErrorSyncCache.get(user.id) ?? 0;
  if (now - lastSync >= STUDENT_ERROR_SYNC_TTL_MS) {
    await syncStudentErrorBook(user.id);
    studentErrorSyncCache.set(user.id, now);
  }
  const all = await db.query.errorBooks.findMany({
    where: eq(errorBooks.studentId, user.id),
    orderBy: desc(errorBooks.createdAt),
  });
  const groupMap = new Map<
    string,
    {
      total: number;
      unresolved: number;
      mastered: number;
      latestOriginal: string;
      latestCorrected: string;
      latestCreatedAt: string;
    }
  >();
  for (const e of all) {
    let g = groupMap.get(e.errorType);
    if (!g) {
      g = {
        total: 0,
        unresolved: 0,
        mastered: 0,
        latestOriginal: '',
        latestCorrected: '',
        latestCreatedAt: '',
      };
      groupMap.set(e.errorType, g);
    }
    g.total++;
    if (e.status === 'mastered') g.mastered++;
    else g.unresolved++;
    if (e.createdAt > g.latestCreatedAt) {
      g.latestCreatedAt = e.createdAt;
      g.latestOriginal = e.original;
      g.latestCorrected = e.corrected;
    }
  }
  const groups: ErrorBookGroup[] = Array.from(groupMap.entries()).map(([errorType, g]) => ({
    errorType,
    total: g.total,
    unresolved: g.unresolved,
    mastered: g.mastered,
    latestOriginal: g.latestOriginal,
    latestCorrected: g.latestCorrected,
  }));
  const duration = Date.now() - start;
  routesLogger.info(
    { userId: user.id, groups: groups.length, duration: duration },
    '[API /student/errors]',
  );
  return c.json({ success: true, data: groups });
});

app.post(
  '/student/errors/sync',
  // Bug #169: 同步错题本无 rateLimit；syncStudentErrorBook 要扫所有 correction 行
  // + 重新聚合 stats，频繁调用会拖慢 DB。限制 1/min + 10/day。
  rateLimit(1, 60_000),
  rateLimit(10, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.STUDENT),
  async (c) => {
    const user = c.get('user');
    const start = Date.now();
    routesLogger.info({ userId: user.id }, '[API /student/errors/sync]');
    const synced = await syncStudentErrorBook(user.id);
    // Bug #124: 主动 sync 也要刷新缓存，避免下一次 list 又走一遍。
    studentErrorSyncCache.set(user.id, Date.now());
    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, synced: synced, duration: duration },
      '[API /student/errors/sync]',
    );
    return c.json({ success: true, data: { synced } });
  },
);

const errorPracticeBodySchema = z.object({ errorType: z.string().min(1).max(50) });

app.post(
  '/student/errors/practice',
  // Bug #127: 学生可无限调用 AI 生成练习，限制 5/min + 30/day 防滥用/超预算。
  rateLimit(5, 60_000),
  rateLimit(30, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', errorPracticeBodySchema),
  async (c) => {
    const user = c.get('user');
    const { errorType } = c.req.valid('json');
    const start = Date.now();
    routesLogger.info({ userId: user.id, errorType: errorType }, '[API /student/errors/practice]');
    const router = getAiRouter();
    if (router.availableNames().length === 0) {
      return c.json({ success: false, error: 'AI 服务未配置' }, 503);
    }
    try {
      const prompt = `You are an English writing tutor for Chinese middle school students. Generate 3 targeted grammar practice exercises for the error type "${errorType}". Each exercise must be a single line starting with a number (1. 2. 3.) containing a short sentence with a gap or an error to fix. Return ONLY the 3 lines, no preamble.`;
      const raw = await router.executeWithFallback('language', (provider) =>
        provider.complete(prompt, { maxOutputTokens: 512 }),
      );
      const exercises = raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 3);
      const duration = Date.now() - start;
      routesLogger.info(
        { userId: user.id, generated: exercises.length, duration: duration },
        '[API /student/errors/practice]',
      );
      return c.json({ success: true, data: { exercises } });
    } catch (err) {
      routesLogger.warn(
        { userId: user.id, error: err instanceof Error ? err.message : 'unknown' },
        '[API /student/errors/practice]',
      );
      return c.json({ success: false, error: 'AI 调用失败，请稍后重试' }, 500);
    }
  },
);

app.get('/student/errors/:type', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const type = c.req.param('type');
  const offset = parseNonNegativeInt(c.req.query('offset'), 0);
  const limit = parsePositiveInt(c.req.query('limit'), 20, 100);
  routesLogger.info(
    { userId: user.id, type: type, offset: offset, limit: limit },
    '[API /student/errors/:type]',
  );
  const list = await db.query.errorBooks.findMany({
    where: and(eq(errorBooks.studentId, user.id), eq(errorBooks.errorType, type)),
    orderBy: desc(errorBooks.createdAt),
    offset,
    limit,
  });
  return c.json({ success: true, data: list });
});

// Bug #191: 标"掌握"无 rateLimit，脚本可无限点击错题本制造 update 风暴。
// 限制 10/min + 200/day（与 /student/drafts 一致）。
app.post(
  '/student/errors/:id/master',
  rateLimit(10, 60_000),
  rateLimit(200, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.STUDENT),
  async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    const now = new Date().toISOString();
    routesLogger.info({ userId: user.id, id: id }, '[API /student/errors/:id/master]');
    const existing = await db.query.errorBooks.findFirst({
      where: and(eq(errorBooks.id, id), eq(errorBooks.studentId, user.id)),
    });
    if (!existing) return c.json({ success: false, error: '错题不存在' }, 404);
    await db
      .update(errorBooks)
      .set({ status: 'mastered', masteredAt: now, updatedAt: now })
      .where(eq(errorBooks.id, id));
    return c.json({ success: true, data: { studentId: user.id, id, status: 'mastered' } });
  },
);

// ========== Student AI Assistant ==========
const aiPolishBodySchema = z.object({
  text: z.string().min(1).max(5000, '文本过长，请控制在 5000 字符以内'),
});

app.post(
  '/student/ai/polish',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  // Bug #173: 只有 5/min 没有 day-level 限流，学生可日调用 7200 次（5*60*24），
  // AI 单次成本高（≥1k tokens）。加 30/day 与 /student/errors/practice 对齐。
  rateLimit(5, 60_000),
  rateLimit(30, 24 * 60 * 60_000),
  zValidator('json', aiPolishBodySchema),
  async (c) => {
    const user = c.get('user');
    const { text } = c.req.valid('json');
    const start = Date.now();
    routesLogger.info({ userId: user.id }, '[API /student/ai/polish]');
    const router = getAiRouter();
    if (router.availableNames().length === 0) {
      return c.json({ success: false, error: 'AI 服务未配置' }, 503);
    }
    let result: Awaited<ReturnType<typeof polishEssay>>;
    try {
      result = await polishEssay(router, text);
    } catch (err) {
      routesLogger.warn(
        { userId: user.id, error: err instanceof Error ? err.message : 'unknown' },
        '[API /student/ai/polish]',
      );
      return c.json({ success: false, error: 'AI 调用失败，请稍后重试' }, 500);
    }
    const now = new Date().toISOString();
    await db.insert(aiConversations).values({
      id: randomUUID(),
      studentId: user.id,
      mode: AiAssistantMode.POLISH,
      inputText: text,
      outputText: result.polished,
      metadata: JSON.stringify({ changes: result.changes }),
      aiProvider: null,
      aiModel: null,
      tokensUsed: null,
      createdAt: now,
    });
    const duration = Date.now() - start;
    routesLogger.info({ userId: user.id, duration: duration }, '[API /student/ai/polish]');
    const data: AiAssistantResult = {
      mode: AiAssistantMode.POLISH,
      input: text,
      output: result.polished,
      details: { changes: result.changes },
      provider: null,
      model: null,
    };
    return c.json({ success: true, data });
  },
);

const aiUpgradeBodySchema = z.object({
  text: z.string().min(1).max(5000, '文本过长，请控制在 5000 字符以内'),
});

app.post(
  '/student/ai/upgrade',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  // Bug #173: 同 polish，5/min 缺 day-level 限流；加 30/day。
  rateLimit(5, 60_000),
  rateLimit(30, 24 * 60 * 60_000),
  zValidator('json', aiUpgradeBodySchema),
  async (c) => {
    const user = c.get('user');
    const { text } = c.req.valid('json');
    const start = Date.now();
    routesLogger.info({ userId: user.id }, '[API /student/ai/upgrade]');
    const router = getAiRouter();
    if (router.availableNames().length === 0) {
      return c.json({ success: false, error: 'AI 服务未配置' }, 503);
    }
    let result: Awaited<ReturnType<typeof upgradeSentences>>;
    try {
      result = await upgradeSentences(router, text);
    } catch (err) {
      routesLogger.warn(
        { userId: user.id, error: err instanceof Error ? err.message : 'unknown' },
        '[API /student/ai/upgrade]',
      );
      return c.json({ success: false, error: 'AI 调用失败，请稍后重试' }, 500);
    }
    const now = new Date().toISOString();
    const outputText = result.sentences.map((s) => s.upgraded).join('\n');
    await db.insert(aiConversations).values({
      id: randomUUID(),
      studentId: user.id,
      mode: AiAssistantMode.UPGRADE,
      inputText: text,
      outputText,
      metadata: JSON.stringify({ sentences: result.sentences }),
      aiProvider: null,
      aiModel: null,
      tokensUsed: null,
      createdAt: now,
    });
    const duration = Date.now() - start;
    routesLogger.info({ userId: user.id, duration: duration }, '[API /student/ai/upgrade]');
    const data: AiAssistantResult = {
      mode: AiAssistantMode.UPGRADE,
      input: text,
      output: outputText,
      details: { sentences: result.sentences },
      provider: null,
      model: null,
    };
    return c.json({ success: true, data });
  },
);

const aiSynonymBodySchema = z.object({
  word: z.string().min(1).max(100, '单词过长'),
  context: z.string().max(1000, '上下文过长，请控制在 1000 字符以内').default(''),
});

app.post(
  '/student/ai/synonym',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  // Bug #173: 同 polish/upgrade，加 30/day。
  rateLimit(5, 60_000),
  rateLimit(30, 24 * 60 * 60_000),
  zValidator('json', aiSynonymBodySchema),
  async (c) => {
    const user = c.get('user');
    const { word, context } = c.req.valid('json');
    const start = Date.now();
    routesLogger.info({ userId: user.id, word: word }, '[API /student/ai/synonym]');
    const router = getAiRouter();
    if (router.availableNames().length === 0) {
      return c.json({ success: false, error: 'AI 服务未配置' }, 503);
    }
    let result: Awaited<ReturnType<typeof getSynonyms>>;
    try {
      result = await getSynonyms(router, word, context);
    } catch (err) {
      routesLogger.warn(
        { userId: user.id, error: err instanceof Error ? err.message : 'unknown' },
        '[API /student/ai/synonym]',
      );
      return c.json({ success: false, error: 'AI 调用失败，请稍后重试' }, 500);
    }
    const now = new Date().toISOString();
    const outputText = result.synonyms.map((s) => s.word).join(', ');
    await db.insert(aiConversations).values({
      id: randomUUID(),
      studentId: user.id,
      mode: AiAssistantMode.SYNONYM,
      inputText: `${word}\n${context}`,
      outputText,
      metadata: JSON.stringify({ word, synonyms: result.synonyms }),
      aiProvider: null,
      aiModel: null,
      tokensUsed: null,
      createdAt: now,
    });
    const duration = Date.now() - start;
    routesLogger.info({ userId: user.id, duration: duration }, '[API /student/ai/synonym]');
    const data: AiAssistantResult = {
      mode: AiAssistantMode.SYNONYM,
      input: word,
      output: outputText,
      details: { word, synonyms: result.synonyms },
      provider: null,
      model: null,
    };
    return c.json({ success: true, data });
  },
);

const aiGrammarBodySchema = z.object({
  text: z.string().min(1).max(5000, '文本过长，请控制在 5000 字符以内'),
});

app.post(
  '/student/ai/grammar',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  // Bug #173: 同其他 AI 助手，5/min 缺 day-level 限流；加 30/day。
  rateLimit(5, 60_000),
  rateLimit(30, 24 * 60 * 60_000),
  zValidator('json', aiGrammarBodySchema),
  async (c) => {
    const user = c.get('user');
    const { text } = c.req.valid('json');
    const start = Date.now();
    routesLogger.info({ userId: user.id }, '[API /student/ai/grammar]');
    const router = getAiRouter();
    if (router.availableNames().length === 0) {
      return c.json({ success: false, error: 'AI 服务未配置' }, 503);
    }
    let result: Awaited<ReturnType<typeof checkGrammar>>;
    try {
      result = await checkGrammar(router, text);
    } catch (err) {
      routesLogger.warn(
        { userId: user.id, error: err instanceof Error ? err.message : 'unknown' },
        '[API /student/ai/grammar]',
      );
      return c.json({ success: false, error: 'AI 调用失败，请稍后重试' }, 500);
    }
    const now = new Date().toISOString();
    const outputText = `${result.errors.length} errors found`;
    await db.insert(aiConversations).values({
      id: randomUUID(),
      studentId: user.id,
      mode: AiAssistantMode.GRAMMAR,
      inputText: text,
      outputText,
      metadata: JSON.stringify({ errors: result.errors }),
      aiProvider: null,
      aiModel: null,
      tokensUsed: null,
      createdAt: now,
    });
    const duration = Date.now() - start;
    routesLogger.info({ userId: user.id, duration: duration }, '[API /student/ai/grammar]');
    const data: AiAssistantResult = {
      mode: AiAssistantMode.GRAMMAR,
      input: text,
      output: outputText,
      details: { errors: result.errors },
      provider: null,
      model: null,
    };
    return c.json({ success: true, data });
  },
);

app.get('/student/ai/history', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const offset = parseNonNegativeInt(c.req.query('offset'), 0);
  const limit = parsePositiveInt(c.req.query('limit'), 20, 100);
  const mode = c.req.query('mode');
  routesLogger.info(
    { userId: user.id, offset: offset, limit: limit, mode: mode ?? 'all' },
    '[API /student/ai/history]',
  );
  const conditions = [eq(aiConversations.studentId, user.id)];
  if (mode) conditions.push(eq(aiConversations.mode, mode));
  const rows = await db.query.aiConversations.findMany({
    where: and(...conditions),
    orderBy: desc(aiConversations.createdAt),
    offset,
    limit,
  });
  const data: AiConversation[] = rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    mode: r.mode as AiConversation['mode'],
    inputText: r.inputText,
    outputText: r.outputText,
    metadata: safeJsonObject(r.metadata),
    aiProvider: r.aiProvider,
    aiModel: r.aiModel,
    tokensUsed: r.tokensUsed,
    createdAt: r.createdAt,
  }));
  return c.json({ success: true, data });
});

// ========== Student Practice ==========
app.get('/student/question-bank', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const topicType = c.req.query('topicType');
  const difficulty = c.req.query('difficulty');
  const offset = parseNonNegativeInt(c.req.query('offset'), 0);
  const limit = parsePositiveInt(c.req.query('limit'), 20, 100);
  routesLogger.info(
    { userId: user.id, topicType: topicType ?? 'all', difficulty: difficulty ?? 'all' },
    '[API /student/question-bank]',
  );
  const conditions = [eq(questionBank.isPublic, 1)];
  if (topicType) conditions.push(eq(questionBank.topicType, topicType));
  if (difficulty) conditions.push(eq(questionBank.difficulty, difficulty));
  const rows = await db.query.questionBank.findMany({
    where: and(...conditions),
    orderBy: desc(questionBank.createdAt),
    offset,
    limit,
  });
  const data: QuestionBankItem[] = rows.map((r) => ({
    id: r.id,
    topicType: r.topicType,
    topicCategory: r.topicCategory,
    title: r.title,
    requirements: r.requirements,
    keyPoints: safeJsonArray(r.keyPoints),
    referenceEssay: r.referenceEssay,
    wordLimitMin: r.wordLimitMin,
    wordLimitMax: r.wordLimitMax,
    timeLimitMinutes: r.timeLimitMinutes,
    difficulty: r.difficulty as QuestionBankItem['difficulty'],
    source: r.source,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  return c.json({ success: true, data });
});

app.get('/student/question-bank/:id', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  routesLogger.info({ userId: user.id, id: id }, '[API /student/question-bank/:id]');
  // Bug #160: 之前不校验 isPublic，未来若 admin 创建私有题目（题库编辑权限），
  // 学生可直接 GET 私有题。防御性加上 isPublic=1 过滤。
  const r = await db.query.questionBank.findFirst({
    where: and(eq(questionBank.id, id), eq(questionBank.isPublic, 1)),
  });
  if (!r) return c.json({ success: false, error: '题目不存在' }, 404);
  const data: QuestionBankItem = {
    id: r.id,
    topicType: r.topicType,
    topicCategory: r.topicCategory,
    title: r.title,
    requirements: r.requirements,
    keyPoints: safeJsonArray(r.keyPoints),
    referenceEssay: r.referenceEssay,
    wordLimitMin: r.wordLimitMin,
    wordLimitMax: r.wordLimitMax,
    timeLimitMinutes: r.timeLimitMinutes,
    difficulty: r.difficulty as QuestionBankItem['difficulty'],
    source: r.source,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
  return c.json({ success: true, data });
});

const practiceBodySchema = z.object({
  questionId: z.string().optional(),
  content: z.string().min(1).max(10000, '练习内容过长，请控制在 10000 字符以内'),
  durationMs: z.number().optional(),
  exerciseType: z.string().default(ExerciseType.QUESTION_BANK),
});

app.post(
  '/student/practice',
  // Bug #93: 学生可无限提交 practice 触发 AI 调用（语法检查），加 10/min + 100/day 限制。
  rateLimit(10, 60_000),
  rateLimit(100, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', practiceBodySchema),
  async (c) => {
    const user = c.get('user');
    const { questionId, content, durationMs, exerciseType } = c.req.valid('json');
    const start = Date.now();
    routesLogger.info(
      { userId: user.id, questionId: questionId ?? 'none' },
      '[API /student/practice]',
    );
    const wordCount = countWords(content);
    const now = new Date().toISOString();
    let question = null;
    if (questionId) {
      // Bug #171: 之前不校验 isPublic，若 admin 后续创建私有题目，学生可直接用其 ID
      // 触发 AI 批改并把 questionId 写入 practice_exercises，未来 admin 查学生历史
      // 时私有题会通过 questionId 泄露。防御性加 isPublic=1。
      question = await db.query.questionBank.findFirst({
        where: and(eq(questionBank.id, questionId), eq(questionBank.isPublic, 1)),
      });
      if (!question) {
        return c.json({ success: false, error: '题目不存在' }, 404);
      }
    }
    const router = getAiRouter();
    let feedback: GrammarResult = { errors: [] };
    if (router.availableNames().length > 0) {
      try {
        feedback = await checkGrammar(router, content);
      } catch (err) {
        routesLogger.warn(
          { userId: user.id, error: err instanceof Error ? err.message : 'unknown' },
          '[API /student/practice] grammar check failed',
        );
      }
    }
    const [exercise] = await db
      .insert(practiceExercises)
      .values({
        id: randomUUID(),
        studentId: user.id,
        exerciseType,
        questionId: questionId ?? null,
        topicType: question?.topicType ?? null,
        title: question?.title ?? null,
        content,
        wordCount,
        score: null,
        scoreTier: null,
        aiFeedback: JSON.stringify({ errors: feedback.errors }),
        durationMs: durationMs ?? null,
        status: 'completed',
        submittedAt: now,
        createdAt: now,
      })
      .returning();
    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, exerciseId: exercise.id, duration: duration },
      '[API /student/practice]',
    );
    return c.json({ success: true, data: { exercise, feedback } });
  },
);

app.post(
  '/student/practice/deep',
  // Bug #93: deep practice 直接入队 essay 批改，限制 3/min + 20/day 防滥用。
  rateLimit(3, 60_000),
  rateLimit(20, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', practiceBodySchema),
  async (c) => {
    const user = c.get('user');
    const { content } = c.req.valid('json');
    const start = Date.now();
    routesLogger.info({ userId: user.id }, '[API /student/practice/deep]');
    const wordCount = countWords(content);
    const now = new Date().toISOString();
    const essayId = randomUUID();
    await db.insert(essays).values({
      id: essayId,
      studentId: user.id,
      taskId: null,
      title: null,
      content,
      wordCount,
      status: 'pending',
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await addCorrectionJob(essayId);
    const duration = Date.now() - start;
    routesLogger.info(
      { userId: user.id, essayId: essayId, duration: duration },
      '[API /student/practice/deep]',
    );
    return c.json({ success: true, data: { essayId } });
  },
);

app.get('/student/practice/history', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const offset = parseNonNegativeInt(c.req.query('offset'), 0);
  const limit = parsePositiveInt(c.req.query('limit'), 20, 100);
  routesLogger.info(
    { userId: user.id, offset: offset, limit: limit },
    '[API /student/practice/history]',
  );
  const rows = await db.query.practiceExercises.findMany({
    where: eq(practiceExercises.studentId, user.id),
    orderBy: desc(practiceExercises.createdAt),
    offset,
    limit,
  });
  const data: PracticeExercise[] = rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    exerciseType: r.exerciseType as PracticeExercise['exerciseType'],
    questionId: r.questionId,
    topicType: r.topicType,
    title: r.title,
    content: r.content,
    wordCount: r.wordCount,
    score: r.score,
    scoreTier: r.scoreTier,
    aiFeedback: safeJsonObject(r.aiFeedback),
    durationMs: r.durationMs,
    status: r.status,
    startedAt: r.startedAt,
    submittedAt: r.submittedAt,
    createdAt: r.createdAt,
  }));
  return c.json({ success: true, data });
});

// ========== Student Progress ==========
app.get('/student/progress', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const start = Date.now();
  routesLogger.info({ userId: user.id }, '[API /student/progress]');
  // Bug #119: 之前硬编码 limit:200，活跃学生单次拉满 200 条作文会触发深 N+1（每条带
  // correction JOIN），且响应体过大。这里维持 200 上限（满足进度曲线/雷达图的统计
  // 需求），但加上明确注释并按 completedAt 倒序；后续可改为分页 / 物化视图。
  const studentEssays = await db.query.essays.findMany({
    where: eq(essays.studentId, user.id),
    with: { correction: true },
    orderBy: desc(essays.createdAt),
    limit: 200,
  });
  const completedEssays = studentEssays.filter((e) => e.status === 'completed');
  const allScores = completedEssays.map((e) => e.totalScore).filter((s): s is number => s !== null);
  const averageScore =
    allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  const radarData = calculateAbilityRadar(
    completedEssays.map((e) => ({
      topicAdherenceScore: e.correction?.topicAdherenceScore ?? null,
      contentScore: e.correction?.contentScore ?? null,
      languageScore: e.correction?.languageScore ?? null,
      structureScore: e.correction?.structureScore ?? null,
      presentationScore: e.correction?.presentationScore ?? null,
    })),
  );
  const progressCurve = calculateProgressCurve(
    completedEssays.map((e) => ({
      totalScore: e.totalScore,
      submittedAt: e.submittedAt,
    })),
  );
  const earnedAchievements = await db.query.achievements.findMany({
    where: eq(achievements.studentId, user.id),
  });
  let rank: { classRank: number; total: number; percentile: number } | null = null;
  const myEnrollments = await db.query.classEnrollments.findMany({
    where: and(eq(classEnrollments.userId, user.id), eq(classEnrollments.role, 'student')),
    columns: { classId: true },
  });
  if (myEnrollments.length > 0 && averageScore !== null) {
    const classId = myEnrollments[0].classId;
    const peerEnrollments = await db.query.classEnrollments.findMany({
      where: and(eq(classEnrollments.classId, classId), eq(classEnrollments.role, 'student')),
      columns: { userId: true },
    });
    const peerIds = peerEnrollments.map((e) => e.userId).filter((id) => id !== user.id);
    if (peerIds.length > 0) {
      const peerEssays = await db.query.essays.findMany({
        where: and(inArray(essays.studentId, peerIds), eq(essays.status, 'completed')),
        columns: { studentId: true, totalScore: true },
      });
      const peerAvgMap = new Map<string, number[]>();
      for (const e of peerEssays) {
        if (e.totalScore === null) continue;
        let arr = peerAvgMap.get(e.studentId);
        if (!arr) {
          arr = [];
          peerAvgMap.set(e.studentId, arr);
        }
        arr.push(e.totalScore);
      }
      const peerAverages = Array.from(peerAvgMap.values()).map(
        (arr) => arr.reduce((a, b) => a + b, 0) / arr.length,
      );
      rank = calculateClassRank(averageScore, peerAverages);
    }
  }
  const level: StudentProgress['level'] =
    averageScore === null
      ? 'basic'
      : averageScore < 9
        ? 'basic'
        : averageScore < 12
          ? 'improving'
          : 'advanced';
  const data: StudentProgress = {
    studentId: user.id,
    totalEssays: completedEssays.length,
    averageScore,
    radarData,
    progressCurve,
    achievements: earnedAchievements.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      code: a.code,
      tier: a.tier as Achievement['tier'],
      title: a.title,
      description: a.description,
      icon: a.icon,
      earnedAt: a.earnedAt,
      isUnlocked: true,
    })),
    rank,
    level,
  };
  const duration = Date.now() - start;
  routesLogger.info(
    { userId: user.id, essays: completedEssays.length, duration: duration },
    '[API /student/progress]',
  );
  return c.json({ success: true, data });
});

app.get('/student/achievements', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const start = Date.now();
  routesLogger.info({ userId: user.id }, '[API /student/achievements]');
  const earned = await db.query.achievements.findMany({
    where: eq(achievements.studentId, user.id),
  });
  const earnedMap = new Map(earned.map((a) => [a.code, a]));
  const earnedCodes = new Set(earned.map((a) => a.code));
  // Bug #119: 硬编码 limit:200 与 /student/progress 同样的考量 —— 满足成就统计的近因
  // 窗口即可，无需分页；显式注释后续可切换为物化视图或按需增量。
  const studentEssays = await db.query.essays.findMany({
    where: eq(essays.studentId, user.id),
    with: { correction: true },
    orderBy: desc(essays.createdAt),
    limit: 200,
  });
  const completedEssays = studentEssays.filter((e) => e.status === 'completed');
  const allScores = completedEssays.map((e) => e.totalScore).filter((s): s is number => s !== null);
  const averageScore =
    allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  const perfectScores = allScores.filter((s) => s >= 15).length;
  const asc = completedEssays.slice().sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  let streak = 0;
  let maxStreak = 0;
  let prev: number | null = null;
  for (const e of asc) {
    if (e.totalScore === null) {
      streak = 0;
      prev = null;
      continue;
    }
    if (prev !== null && e.totalScore > prev) {
      streak++;
      if (streak > maxStreak) maxStreak = streak;
    } else {
      streak = 0;
    }
    prev = e.totalScore;
  }
  let errorFreeEssays = 0;
  for (const e of completedEssays) {
    try {
      const errs = JSON.parse(e.correction?.errors ?? '[]');
      if (Array.isArray(errs) && errs.length === 0) errorFreeEssays++;
    } catch {}
  }
  const expectedCodes = checkAchievements({
    totalEssays: completedEssays.length,
    averageScore,
    perfectScores,
    consecutiveProgress: maxStreak,
    errorFreeEssays,
  });
  const now = new Date().toISOString();
  const unlockedNotRecorded = expectedCodes.filter((code) => !earnedCodes.has(code));
  if (unlockedNotRecorded.length > 0) {
    const newRecords = unlockedNotRecorded
      .map((code) => {
        const item = ACHIEVEMENT_CATALOG.find((c) => c.code === code);
        if (!item) return null;
        return {
          id: randomUUID(),
          studentId: user.id,
          code,
          tier: item.tier,
          title: item.title,
          description: item.description,
          icon: item.icon,
          earnedAt: now,
          createdAt: now,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    await db.insert(achievements).values(newRecords).onConflictDoNothing();
    for (const rec of newRecords) {
      earnedMap.set(rec.code, rec);
    }
    routesLogger.info(
      { userId: user.id, unlockedButNotRecorded: unlockedNotRecorded.join(',') },
      '[API /student/achievements]',
    );
  }
  const list: Achievement[] = ACHIEVEMENT_CATALOG.map((item) => {
    const rec = earnedMap.get(item.code);
    if (rec) {
      return {
        id: rec.id,
        studentId: rec.studentId,
        code: rec.code,
        tier: rec.tier as Achievement['tier'],
        title: rec.title,
        description: rec.description,
        icon: rec.icon,
        earnedAt: rec.earnedAt,
        isUnlocked: true,
      };
    }
    return {
      id: '',
      studentId: user.id,
      code: item.code,
      tier: item.tier,
      title: item.title,
      description: item.description,
      icon: item.icon,
      earnedAt: '',
      isUnlocked: false,
    };
  });
  const duration = Date.now() - start;
  routesLogger.info(
    { userId: user.id, earned: earned.length, duration: duration },
    '[API /student/achievements]',
  );
  return c.json({ success: true, data: list });
});

// ========== Student Dashboard & Drafts ==========
app.get('/student/dashboard', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const start = Date.now();
  routesLogger.info({ userId: user.id }, '[API /student/dashboard]');

  const data = await memoizeAsync(`student_dash:${user.id}`, 60_000, async () => {
    const enrollments = await db.query.classEnrollments.findMany({
      where: and(eq(classEnrollments.userId, user.id), eq(classEnrollments.role, 'student')),
      columns: { classId: true },
    });
    const classIds = enrollments.map((e) => e.classId);
    // Bug #151: 之前 teachingResources 拉 limit:100 全部到内存再随机选 1 条，
    // 资源表大时浪费 IO；改为 COUNT 一下总数后用 OFFSET 随机偏移，仅取 1 条。
    const sentenceCount = await db
      .select({ value: count() })
      .from(teachingResources)
      .where(eq(teachingResources.type, TeachingResourceType.SENTENCE));
    const total = Number(sentenceCount[0]?.value ?? 0);
    let sentenceResource: { id: string; title: string; content: string } | undefined;
    if (total > 0) {
      const offset = Math.floor(Math.random() * total);
      const [pick] = await db
        .select({
          id: teachingResources.id,
          title: teachingResources.title,
          content: teachingResources.content,
        })
        .from(teachingResources)
        .where(eq(teachingResources.type, TeachingResourceType.SENTENCE))
        .limit(1)
        .offset(offset);
      sentenceResource = pick;
    }
    const [pendingTasksRows, studentEssays] = await Promise.all([
      classIds.length > 0
        ? db.query.essayTasks.findMany({
            where: and(inArray(essayTasks.classId, classIds), eq(essayTasks.status, 'published')),
            columns: { id: true },
          })
        : Promise.resolve([]),
      db.query.essays.findMany({
        where: eq(essays.studentId, user.id),
        columns: { status: true, totalScore: true },
      }),
    ]);
    const pendingTasks = pendingTasksRows.length;
    const completedEssays = studentEssays.filter((e) => e.status === 'completed');
    const correctedEssays = completedEssays.length;
    const allScores = completedEssays
      .map((e) => e.totalScore)
      .filter((s): s is number => s !== null);
    const averageScore =
      allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
    let quote: DailyQuote | null = null;
    if (sentenceResource) {
      quote = { id: sentenceResource.id, text: sentenceResource.content, translation: null, source: sentenceResource.title };
    }
    return { pendingTasks, correctedEssays, averageScore, quote };
  });

  const duration = Date.now() - start;
  routesLogger.info(
    {
      userId: user.id,
      pending: data.pendingTasks,
      corrected: data.correctedEssays,
      duration: duration,
    },
    '[API /student/dashboard]',
  );
  return c.json({ success: true, data });
});

app.get('/student/drafts/:taskId', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const taskId = c.req.param('taskId');
  routesLogger.info({ userId: user.id, taskId: taskId }, '[API /student/drafts/:taskId GET]');
  // Bug #132 续: 读取草稿同样需要校验学生在该 task 所属班级。
  // 任务不存在/学生未在班级 → 返回空草稿（与未写过草稿一致），避免泄露任务存在性。
  const task = await db.query.essayTasks.findFirst({
    where: eq(essayTasks.id, taskId),
    columns: { id: true, classId: true },
  });
  if (!task) return c.json({ success: true, data: null });
  const enrolled = await db.query.classEnrollments.findFirst({
    where: and(eq(classEnrollments.classId, task.classId), eq(classEnrollments.userId, user.id)),
  });
  if (!enrolled) return c.json({ success: true, data: null });
  const draft = await db.query.essayDrafts.findFirst({
    where: and(eq(essayDrafts.studentId, user.id), eq(essayDrafts.taskId, taskId)),
  });
  if (!draft) return c.json({ success: true, data: null });
  const data: EssayDraft = {
    id: draft.id,
    studentId: draft.studentId,
    taskId: draft.taskId,
    content: draft.content,
    wordCount: draft.wordCount,
    durationMs: draft.durationMs,
    updatedAt: draft.updatedAt,
  };
  return c.json({ success: true, data });
});

const draftBodySchema = z.object({
  // Bug #170: 草稿内容原 schema 仅有 min(1) 无 max，学生可塞 1MB 文本反复写入。
  // 限制 50KB 与正式 essay 提交的 5000 字符（≈ 5KB）相比留足余量（学生可能粘贴长引文）。
  content: z.string().min(1).max(50_000),
  wordCount: z.number().optional(),
  durationMs: z.number().optional(),
});

app.post(
  '/student/drafts/:taskId',
  // Bug #170 续: 草稿自动保存可能高频触发，但 30/min + 200/day 足够（每 2 秒 1 次），
  // 再快就属于滥用（批量扫或脚本）。
  rateLimit(30, 60_000),
  rateLimit(200, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', draftBodySchema),
  async (c) => {
    const user = c.get('user');
    const taskId = c.req.param('taskId');
    const { content, wordCount, durationMs } = c.req.valid('json');
    const now = new Date().toISOString();
    routesLogger.info({ userId: user.id, taskId: taskId }, '[API /student/drafts/:taskId POST]');

    // Bug #132: 之前没有校验学生是否在 task 所属班级。学生可以传入任意 taskId
    // 写一篇"草稿"（也可能成为以后 getDraft 时的越权读取向量）；
    // 改为：必须先存在该 task 且学生在其 classId 中已 enrollment。
    const task = await db.query.essayTasks.findFirst({
      where: eq(essayTasks.id, taskId),
      columns: { id: true, classId: true },
    });
    if (!task) {
      return c.json({ success: false, error: '作文任务不存在' }, 404);
    }
    const enrolled = await db.query.classEnrollments.findFirst({
      where: and(eq(classEnrollments.classId, task.classId), eq(classEnrollments.userId, user.id)),
    });
    if (!enrolled) {
      return c.json({ success: false, error: '无权保存该任务的草稿' }, 403);
    }

    // Bug #172: 之前 findFirst → insert/update 存在 TOCTOU 竞态：两个并发请求
    // 都读到空 existing → 都尝试 INSERT → 第二次被 UNIQUE(studentId, taskId) 拦截抛
    // 500 错误。改为基于 uniqueIndex 的 INSERT ... ON CONFLICT DO UPDATE 原子 upsert。
    const [row] = await db
      .insert(essayDrafts)
      .values({
        id: randomUUID(),
        studentId: user.id,
        taskId,
        content,
        wordCount: wordCount ?? null,
        durationMs: durationMs ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [essayDrafts.studentId, essayDrafts.taskId],
        set: {
          content,
          wordCount: wordCount ?? null,
          durationMs: durationMs ?? null,
          updatedAt: now,
        },
      })
      .returning();
    const data: EssayDraft = {
      id: row.id,
      studentId: row.studentId,
      taskId: row.taskId,
      content: row.content,
      wordCount: row.wordCount,
      durationMs: row.durationMs,
      updatedAt: row.updatedAt,
    };
    return c.json({ success: true, data });
  },
);

app.delete('/student/drafts/:taskId', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const taskId = c.req.param('taskId');
  routesLogger.info({ userId: user.id, taskId: taskId }, '[API /student/drafts/:taskId DELETE]');
  await db
    .delete(essayDrafts)
    .where(and(eq(essayDrafts.studentId, user.id), eq(essayDrafts.taskId, taskId)));
  return c.json({ success: true });
});

// ========== Admin: Dashboard ==========
app.get('/admin/dashboard/stats', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  const user = c.get('user');
  const startedAt = Date.now();
  routesLogger.info({ userId: user.id }, '[API /admin/dashboard/stats]');

  try {
    const data = await memoizeAsync(`admin_dash:${user.id}`, 60_000, async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const [
        schoolCount,
        teacherCount,
        studentCount,
        essayCount,
        todayEssayCount,
        activeStudentCount,
        apiCallsToday,
        apiCallsTotal,
        apiSuccessCount,
        latencyRow,
      ] = await Promise.all([
        db.select({ value: count() }).from(schools),
        db.select({ value: count() }).from(users).where(eq(users.role, UserRole.TEACHER)),
        db.select({ value: count() }).from(users).where(eq(users.role, UserRole.STUDENT)),
        db.select({ value: count() }).from(essays),
        db.select({ value: count() }).from(essays).where(gte(essays.submittedAt, todayIso)),
        db
          .select({ value: count() })
          .from(users)
          .where(and(eq(users.role, UserRole.STUDENT), eq(users.isActive, true))),
        db.select({ value: count() }).from(apiCallLogs).where(gte(apiCallLogs.createdAt, todayIso)),
        db.select({ value: count() }).from(apiCallLogs),
        db.select({ value: count() }).from(apiCallLogs).where(eq(apiCallLogs.status, 'success')),
        db.select({ avg: sql<number>`AVG(${apiCallLogs.latencyMs})` }).from(apiCallLogs),
      ]);

      const totalApi = Number(apiCallsTotal[0]?.value ?? 0);
      const successApi = Number(apiSuccessCount[0]?.value ?? 0);
      const totalStudents = Number(studentCount[0]?.value ?? 0);
      return {
        totalSchools: Number(schoolCount[0]?.value ?? 0),
        totalTeachers: Number(teacherCount[0]?.value ?? 0),
        totalStudents,
        totalEssays: Number(essayCount[0]?.value ?? 0),
        todayEssays: Number(todayEssayCount[0]?.value ?? 0),
        activeRate:
          totalStudents === 0
            ? 0
            : Math.round((Number(activeStudentCount[0]?.value ?? 0) / totalStudents) * 100),
        apiCallsToday: Number(apiCallsToday[0]?.value ?? 0),
        apiCallsTotal: totalApi,
        apiSuccessRate: totalApi === 0 ? 0 : Math.round((successApi / totalApi) * 100),
        apiAvgLatencyMs: Math.round(Number(latencyRow[0]?.avg ?? 0)),
      } satisfies AdminDashboardStats;
    });

    routesLogger.info(
      { duration: Date.now() - startedAt, schools: data.totalSchools },
      '[API /admin/dashboard/stats] exit',
    );
    return c.json({ success: true, data });
  } catch (err) {
    routesLogger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      '[API /admin/dashboard/stats] error:',
    );
    return c.json({ success: false, error: '获取仪表盘统计失败' }, 500);
  }
});

// ========== Admin: Schools ==========
const schoolCreateSchema = z.object({
  code: z.string().min(1, '学校代码不能为空'),
  name: z.string().min(1, '学校名称不能为空'),
  region: z.string().min(1, '所属区域不能为空'),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});

const schoolUpdateSchema = schoolCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

app.get('/admin/schools', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  const user = c.get('user');
  const startedAt = Date.now();
  const region = c.req.query('region');
  const offset = parseNonNegativeInt(c.req.query('offset'), 0);
  const limit = parsePositiveInt(c.req.query('limit'), 50, 200);
  routesLogger.info(
    { userId: user.id, region: region ?? 'all', offset: offset, limit: limit },
    '[API /admin/schools]',
  );

  try {
    const where = region ? eq(schools.region, region) : undefined;
    const rows = await db.query.schools.findMany({
      where,
      orderBy: desc(schools.createdAt),
      limit,
      offset,
    });

    const schoolIds = rows.map((s) => s.id);

    const [teacherCounts, studentCounts, classCounts, essayCounts, scoreAverages] =
      await Promise.all([
        db
          .select({ schoolId: users.schoolId, value: count() })
          .from(users)
          .where(and(inArray(users.schoolId, schoolIds), eq(users.role, UserRole.TEACHER)))
          .groupBy(users.schoolId),
        db
          .select({ schoolId: users.schoolId, value: count() })
          .from(users)
          .where(and(inArray(users.schoolId, schoolIds), eq(users.role, UserRole.STUDENT)))
          .groupBy(users.schoolId),
        db
          .select({ schoolId: classes.schoolId, value: count() })
          .from(classes)
          .where(inArray(classes.schoolId, schoolIds))
          .groupBy(classes.schoolId),
        db
          .select({ schoolId: users.schoolId, value: count() })
          .from(essays)
          .innerJoin(users, eq(essays.studentId, users.id))
          .where(inArray(users.schoolId, schoolIds))
          .groupBy(users.schoolId),
        db
          .select({ schoolId: users.schoolId, avg: sql<number>`AVG(${essays.totalScore})` })
          .from(essays)
          .innerJoin(users, eq(essays.studentId, users.id))
          .where(and(inArray(users.schoolId, schoolIds), sql`${essays.totalScore} IS NOT NULL`))
          .groupBy(users.schoolId),
      ]);

    const teacherMap = new Map(teacherCounts.map((r) => [r.schoolId, Number(r.value)]));
    const studentMap = new Map(studentCounts.map((r) => [r.schoolId, Number(r.value)]));
    const classMap = new Map(classCounts.map((r) => [r.schoolId, Number(r.value)]));
    const essayMap = new Map(essayCounts.map((r) => [r.schoolId, Number(r.value)]));
    const scoreMap = new Map(scoreAverages.map((r) => [r.schoolId, r.avg]));

    const stats: SchoolWithStats[] = rows.map((s) => {
      const avg = scoreMap.get(s.id);
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        region: s.region,
        contactName: s.contactName,
        contactPhone: s.contactPhone,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        totalTeachers: teacherMap.get(s.id) ?? 0,
        totalStudents: studentMap.get(s.id) ?? 0,
        totalClasses: classMap.get(s.id) ?? 0,
        totalEssays: essayMap.get(s.id) ?? 0,
        averageScore: avg != null ? Math.round(Number(avg) * 10) / 10 : null,
      };
    });

    routesLogger.info(
      { duration: Date.now() - startedAt, count: stats.length },
      '[API /admin/schools] exit',
    );
    return c.json({ success: true, data: stats });
  } catch (err) {
    routesLogger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      '[API /admin/schools] error:',
    );
    return c.json({ success: false, error: '获取学校列表失败' }, 500);
  }
});

app.post(
  '/admin/schools',
  // Bug #136: 学校创建无 rateLimit；admin 失误可瞬间塞几百条。
  rateLimit(10, 60_000),
  rateLimit(100, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  zValidator('json', schoolCreateSchema),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const body = c.req.valid('json');
    routesLogger.info(
      { userId: user.id, code: body.code, name: body.name },
      '[API /admin/schools POST]',
    );

    try {
      // Bug #95: 规范化 code（trim + 大写），避免同一所学校因大小写重复或前后空格产生重复记录。
      const code = body.code.trim().toUpperCase();
      const existing = await db.query.schools.findFirst({ where: eq(schools.code, code) });
      if (existing) {
        return c.json({ success: false, error: '学校代码已存在' }, 409);
      }
      const now = new Date().toISOString();
      const id = randomUUID();
      await db.insert(schools).values({
        id,
        code,
        name: body.name,
        region: body.region,
        contactName: body.contactName ?? null,
        contactPhone: body.contactPhone ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      routesLogger.info(
        { duration: Date.now() - startedAt, id: id },
        '[API /admin/schools POST] exit',
      );
      return c.json({ success: true, data: { id } }, 201);
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/schools POST] error:',
      );
      return c.json({ success: false, error: '创建学校失败' }, 500);
    }
  },
);

app.put(
  '/admin/schools/:id',
  // Bug #136: 编辑学校也限流，与 POST 对齐。
  rateLimit(10, 60_000),
  rateLimit(100, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  zValidator('json', schoolUpdateSchema),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const id = c.req.param('id');
    const body = c.req.valid('json');
    routesLogger.info({ userId: user.id, id: id }, '[API /admin/schools/:id PUT]');

    try {
      const existing = await db.query.schools.findFirst({ where: eq(schools.id, id) });
      if (!existing) {
        return c.json({ success: false, error: '学校不存在' }, 404);
      }
      // Bug #106: 改 code 时未做唯一性校验，两所学校可拥有相同 code，违反业务唯一性。
      if (body.code !== undefined && body.code !== existing.code) {
        // Bug #95: 同样的规范化规则，保证 POST/PUT 的 code 形态一致。
        const code = body.code.trim().toUpperCase();
        if (code !== existing.code) {
          const dup = await db.query.schools.findFirst({ where: eq(schools.code, code) });
          if (dup && dup.id !== id) {
            return c.json({ success: false, error: '学校代码已存在' }, 409);
          }
        }
      }
      const normalizedCode =
        body.code !== undefined ? body.code.trim().toUpperCase() : undefined;
      const now = new Date().toISOString();
      await db
        .update(schools)
        .set({
          ...(normalizedCode !== undefined && { code: normalizedCode }),
          ...(body.name !== undefined && { name: body.name }),
          ...(body.region !== undefined && { region: body.region }),
          ...(body.contactName !== undefined && { contactName: body.contactName }),
          ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
          updatedAt: now,
        })
        .where(eq(schools.id, id));
      routesLogger.info({ duration: Date.now() - startedAt }, '[API /admin/schools/:id PUT] exit');
      return c.json({ success: true });
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/schools/:id PUT] error:',
      );
      return c.json({ success: false, error: '更新学校失败' }, 500);
    }
  },
);

app.delete(
  '/admin/schools/:id',
  // Bug #136: 关停学校涉及级联禁用师生+失效 session，开销大，限流。
  rateLimit(5, 60_000),
  rateLimit(50, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const id = c.req.param('id');
    routesLogger.info({ userId: user.id, id: id }, '[API /admin/schools/:id DELETE]');

    try {
      const existing = await db.query.schools.findFirst({ where: eq(schools.id, id) });
      if (!existing) {
        return c.json({ success: false, error: '学校不存在' }, 404);
      }
      const now = new Date().toISOString();
      await db.update(schools).set({ isActive: false, updatedAt: now }).where(eq(schools.id, id));
      // Bug #50: 学校软删除后，关联的教师/学生仍能用旧 session 登录、读写数据；
      // 改为在关停学校的同时级联禁用其下所有用户，并清空其 active sessions。
      const schoolUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.schoolId, id));
      const userIds = schoolUsers.map((u) => u.id);
      if (userIds.length > 0) {
        await db
          .update(users)
          .set({ isActive: false, updatedAt: now })
          .where(inArray(users.id, userIds));
        // 失效这些用户的所有 session，强制下线
        for (const uid of userIds) {
          await lucia.invalidateUserSessions(uid).catch(() => {
            /* session 可能本来就不存在，忽略 */
          });
        }
      }
      routesLogger.info(
        { duration: Date.now() - startedAt },
        '[API /admin/schools/:id DELETE] exit',
      );
      return c.json({ success: true });
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/schools/:id DELETE] error:',
      );
      return c.json({ success: false, error: '删除学校失败' }, 500);
    }
  },
);

app.get(
  '/admin/schools/:id/stats',
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const id = c.req.param('id');
    routesLogger.info({ userId: user.id, id: id }, '[API /admin/schools/:id/stats]');

    try {
      const school = await db.query.schools.findFirst({ where: eq(schools.id, id) });
      if (!school) {
        return c.json({ success: false, error: '学校不存在' }, 404);
      }
      const [teacherRow] = await db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.schoolId, id), eq(users.role, UserRole.TEACHER)));
      const [studentRow] = await db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.schoolId, id), eq(users.role, UserRole.STUDENT)));
      const [classRow] = await db
        .select({ value: count() })
        .from(classes)
        .where(eq(classes.schoolId, id));
      const studentIds = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.schoolId, id), eq(users.role, UserRole.STUDENT)));
      const studentIdList = studentIds.map((r) => r.id);
      let totalEssays = 0;
      let averageScore: number | null = null;
      if (studentIdList.length > 0) {
        const [essayRow] = await db
          .select({ value: count() })
          .from(essays)
          .where(inArray(essays.studentId, studentIdList));
        totalEssays = Number(essayRow?.value ?? 0);
        const scoreRow = await db
          .select({ avg: sql<number>`AVG(${essays.totalScore})` })
          .from(essays)
          .where(
            and(inArray(essays.studentId, studentIdList), sql`${essays.totalScore} IS NOT NULL`),
          );
        averageScore =
          scoreRow[0]?.avg != null ? Math.round(Number(scoreRow[0].avg) * 10) / 10 : null;
      }
      const [activeStudentRow] = await db
        .select({ value: count() })
        .from(users)
        .where(
          and(eq(users.schoolId, id), eq(users.role, UserRole.STUDENT), eq(users.isActive, true)),
        );

      const data: SchoolStats = {
        schoolId: school.id,
        schoolName: school.name,
        totalTeachers: Number(teacherRow?.value ?? 0),
        totalStudents: Number(studentRow?.value ?? 0),
        totalClasses: Number(classRow?.value ?? 0),
        totalEssays,
        averageScore,
        activeRate:
          Number(studentRow?.value ?? 0) === 0
            ? 0
            : Math.round(
                (Number(activeStudentRow?.value ?? 0) / Number(studentRow?.value ?? 0)) * 100,
              ),
      };
      routesLogger.info(
        { duration: Date.now() - startedAt },
        '[API /admin/schools/:id/stats] exit',
      );
      return c.json({ success: true, data });
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/schools/:id/stats] error:',
      );
      return c.json({ success: false, error: '获取学校统计失败' }, 500);
    }
  },
);

// ========== Admin: API Configs ==========
const apiConfigCreateSchema = z.object({
  provider: z.string().min(1, 'provider 不能为空'),
  apiKey: z.string().min(1, 'apiKey 不能为空'),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  rateLimitPerMin: z.number().optional(),
});

const apiConfigUpdateSchema = apiConfigCreateSchema.partial().omit({ apiKey: true }).extend({
  apiKey: z.string().optional(),
});

app.get('/admin/api-configs', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  const user = c.get('user');
  const startedAt = Date.now();
  routesLogger.info({ userId: user.id }, '[API /admin/api-configs]');

  try {
    const rows = await db.query.apiConfigs.findMany({ orderBy: desc(apiConfigs.priority) });
    const data: ApiConfigItem[] = rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      apiKeyMasked: (() => {
        try {
          return maskKey(decrypt(r.apiKeyEncrypted));
        } catch {
          return '****';
        }
      })(),
      baseUrl: r.baseUrl,
      model: r.model,
      isActive: r.isActive,
      priority: r.priority,
      maxTokens: r.maxTokens,
      temperature: r.temperature,
      rateLimitPerMin: r.rateLimitPerMin,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
    routesLogger.info(
      { duration: Date.now() - startedAt, count: data.length },
      '[API /admin/api-configs] exit',
    );
    return c.json({ success: true, data });
  } catch (err) {
    routesLogger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      '[API /admin/api-configs] error:',
    );
    return c.json({ success: false, error: '获取 API 配置失败' }, 500);
  }
});

app.post(
  '/admin/api-configs',
  // Bug #153: API 配置写入无 rateLimit；admin 失误或脚本失控可能刷大量密钥记录。
  rateLimit(10, 60_000),
  rateLimit(100, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  zValidator('json', apiConfigCreateSchema),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const body = c.req.valid('json');
    routesLogger.info(
      { userId: user.id, provider: body.provider },
      '[API /admin/api-configs POST]',
    );

    try {
      const now = new Date().toISOString();
      const id = randomUUID();
      await db.insert(apiConfigs).values({
        id,
        provider: body.provider,
        apiKeyEncrypted: encrypt(body.apiKey),
        baseUrl: body.baseUrl ?? null,
        model: body.model ?? null,
        isActive: body.isActive ?? true,
        priority: body.priority ?? 0,
        maxTokens: body.maxTokens ?? 4096,
        temperature: body.temperature ?? 0.3,
        rateLimitPerMin: body.rateLimitPerMin ?? 60,
        createdAt: now,
        updatedAt: now,
      });
      routesLogger.info(
        { duration: Date.now() - startedAt, id: id },
        '[API /admin/api-configs POST] exit',
      );
      // Bug #56: AI provider 配置在 web 端写入，worker 是另一个进程不会感知；
      // 必须提示 admin 需重启 worker 才生效。reload 字段供前端展示 toast。
      return c.json(
        { success: true, data: { id, requiresWorkerReload: true } },
        201,
      );
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/api-configs POST] error:',
      );
      return c.json({ success: false, error: '创建 API 配置失败' }, 500);
    }
  },
);

app.put(
  '/admin/api-configs/:id',
  // Bug #164: 与 POST 路径保持同样的限流节奏。
  rateLimit(10, 60_000),
  rateLimit(100, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  zValidator('json', apiConfigUpdateSchema),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const id = c.req.param('id');
    const body = c.req.valid('json');
    routesLogger.info({ userId: user.id, id: id }, '[API /admin/api-configs/:id PUT]');

    try {
      const existing = await db.query.apiConfigs.findFirst({ where: eq(apiConfigs.id, id) });
      if (!existing) {
        return c.json({ success: false, error: 'API 配置不存在' }, 404);
      }
      const now = new Date().toISOString();
      await db
        .update(apiConfigs)
        .set({
          ...(body.provider !== undefined && { provider: body.provider }),
          ...(body.apiKey !== undefined && { apiKeyEncrypted: encrypt(body.apiKey) }),
          ...(body.baseUrl !== undefined && { baseUrl: body.baseUrl }),
          ...(body.model !== undefined && { model: body.model }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.maxTokens !== undefined && { maxTokens: body.maxTokens }),
          ...(body.temperature !== undefined && { temperature: body.temperature }),
          ...(body.rateLimitPerMin !== undefined && { rateLimitPerMin: body.rateLimitPerMin }),
          updatedAt: now,
        })
        .where(eq(apiConfigs.id, id));
      routesLogger.info(
        { duration: Date.now() - startedAt },
        '[API /admin/api-configs/:id PUT] exit',
      );
      // Bug #56: 更新 api config 后 worker 不会热加载；提示需重启。
      return c.json({ success: true, data: { requiresWorkerReload: true } });
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/api-configs/:id PUT] error:',
      );
      return c.json({ success: false, error: '更新 API 配置失败' }, 500);
    }
  },
);

app.delete(
  '/admin/api-configs/:id',
  // Bug #164: 删除路径同样限流，避免脚本扫 id 删光所有 provider。
  rateLimit(10, 60_000),
  rateLimit(100, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const id = c.req.param('id');
    routesLogger.info({ userId: user.id, id: id }, '[API /admin/api-configs/:id DELETE]');

    try {
      // Bug #165: 之前不存在也返回 success，前端无法区分；改为先校验存在性。
      const existing = await db.query.apiConfigs.findFirst({
        where: eq(apiConfigs.id, id),
        columns: { id: true },
      });
      if (!existing) {
        return c.json({ success: false, error: 'API 配置不存在' }, 404);
      }
      await db.delete(apiConfigs).where(eq(apiConfigs.id, id));
      routesLogger.info(
        { duration: Date.now() - startedAt },
        '[API /admin/api-configs/:id DELETE] exit',
      );
      // Bug #56: 删除后 worker 仍可能继续用旧 provider，提示重启。
      return c.json({ success: true, data: { requiresWorkerReload: true } });
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/api-configs/:id DELETE] error:',
      );
      return c.json({ success: false, error: '删除 API 配置失败' }, 500);
    }
  },
);

// ========== Admin: API Logs ==========
app.get('/admin/api-logs', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  const user = c.get('user');
  const startedAt = Date.now();
  const provider = c.req.query('provider');
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');
  // Bug #125: 之前 Number(query ?? '50') 缺 NaN 兜底，且无 total；改为使用统一的
  // parsePositiveInt/parseNonNegativeInt 兜底异常输入，并返回 total 便于前端翻页。
  // Bug #125 续: apiCallLogs 表会无限增长，前端只展示最近 N 条；这里限制 max=500，
  // 真正的长期保留策略应在 worker 中加 retention 任务定期清理（> 90 天）。
  const offset = parseNonNegativeInt(c.req.query('offset'), 0);
  const limit = parsePositiveInt(c.req.query('limit'), 50, 500);

  // Bug #137: dateFrom > dateTo 时整段 SQL 必然返回 0，但前端会误以为没有数据；
  // 解析为可比较的时间字符串后显式拒绝，提示用户修正。
  if (dateFrom && dateTo) {
    const fromMs = Date.parse(dateFrom);
    const toMs = Date.parse(dateTo);
    if (Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs > toMs) {
      return c.json(
        { success: false, error: 'dateFrom 不能晚于 dateTo' },
        400,
      );
    }
  }

  routesLogger.info(
    {
      userId: user.id,
      provider: provider ?? 'all',
      dateFrom: dateFrom ?? '',
      dateTo: dateTo ?? '',
    },
    '[API /admin/api-logs]',
  );

  try {
    const conds = [];
    if (provider) conds.push(eq(apiCallLogs.provider, provider));
    if (dateFrom) conds.push(gte(apiCallLogs.createdAt, dateFrom));
    if (dateTo) conds.push(lt(apiCallLogs.createdAt, dateTo));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

    const rows = await db.query.apiCallLogs.findMany({
      where,
      orderBy: desc(apiCallLogs.createdAt),
      limit,
      offset,
    });

    const totalRow = await db.select({ c: count() }).from(apiCallLogs).where(where);
    const total = totalRow[0]?.c ?? 0;

    const data: ApiCallLogItem[] = rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      model: r.model,
      endpoint: r.endpoint,
      tokensUsed: r.tokensUsed,
      latencyMs: r.latencyMs,
      cost: r.cost,
      status: r.status,
      errorMessage: r.errorMessage,
      essayId: r.essayId,
      createdAt: r.createdAt,
    }));
    routesLogger.info(
      { duration: Date.now() - startedAt, count: data.length },
      '[API /admin/api-logs] exit',
    );
    return c.json({ success: true, data, total, limit, offset });
  } catch (err) {
    routesLogger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      '[API /admin/api-logs] error:',
    );
    return c.json({ success: false, error: '获取 API 日志失败' }, 500);
  }
});

// ========== Admin: Announcements ==========
const announcementCreateSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
  targetRole: z.string().optional(),
  isActive: z.boolean().optional(),
});

const announcementUpdateSchema = announcementCreateSchema.partial();

app.get('/admin/announcements', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  const user = c.get('user');
  const startedAt = Date.now();
  routesLogger.info({ userId: user.id }, '[API /admin/announcements]');

  const limit = Math.max(1, Math.min(200, parsePositiveInt(c.req.query('limit'), 50, 200)));
  const offset = parseNonNegativeInt(c.req.query('offset'), 0);

  try {
    const rows = await db.query.announcements.findMany({
      with: { creator: true },
      orderBy: desc(announcements.createdAt),
      limit,
      offset,
    });
    const totalRow = await db.select({ c: count() }).from(announcements);
    const total = totalRow[0]?.c ?? 0;
    const data: AnnouncementItem[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      targetRole: r.targetRole ?? 'all',
      isActive: r.isActive,
      createdBy: r.createdBy,
      creatorName: r.creator?.name ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
    routesLogger.info(
      { duration: Date.now() - startedAt, count: data.length },
      '[API /admin/announcements] exit',
    );
    return c.json({ success: true, data, total, limit, offset });
  } catch (err) {
    routesLogger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      '[API /admin/announcements] error:',
    );
    return c.json({ success: false, error: '获取公告列表失败' }, 500);
  }
});

app.post(
  '/admin/announcements',
  // Bug #135: 公告发布无 rateLimit；脚本/admin 失误可能批量刷屏。加 10/min + 200/day。
  rateLimit(10, 60_000),
  rateLimit(200, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  zValidator('json', announcementCreateSchema),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const body = c.req.valid('json');
    routesLogger.info({ userId: user.id, title: body.title }, '[API /admin/announcements POST]');

    try {
      const now = new Date().toISOString();
      const id = randomUUID();
      await db.insert(announcements).values({
        id,
        title: body.title,
        content: body.content,
        targetRole: body.targetRole ?? 'all',
        isActive: body.isActive ?? true,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      });
      routesLogger.info(
        { duration: Date.now() - startedAt, id: id },
        '[API /admin/announcements POST] exit',
      );
      return c.json({ success: true, data: { id } }, 201);
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/announcements POST] error:',
      );
      return c.json({ success: false, error: '发布公告失败' }, 500);
    }
  },
);

app.put(
  '/admin/announcements/:id',
  // Bug #163: 编辑公告与 POST 保持同样的限流节奏。
  rateLimit(10, 60_000),
  rateLimit(200, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  zValidator('json', announcementUpdateSchema),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const id = c.req.param('id');
    const body = c.req.valid('json');
    routesLogger.info({ userId: user.id, id: id }, '[API /admin/announcements/:id PUT]');

    try {
      const existing = await db.query.announcements.findFirst({
        where: eq(announcements.id, id),
      });
      if (!existing) {
        return c.json({ success: false, error: '公告不存在' }, 404);
      }
      // Bug #118: 之前没有归属校验，任何 super_admin 都能改别人的公告；
      // 改为只有创建者本人才可编辑/删除（super_admin 全部可读不限制）。
      // 说明：业务上如需多 admin 共创公告，可以切到 `createdBy` 角色组判断。
      // 但默认按 by-id 归属更安全；如运营需要，单独开一个 /admin/announcements/:id/transfer。
      if (existing.createdBy !== user.id) {
        return c.json({ success: false, error: '仅创建者可编辑该公告' }, 403);
      }
      const now = new Date().toISOString();
      await db
        .update(announcements)
        .set({
          ...(body.title !== undefined && { title: body.title }),
          ...(body.content !== undefined && { content: body.content }),
          ...(body.targetRole !== undefined && { targetRole: body.targetRole }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
          updatedAt: now,
        })
        .where(eq(announcements.id, id));
      routesLogger.info(
        { duration: Date.now() - startedAt },
        '[API /admin/announcements/:id PUT] exit',
      );
      return c.json({ success: true });
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/announcements/:id PUT] error:',
      );
      return c.json({ success: false, error: '更新公告失败' }, 500);
    }
  },
);

app.delete(
  '/admin/announcements/:id',
  // Bug #163: 删公告必须限流，否则脚本可秒删全部历史公告。
  rateLimit(10, 60_000),
  rateLimit(200, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const id = c.req.param('id');
    routesLogger.info({ userId: user.id, id: id }, '[API /admin/announcements/:id DELETE]');

    try {
      // Bug #118: 删除同样要求 createdBy 归属，避免误删他人公告。
      const existing = await db.query.announcements.findFirst({
        where: eq(announcements.id, id),
        columns: { id: true, createdBy: true },
      });
      if (!existing) {
        return c.json({ success: false, error: '公告不存在' }, 404);
      }
      if (existing.createdBy !== user.id) {
        return c.json({ success: false, error: '仅创建者可删除该公告' }, 403);
      }
      await db.delete(announcements).where(eq(announcements.id, id));
      routesLogger.info(
        { duration: Date.now() - startedAt },
        '[API /admin/announcements/:id DELETE] exit',
      );
      return c.json({ success: true });
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/announcements/:id DELETE] error:',
      );
      return c.json({ success: false, error: '删除公告失败' }, 500);
    }
  },
);

// ========== Admin: Question Bank ==========
const questionCreateSchema = z
  .object({
    topicType: z.string().min(1, '题目类型不能为空'),
    topicCategory: z.string().optional(),
    title: z.string().min(1, '标题不能为空'),
    requirements: z.string().min(1, '要求不能为空'),
    keyPoints: z.array(z.string()).optional(),
    referenceEssay: z.string().optional(),
    wordLimitMin: z.number().int().min(20).max(500).optional(),
    wordLimitMax: z.number().int().min(20).max(500).optional(),
    timeLimitMinutes: z.number().optional(),
    difficulty: z.string().optional(),
    source: z.string().optional(),
  })
  .refine(
    (d) =>
      d.wordLimitMin === undefined ||
      d.wordLimitMax === undefined ||
      d.wordLimitMin <= d.wordLimitMax,
    {
      // Bug #51: 同样规则，min > max 视为脏数据，create/update 都拒绝。
      path: ['wordLimitMax'],
      message: '字数上限不能小于下限',
    },
  );

const questionUpdateSchema = questionCreateSchema.partial();

app.get('/admin/question-bank', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  const user = c.get('user');
  const startedAt = Date.now();
  const topicType = c.req.query('topicType');
  const difficulty = c.req.query('difficulty');
  const offset = parseNonNegativeInt(c.req.query('offset'), 0);
  const limit = parsePositiveInt(c.req.query('limit'), 50, 200);
  routesLogger.info(
    { userId: user.id, topicType: topicType ?? 'all', difficulty: difficulty ?? 'all' },
    '[API /admin/question-bank]',
  );

  try {
    const conds = [];
    if (topicType) conds.push(eq(questionBank.topicType, topicType));
    if (difficulty) conds.push(eq(questionBank.difficulty, difficulty));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

    const rows = await db.query.questionBank.findMany({
      where,
      orderBy: desc(questionBank.createdAt),
      limit,
      offset,
    });
    const data: QuestionBankItem[] = rows.map((r) => ({
      id: r.id,
      topicType: r.topicType,
      topicCategory: r.topicCategory,
      title: r.title,
      requirements: r.requirements,
      keyPoints: safeJsonArray(r.keyPoints),
      referenceEssay: r.referenceEssay,
      wordLimitMin: r.wordLimitMin,
      wordLimitMax: r.wordLimitMax,
      timeLimitMinutes: r.timeLimitMinutes,
      difficulty: r.difficulty as QuestionBankItem['difficulty'],
      source: r.source,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
    routesLogger.info(
      { duration: Date.now() - startedAt, count: data.length },
      '[API /admin/question-bank] exit',
    );
    return c.json({ success: true, data });
  } catch (err) {
    routesLogger.error(
      { err: err instanceof Error ? err.message : 'unknown' },
      '[API /admin/question-bank] error:',
    );
    return c.json({ success: false, error: '获取题库失败' }, 500);
  }
});

app.post(
  '/admin/question-bank',
  // Bug #153: 题库录入无 rateLimit；批量脚本可能瞬间塞大量题目。
  rateLimit(20, 60_000),
  rateLimit(500, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  zValidator('json', questionCreateSchema),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const body = c.req.valid('json');
    routesLogger.info({ userId: user.id, title: body.title }, '[API /admin/question-bank POST]');

    try {
      const now = new Date().toISOString();
      const id = randomUUID();
      await db.insert(questionBank).values({
        id,
        topicType: body.topicType,
        topicCategory: body.topicCategory ?? null,
        title: body.title,
        requirements: body.requirements,
        keyPoints: JSON.stringify(body.keyPoints ?? []),
        referenceEssay: body.referenceEssay ?? null,
        wordLimitMin: body.wordLimitMin ?? 80,
        wordLimitMax: body.wordLimitMax ?? 125,
        timeLimitMinutes: body.timeLimitMinutes ?? 15,
        difficulty: body.difficulty ?? 'medium',
        source: body.source ?? null,
        isPublic: 1,
        createdAt: now,
        updatedAt: now,
      });
      routesLogger.info(
        { duration: Date.now() - startedAt, id: id },
        '[API /admin/question-bank POST] exit',
      );
      return c.json({ success: true, data: { id } }, 201);
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/question-bank POST] error:',
      );
      return c.json({ success: false, error: '创建题目失败' }, 500);
    }
  },
);

app.put(
  '/admin/question-bank/:id',
  // Bug #153 续: PUT 路径与 POST 保持同样的限流节奏。
  rateLimit(20, 60_000),
  rateLimit(500, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  zValidator('json', questionUpdateSchema),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const id = c.req.param('id');
    const body = c.req.valid('json');
    routesLogger.info({ userId: user.id, id: id }, '[API /admin/question-bank/:id PUT]');

    try {
      const existing = await db.query.questionBank.findFirst({ where: eq(questionBank.id, id) });
      if (!existing) {
        return c.json({ success: false, error: '题目不存在' }, 404);
      }
      const now = new Date().toISOString();
      await db
        .update(questionBank)
        .set({
          ...(body.topicType !== undefined && { topicType: body.topicType }),
          ...(body.topicCategory !== undefined && { topicCategory: body.topicCategory }),
          ...(body.title !== undefined && { title: body.title }),
          ...(body.requirements !== undefined && { requirements: body.requirements }),
          ...(body.keyPoints !== undefined && { keyPoints: JSON.stringify(body.keyPoints) }),
          ...(body.referenceEssay !== undefined && { referenceEssay: body.referenceEssay }),
          ...(body.wordLimitMin !== undefined && { wordLimitMin: body.wordLimitMin }),
          ...(body.wordLimitMax !== undefined && { wordLimitMax: body.wordLimitMax }),
          ...(body.timeLimitMinutes !== undefined && { timeLimitMinutes: body.timeLimitMinutes }),
          ...(body.difficulty !== undefined && { difficulty: body.difficulty }),
          ...(body.source !== undefined && { source: body.source }),
          updatedAt: now,
        })
        .where(eq(questionBank.id, id));
      routesLogger.info(
        { duration: Date.now() - startedAt },
        '[API /admin/question-bank/:id PUT] exit',
      );
      return c.json({ success: true });
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/question-bank/:id PUT] error:',
      );
      return c.json({ success: false, error: '更新题目失败' }, 500);
    }
  },
);

app.delete(
  '/admin/question-bank/:id',
  // Bug #153 续: 删题目也限流；并修复 #165 类似的"不存在也返 success"问题。
  rateLimit(20, 60_000),
  rateLimit(500, 24 * 60 * 60_000),
  authMiddleware,
  requireRole(UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    const startedAt = Date.now();
    const id = c.req.param('id');
    routesLogger.info({ userId: user.id, id: id }, '[API /admin/question-bank/:id DELETE]');

    try {
      const existing = await db.query.questionBank.findFirst({
        where: eq(questionBank.id, id),
        columns: { id: true },
      });
      if (!existing) {
        return c.json({ success: false, error: '题目不存在' }, 404);
      }
      await db.delete(questionBank).where(eq(questionBank.id, id));
      routesLogger.info(
        { duration: Date.now() - startedAt },
        '[API /admin/question-bank/:id DELETE] exit',
      );
      return c.json({ success: true });
    } catch (err) {
      routesLogger.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        '[API /admin/question-bank/:id DELETE] error:',
      );
      return c.json({ success: false, error: '删除题目失败' }, 500);
    }
  },
);

// ========== Admin: Scoring Config (read-only) ==========
app.get('/admin/scoring-config', authMiddleware, requireRole(UserRole.SUPER_ADMIN), async (c) => {
  const user = c.get('user');
  const startedAt = Date.now();
  routesLogger.info({ userId: user.id }, '[API /admin/scoring-config]');
  const data = {
    scoringWeights: SCORING_WEIGHTS,
    scoreTiers: SCORE_TIERS,
    deductionRules: DEDUCTION_RULES,
  };
  routesLogger.info({ duration: Date.now() - startedAt }, '[API /admin/scoring-config] exit');
  return c.json({ success: true, data });
});

export type AppType = typeof app;

export default app;
