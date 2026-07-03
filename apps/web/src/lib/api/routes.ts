import { randomUUID } from 'node:crypto';
import { lucia } from '@/lib/auth';
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
  AiAssistantResult,
  AiConversation,
  DailyQuote,
  ErrorBookGroup,
  EssayDraft,
  PracticeExercise,
  QuestionBankItem,
  StudentProgress,
} from '@betterwrite/shared';
import { performOcr, processCorrection } from '@betterwrite/worker';
import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getAiRouter } from '../ai/router';
import { authMiddleware, requireRole } from './middleware';
import type { AuthVariables } from './middleware';
import { rateLimit } from './rate-limiter';

const app = new Hono<{ Variables: AuthVariables }>().basePath('/api');

// ========== Error Handling ==========
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ success: false, error: err.message }, err.status);
  }
  console.error('API Error:', err);
  return c.json({ success: false, error: '服务器内部错误' }, 500);
});

app.notFound((c) => c.json({ success: false, error: '接口不存在' }, 404));

// ========== Health ==========
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ========== Auth ==========
const loginSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(1, '请输入密码'),
});

app.post('/auth/login', rateLimit(10, 60_000), zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.isActive) {
    return c.json({ success: false, error: '邮箱或密码错误' }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ success: false, error: '邮箱或密码错误' }, 401);
  }

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

const registerSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(6, '密码至少6位'),
  name: z.string().min(1, '请输入姓名'),
  role: z.enum([UserRole.TEACHER, UserRole.STUDENT]).default(UserRole.STUDENT),
  schoolCode: z.string().optional(),
  classCode: z.string().optional(),
});

app.post('/auth/register', rateLimit(5, 60_000), zValidator('json', registerSchema), async (c) => {
  const { email, password, name, role, schoolCode, classCode } = c.req.valid('json');

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return c.json({ success: false, error: '该邮箱已被注册' }, 409);
  }

  const now = new Date().toISOString();
  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  let schoolId: string | null = null;
  if (schoolCode) {
    const school = await db.query.schools.findFirst({ where: eq(schools.code, schoolCode) });
    if (school) schoolId = school.id;
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

app.post('/auth/logout', authMiddleware, async (c) => {
  const sessionId = c.req
    .header('cookie')
    ?.match(new RegExp(`${lucia.sessionCookieName}=([^;]+)`))?.[1];
  if (sessionId) {
    await lucia.invalidateSession(sessionId);
  }
  const sessionCookie = lucia.createBlankSessionCookie();
  return c.json({ success: true }, 200, {
    'Set-Cookie': sessionCookie.serialize(),
  });
});

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

app.post('/auth/token', rateLimit(10, 60_000), zValidator('json', tokenLoginSchema), async (c) => {
  const { email, password, platform, deviceName } = c.req.valid('json');
  console.log(`[API /auth/token] email=${email} platform=${platform}`);

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.isActive) {
    return c.json({ success: false, error: '邮箱或密码错误' }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ success: false, error: '邮箱或密码错误' }, 401);
  }

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

  console.log(`[API /auth/token] login success userId=${user.id}`);
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
});

app.get('/auth/tokens', authMiddleware, async (c) => {
  const user = c.get('user');
  console.log(`[API /auth/tokens] user=${user.id}`);
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

const deviceTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

app.post('/auth/device-token', authMiddleware, zValidator('json', deviceTokenSchema), async (c) => {
  const user = c.get('user');
  const { token, platform } = c.req.valid('json');
  console.log(`[API /auth/device-token] user=${user.id} platform=${platform}`);
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
const ocrSchema = z.object({
  imageBase64: z.string().min(1),
  taskId: z.string().optional(),
});

app.post(
  '/essays/ocr',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', ocrSchema),
  async (c) => {
    const user = c.get('user');
    const { imageBase64, taskId } = c.req.valid('json');
    console.log(`[API /essays/ocr] user=${user.id} taskId=${taskId ?? 'none'}`);

    try {
      const result = await performOcr(imageBase64);
      console.log(
        `[API /essays/ocr] user=${user.id} confidence=${result.confidence} contentLength=${result.content.length}`,
      );
      return c.json({ success: true, data: result });
    } catch (err) {
      console.error(
        `[API /essays/ocr] user=${user.id} error:`,
        err instanceof Error ? err.message : 'unknown',
      );
      return c.json({ success: false, error: 'OCR 识别失败' }, 500);
    }
  },
);

// ========== Notifications ==========
app.post('/notifications/test', authMiddleware, async (c) => {
  const user = c.get('user');
  console.log(`[API /notifications/test] user=${user.id}`);

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
    console.error(`[API /notifications/test] push failed status=${res.status}`);
    return c.json({ success: false, error: '推送发送失败' }, 500);
  }

  console.log(`[API /notifications/test] user=${user.id} sent=${messages.length}`);
  return c.json({ success: true, data: { sent: messages.length } });
});

// ========== Essays ==========
const essaySchema = z.object({
  content: z.string().min(1, '作文内容不能为空'),
  taskId: z.string().optional(),
  title: z.string().optional(),
});

app.post('/essays', authMiddleware, zValidator('json', essaySchema), async (c) => {
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

  processCorrection({ essayId }).catch((err) => console.error('Correction failed:', err));

  return c.json({ success: true, data: essay });
});

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
  console.log(`[API /essays/:id] user=${user.id} role=${user.role} essayId=${id}`);
  const essay = await db.query.essays.findFirst({
    where: eq(essays.id, id),
    with: { correction: true, student: true, task: true },
  });
  if (!essay) return c.json({ success: false, error: 'Not found' }, 404);

  const canAccess =
    essay.studentId === user.id ||
    user.role === UserRole.SUPER_ADMIN ||
    user.role === UserRole.SCHOOL_ADMIN ||
    (user.role === UserRole.TEACHER && essay.student?.schoolId === user.schoolId);

  if (!canAccess) {
    console.warn(`[API /essays/:id] access denied user=${user.id} essayId=${id}`);
    return c.json({ success: false, error: '无权查看' }, 403);
  }

  console.log(`[API /essays/:id] access granted user=${user.id} essayId=${id}`);
  return c.json({ success: true, data: essay });
});

app.get('/essays/:id/correction', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  console.log(`[API /essays/:id/correction] user=${user.id} role=${user.role} essayId=${id}`);
  const essay = await db.query.essays.findFirst({
    where: eq(essays.id, id),
    with: { correction: true, student: true },
  });
  if (!essay) {
    console.warn(`[API /essays/:id/correction] essay not found id=${id}`);
    return c.json({ success: false, error: 'Not found' }, 404);
  }

  const canAccess =
    essay.studentId === user.id ||
    user.role === UserRole.SUPER_ADMIN ||
    user.role === UserRole.SCHOOL_ADMIN ||
    (user.role === UserRole.TEACHER && essay.student?.schoolId === user.schoolId);

  if (!canAccess) {
    console.warn(`[API /essays/:id/correction] access denied user=${user.id} essayId=${id}`);
    return c.json({ success: false, error: '无权查看' }, 403);
  }

  if (!essay.correction) {
    console.log(`[API /essays/:id/correction] no correction yet essayId=${id}`);
    return c.json({ success: false, error: '批改结果尚未生成' }, 404);
  }

  console.log(`[API /essays/:id/correction] returning correction essayId=${id}`);
  return c.json({ success: true, data: essay.correction });
});

app.get(
  '/essays',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  async (c) => {
    const user = c.get('user');
    console.log(`[API /essays] user=${user.id} role=${user.role}`);
    let conditions = undefined;

    if (user.role === UserRole.TEACHER && user.schoolId) {
      const classIds = await db.query.classes.findMany({
        where: eq(classes.teacherId, user.id),
        columns: { id: true },
      });
      const ids = classIds.map((c) => c.id);
      if (ids.length > 0) {
        const enrollments = await db.query.classEnrollments.findMany({
          where: inArray(classEnrollments.classId, ids),
          columns: { userId: true },
        });
        const studentIds = enrollments.map((e) => e.userId);
        conditions =
          studentIds.length > 0 ? studentIds.map((id) => eq(essays.studentId, id)) : undefined;
      }
    }

    const all = await db.query.essays.findMany({
      where: conditions ? and(...conditions) : undefined,
      orderBy: desc(essays.createdAt),
      limit: 100,
      with: { student: { columns: { id: true, name: true, studentNo: true } }, correction: true },
    });
    console.log(`[API /essays] user=${user.id} returning ${all.length} essays`);
    return c.json({ success: true, data: all });
  },
);

// ========== Tasks ==========
app.get('/tasks', authMiddleware, async (c) => {
  const user = c.get('user');
  console.log(`[API /tasks] user=${user.id} role=${user.role}`);
  let list: (typeof essayTasks.$inferSelect)[];

  if (user.role === UserRole.STUDENT) {
    const enrollments = await db.query.classEnrollments.findMany({
      where: eq(classEnrollments.userId, user.id),
      columns: { classId: true },
    });
    const classIds = enrollments.map((e) => e.classId);
    list = await db.query.essayTasks.findMany({
      where: classIds.length > 0 ? inArray(essayTasks.classId, classIds) : undefined,
      orderBy: desc(essayTasks.createdAt),
      limit: 50,
    });
  } else {
    list = await db.query.essayTasks.findMany({
      orderBy: desc(essayTasks.createdAt),
      limit: 50,
    });
  }

  console.log(`[API /tasks] user=${user.id} returning ${list.length} tasks`);
  return c.json({ success: true, data: list });
});

app.get('/tasks/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const task = await db.query.essayTasks.findFirst({ where: eq(essayTasks.id, id) });
  if (!task) return c.json({ success: false, error: 'Not found' }, 404);
  return c.json({ success: true, data: task });
});

const taskSchema = z.object({
  title: z.string().min(1, '请输入标题'),
  topicType: z.string().min(1, '请选择体裁'),
  requirements: z.string().min(1, '请输入要求'),
  keyPoints: z.array(z.string()).default([]),
  classId: z.string().min(1, '请选择班级'),
  wordLimitMin: z.number().default(80),
  wordLimitMax: z.number().default(125),
  dueDate: z.string().optional(),
});

app.post(
  '/tasks',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  zValidator('json', taskSchema),
  async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');
    console.log(`[API POST /tasks] user=${user.id} title=${data.title} classId=${data.classId}`);
    const now = new Date().toISOString();
    const id = randomUUID();

    const [task] = await db
      .insert(essayTasks)
      .values({
        id,
        ...data,
        keyPoints: JSON.stringify(data.keyPoints),
        createdBy: user.id,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    console.log(`[API POST /tasks] task created id=${task.id} title=${task.title}`);
    return c.json({ success: true, data: task });
  },
);

// ========== Teacher Classes ==========
app.get('/teacher/classes', authMiddleware, requireRole(UserRole.TEACHER), async (c) => {
  const user = c.get('user');
  console.log(`[API /teacher/classes] user=${user.id}`);

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

  console.log(`[API /teacher/classes] user=${user.id} returning ${classStats.length} classes`);
  return c.json({ success: true, data: classStats });
});

// ========== Teacher Dashboard ==========
app.get('/teacher/dashboard', authMiddleware, requireRole(UserRole.TEACHER), async (c) => {
  const user = c.get('user');
  console.log(`[API /teacher/dashboard] user=${user.id}`);

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
    db.query.essays.findMany({
      where: studentIds.length > 0 ? inArray(essays.studentId, studentIds) : undefined,
      orderBy: desc(essays.createdAt),
      limit: 10,
      with: {
        student: { columns: { id: true, name: true, studentNo: true } },
        task: true,
        correction: true,
      },
    }),
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

  console.log(
    `[API /teacher/dashboard] user=${user.id} classes=${myClasses.length} students=${studentIds.length} pending=${pendingEssays}`,
  );

  return c.json({
    success: true,
    data: {
      stats: {
        totalClasses: myClasses.length,
        totalStudents: studentIds.length,
        pendingEssays,
        averageScore,
      },
      classes: classStats,
      recentTasks,
      recentEssays,
    },
  });
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
    console.log(`[API /teacher/analytics/class] user=${user.id} classId=${classId}`);

    // 1. 校验班级存在
    const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!cls) return c.json({ success: false, error: '班级不存在' }, 404);

    // 2. 获取班级学生 IDs
    const enrollments = await db.query.classEnrollments.findMany({
      where: and(eq(classEnrollments.classId, classId), eq(classEnrollments.role, 'student')),
      columns: { userId: true },
    });
    const studentIds = enrollments.map((e) => e.userId);

    // 3. 获取班级所有已批改作文
    const allEssays = await db.query.essays.findMany({
      where: studentIds.length > 0 ? inArray(essays.studentId, studentIds) : undefined,
      with: { correction: true, task: true },
    });
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

    console.log(
      `[API /teacher/analytics/class] user=${user.id} classId=${classId} essays=${completedEssays.length} duration=${duration}ms`,
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
    console.log(`[API /teacher/analytics/student] user=${user.id} studentId=${studentId}`);

    const student = await db.query.users.findFirst({ where: eq(users.id, studentId) });
    if (!student) return c.json({ success: false, error: '学生不存在' }, 404);

    const studentEssays = await db.query.essays.findMany({
      where: eq(essays.studentId, studentId),
      orderBy: desc(essays.createdAt),
      limit: 20,
      with: { correction: true, task: true },
    });
    const completedEssays = studentEssays.filter((e) => e.status === 'completed' && e.correction);

    // 四维能力平均
    const abilities = { content: 0, language: 0, structure: 0, presentation: 0 };
    let abilityCount = 0;
    for (const e of completedEssays) {
      if (e.correction) {
        abilities.content += e.correction.contentScore ?? 0;
        abilities.language += e.correction.languageScore ?? 0;
        abilities.structure += e.correction.structureScore ?? 0;
        abilities.presentation += e.correction.presentationScore ?? 0;
        abilityCount++;
      }
    }
    if (abilityCount > 0) {
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

    console.log(
      `[API /teacher/analytics/student] user=${user.id} studentId=${studentId} essays=${completedEssays.length} duration=${duration}ms`,
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
    console.log(`[API /teacher/analytics/class/export] user=${user.id} classId=${classId}`);

    const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!cls) return c.json({ success: false, error: '班级不存在' }, 404);

    const enrollments = await db.query.classEnrollments.findMany({
      where: and(eq(classEnrollments.classId, classId), eq(classEnrollments.role, 'student')),
      columns: { userId: true },
    });
    const studentIds = enrollments.map((e) => e.userId);

    const allEssays = await db.query.essays.findMany({
      where: studentIds.length > 0 ? inArray(essays.studentId, studentIds) : undefined,
      with: {
        student: { columns: { id: true, name: true, studentNo: true } },
        task: true,
        correction: true,
      },
      orderBy: desc(essays.createdAt),
    });

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
    console.log(
      `[API /teacher/analytics/class/export] user=${user.id} classId=${classId} rows=${allEssays.length} duration=${duration}ms`,
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
    console.log(
      `[API /teacher/students] user=${user.id} classId=${classId ?? 'all'} keyword=${keyword ?? ''}`,
    );

    // 确定查询的班级范围
    let targetClassIds: string[] = [];
    if (classId) {
      targetClassIds = [classId];
    } else if (user.role === UserRole.TEACHER) {
      const myClasses = await db.query.classes.findMany({
        where: eq(classes.teacherId, user.id),
        columns: { id: true },
      });
      targetClassIds = myClasses.map((c) => c.id);
    }

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
        : await db.query.classEnrollments.findMany({
            where: eq(classEnrollments.role, 'student'),
            with: { class: { columns: { id: true, name: true, grade: true } } },
            limit: 200,
          });

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
    console.log(
      `[API /teacher/students] user=${user.id} returning=${result.length} duration=${duration}ms`,
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
    console.log(`[API /teacher/students/:id] user=${user.id} studentId=${studentId}`);

    const student = await db.query.users.findFirst({ where: eq(users.id, studentId) });
    if (!student) return c.json({ success: false, error: '学生不存在' }, 404);

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
    console.log(
      `[API /teacher/students/:id] user=${user.id} studentId=${studentId} essays=${recentEssays.length} duration=${duration}ms`,
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

const importSchema = z.object({
  classId: z.string().min(1, '请选择班级'),
  csv: z.string().min(1, 'CSV 内容不能为空'),
});

app.post(
  '/teacher/students/import',
  authMiddleware,
  requireRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN),
  zValidator('json', importSchema),
  async (c) => {
    const user = c.get('user');
    const { classId, csv } = c.req.valid('json');
    const start = Date.now();
    console.log(`[API /teacher/students/import] user=${user.id} classId=${classId}`);

    const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!cls) return c.json({ success: false, error: '班级不存在' }, 404);

    // 解析 CSV
    const lines = csv.trim().split(/\r?\n/);
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
      error?: string;
    }> = [];
    let successCount = 0;
    const now = new Date().toISOString();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',').map((s) => s.trim());
      if (parts.length < 2) {
        results.push({ line: i + 1, name: '', email: '', success: false, error: '字段不足' });
        continue;
      }
      const [name, email, studentNo] = parts;
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
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (existing) {
          results.push({
            line: i + 1,
            name,
            email,
            success: false,
            error: '邮箱已存在',
          });
          continue;
        }

        const userId = randomUUID();
        const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD ?? '123456';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
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
        await db.insert(classEnrollments).values({
          id: randomUUID(),
          classId,
          userId,
          role: 'student',
          createdAt: now,
        });
        results.push({ line: i + 1, name, email, success: true });
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
    console.log(
      `[API /teacher/students/import] user=${user.id} classId=${classId} success=${successCount}/${lines.length - 1} duration=${duration}ms`,
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
    console.log(
      `[API /teacher/students/:id/tags] user=${user.id} studentId=${studentId} tag=${tag}`,
    );

    const student = await db.query.users.findFirst({ where: eq(users.id, studentId) });
    if (!student) return c.json({ success: false, error: '学生不存在' }, 404);

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
    console.log(
      `[API /teacher/students/:id/tags] user=${user.id} studentId=${studentId} tag=${tag} duration=${duration}ms`,
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
    const limit = Number(c.req.query('limit') ?? '50');
    const start = Date.now();
    console.log(
      `[API /teacher/resources] user=${user.id} type=${type ?? 'all'} topicType=${topicType ?? 'all'} difficulty=${difficulty ?? 'all'}`,
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
    console.log(
      `[API /teacher/resources] user=${user.id} returning=${list.length} duration=${duration}ms`,
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
    console.log(
      `[API POST /teacher/resources] user=${user.id} type=${data.type} title=${data.title}`,
    );

    // 去重校验
    const existing = await db.query.teachingResources.findFirst({
      where: and(eq(teachingResources.type, data.type), eq(teachingResources.title, data.title)),
    });
    if (existing) {
      console.warn(
        `[API POST /teacher/resources] duplicate title user=${user.id} type=${data.type} title=${data.title}`,
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
    console.log(`[API POST /teacher/resources] created id=${resource.id} duration=${duration}ms`);
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
    console.log(`[API /teacher/resources/:id] user=${user.id} id=${id}`);

    const resource = await db.query.teachingResources.findFirst({
      where: eq(teachingResources.id, id),
      with: { creator: { columns: { id: true, name: true } } },
    });
    if (!resource) return c.json({ success: false, error: '资源不存在' }, 404);

    const duration = Date.now() - start;
    console.log(`[API /teacher/resources/:id] user=${user.id} id=${id} duration=${duration}ms`);
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
    console.log(`[API PATCH /teacher/resources/:id] user=${user.id} id=${id}`);

    const existing = await db.query.teachingResources.findFirst({
      where: eq(teachingResources.id, id),
    });
    if (!existing) return c.json({ success: false, error: '资源不存在' }, 404);

    if (user.role === UserRole.TEACHER && existing.createdBy !== user.id) {
      return c.json({ success: false, error: '无权修改他人的资源' }, 403);
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
    console.log(
      `[API PATCH /teacher/resources/:id] user=${user.id} id=${id} duration=${duration}ms`,
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
    console.log(`[API DELETE /teacher/resources/:id] user=${user.id} id=${id}`);

    const existing = await db.query.teachingResources.findFirst({
      where: eq(teachingResources.id, id),
    });
    if (!existing) return c.json({ success: false, error: '资源不存在' }, 404);

    if (user.role === UserRole.TEACHER && existing.createdBy !== user.id) {
      return c.json({ success: false, error: '无权删除他人的资源' }, 403);
    }

    await db.delete(teachingResources).where(eq(teachingResources.id, id));
    const duration = Date.now() - start;
    console.log(
      `[API DELETE /teacher/resources/:id] user=${user.id} id=${id} duration=${duration}ms`,
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
  const seen = new Set<string>();
  for (const e of existing) {
    if (e.correctionId) seen.add(`${e.correctionId}::${e.original}`);
  }
  const now = new Date().toISOString();
  let synced = 0;
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
      const key = `${correction.id}::${err.original}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await db.insert(errorBooks).values({
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
      synced++;
    }
  }
  return synced;
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
app.get('/student/errors', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const start = Date.now();
  console.log(`[API /student/errors] user=${user.id}`);
  await syncStudentErrorBook(user.id);
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
  console.log(
    `[API /student/errors] user=${user.id} groups=${groups.length} duration=${duration}ms`,
  );
  return c.json({ success: true, data: groups });
});

app.post('/student/errors/sync', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const start = Date.now();
  console.log(`[API /student/errors/sync] user=${user.id}`);
  const synced = await syncStudentErrorBook(user.id);
  const duration = Date.now() - start;
  console.log(`[API /student/errors/sync] user=${user.id} synced=${synced} duration=${duration}ms`);
  return c.json({ success: true, data: { synced } });
});

const errorPracticeBodySchema = z.object({ errorType: z.string().min(1) });

app.post(
  '/student/errors/practice',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', errorPracticeBodySchema),
  async (c) => {
    const user = c.get('user');
    const { errorType } = c.req.valid('json');
    const start = Date.now();
    console.log(`[API /student/errors/practice] user=${user.id} errorType=${errorType}`);
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
      console.log(
        `[API /student/errors/practice] user=${user.id} generated=${exercises.length} duration=${duration}ms`,
      );
      return c.json({ success: true, data: { exercises } });
    } catch (err) {
      console.warn(
        `[API /student/errors/practice] user=${user.id} error=${err instanceof Error ? err.message : 'unknown'}`,
      );
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'AI 调用失败' },
        500,
      );
    }
  },
);

app.get('/student/errors/:type', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const type = c.req.param('type');
  const offset = Number(c.req.query('offset') ?? '0');
  const limit = Number(c.req.query('limit') ?? '20');
  console.log(
    `[API /student/errors/:type] user=${user.id} type=${type} offset=${offset} limit=${limit}`,
  );
  const list = await db.query.errorBooks.findMany({
    where: and(eq(errorBooks.studentId, user.id), eq(errorBooks.errorType, type)),
    orderBy: desc(errorBooks.createdAt),
    offset,
    limit,
  });
  return c.json({ success: true, data: list });
});

app.post('/student/errors/:id/master', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const now = new Date().toISOString();
  console.log(`[API /student/errors/:id/master] user=${user.id} id=${id}`);
  const existing = await db.query.errorBooks.findFirst({
    where: and(eq(errorBooks.id, id), eq(errorBooks.studentId, user.id)),
  });
  if (!existing) return c.json({ success: false, error: '错题不存在' }, 404);
  await db
    .update(errorBooks)
    .set({ status: 'mastered', masteredAt: now, updatedAt: now })
    .where(eq(errorBooks.id, id));
  return c.json({ success: true, data: { studentId: user.id, id, status: 'mastered' } });
});

// ========== Student AI Assistant ==========
const aiPolishBodySchema = z.object({ text: z.string().min(1) });

app.post(
  '/student/ai/polish',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', aiPolishBodySchema),
  async (c) => {
    const user = c.get('user');
    const { text } = c.req.valid('json');
    const start = Date.now();
    console.log(`[API /student/ai/polish] user=${user.id}`);
    const router = getAiRouter();
    if (router.availableNames().length === 0) {
      return c.json({ success: false, error: 'AI 服务未配置' }, 503);
    }
    let result: Awaited<ReturnType<typeof polishEssay>>;
    try {
      result = await polishEssay(router, text);
    } catch (err) {
      console.warn(
        `[API /student/ai/polish] user=${user.id} error=${err instanceof Error ? err.message : 'unknown'}`,
      );
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'AI 调用失败' },
        500,
      );
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
    console.log(`[API /student/ai/polish] user=${user.id} duration=${duration}ms`);
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

const aiUpgradeBodySchema = z.object({ text: z.string().min(1) });

app.post(
  '/student/ai/upgrade',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', aiUpgradeBodySchema),
  async (c) => {
    const user = c.get('user');
    const { text } = c.req.valid('json');
    const start = Date.now();
    console.log(`[API /student/ai/upgrade] user=${user.id}`);
    const router = getAiRouter();
    if (router.availableNames().length === 0) {
      return c.json({ success: false, error: 'AI 服务未配置' }, 503);
    }
    let result: Awaited<ReturnType<typeof upgradeSentences>>;
    try {
      result = await upgradeSentences(router, text);
    } catch (err) {
      console.warn(
        `[API /student/ai/upgrade] user=${user.id} error=${err instanceof Error ? err.message : 'unknown'}`,
      );
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'AI 调用失败' },
        500,
      );
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
    console.log(`[API /student/ai/upgrade] user=${user.id} duration=${duration}ms`);
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
  word: z.string().min(1),
  context: z.string().default(''),
});

app.post(
  '/student/ai/synonym',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', aiSynonymBodySchema),
  async (c) => {
    const user = c.get('user');
    const { word, context } = c.req.valid('json');
    const start = Date.now();
    console.log(`[API /student/ai/synonym] user=${user.id} word=${word}`);
    const router = getAiRouter();
    if (router.availableNames().length === 0) {
      return c.json({ success: false, error: 'AI 服务未配置' }, 503);
    }
    let result: Awaited<ReturnType<typeof getSynonyms>>;
    try {
      result = await getSynonyms(router, word, context);
    } catch (err) {
      console.warn(
        `[API /student/ai/synonym] user=${user.id} error=${err instanceof Error ? err.message : 'unknown'}`,
      );
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'AI 调用失败' },
        500,
      );
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
    console.log(`[API /student/ai/synonym] user=${user.id} duration=${duration}ms`);
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

const aiGrammarBodySchema = z.object({ text: z.string().min(1) });

app.post(
  '/student/ai/grammar',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', aiGrammarBodySchema),
  async (c) => {
    const user = c.get('user');
    const { text } = c.req.valid('json');
    const start = Date.now();
    console.log(`[API /student/ai/grammar] user=${user.id}`);
    const router = getAiRouter();
    if (router.availableNames().length === 0) {
      return c.json({ success: false, error: 'AI 服务未配置' }, 503);
    }
    let result: Awaited<ReturnType<typeof checkGrammar>>;
    try {
      result = await checkGrammar(router, text);
    } catch (err) {
      console.warn(
        `[API /student/ai/grammar] user=${user.id} error=${err instanceof Error ? err.message : 'unknown'}`,
      );
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'AI 调用失败' },
        500,
      );
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
    console.log(`[API /student/ai/grammar] user=${user.id} duration=${duration}ms`);
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
  const offset = Number(c.req.query('offset') ?? '0');
  const limit = Number(c.req.query('limit') ?? '20');
  const mode = c.req.query('mode');
  console.log(
    `[API /student/ai/history] user=${user.id} offset=${offset} limit=${limit} mode=${mode ?? 'all'}`,
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
  const offset = Number(c.req.query('offset') ?? '0');
  const limit = Number(c.req.query('limit') ?? '20');
  console.log(
    `[API /student/question-bank] user=${user.id} topicType=${topicType ?? 'all'} difficulty=${difficulty ?? 'all'}`,
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
  console.log(`[API /student/question-bank/:id] user=${user.id} id=${id}`);
  const r = await db.query.questionBank.findFirst({ where: eq(questionBank.id, id) });
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
  content: z.string().min(1),
  durationMs: z.number().optional(),
  exerciseType: z.string().default(ExerciseType.QUESTION_BANK),
});

app.post(
  '/student/practice',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', practiceBodySchema),
  async (c) => {
    const user = c.get('user');
    const { questionId, content, durationMs, exerciseType } = c.req.valid('json');
    const start = Date.now();
    console.log(`[API /student/practice] user=${user.id} questionId=${questionId ?? 'none'}`);
    const wordCount = countWords(content);
    const now = new Date().toISOString();
    let question = null;
    if (questionId) {
      question = await db.query.questionBank.findFirst({
        where: eq(questionBank.id, questionId),
      });
    }
    const router = getAiRouter();
    let feedback: GrammarResult = { errors: [] };
    if (router.availableNames().length > 0) {
      try {
        feedback = await checkGrammar(router, content);
      } catch (err) {
        console.warn(
          `[API /student/practice] grammar check failed user=${user.id} error=${err instanceof Error ? err.message : 'unknown'}`,
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
    console.log(
      `[API /student/practice] user=${user.id} exerciseId=${exercise.id} duration=${duration}ms`,
    );
    return c.json({ success: true, data: { exercise, feedback } });
  },
);

app.post(
  '/student/practice/deep',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', practiceBodySchema),
  async (c) => {
    const user = c.get('user');
    const { content } = c.req.valid('json');
    const start = Date.now();
    console.log(`[API /student/practice/deep] user=${user.id}`);
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
    processCorrection({ essayId }).catch((err) => console.error('Correction failed:', err));
    const duration = Date.now() - start;
    console.log(
      `[API /student/practice/deep] user=${user.id} essayId=${essayId} duration=${duration}ms`,
    );
    return c.json({ success: true, data: { essayId } });
  },
);

app.get('/student/practice/history', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const offset = Number(c.req.query('offset') ?? '0');
  const limit = Number(c.req.query('limit') ?? '20');
  console.log(`[API /student/practice/history] user=${user.id} offset=${offset} limit=${limit}`);
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
  console.log(`[API /student/progress] user=${user.id}`);
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
  console.log(
    `[API /student/progress] user=${user.id} essays=${completedEssays.length} duration=${duration}ms`,
  );
  return c.json({ success: true, data });
});

app.get('/student/achievements', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const start = Date.now();
  console.log(`[API /student/achievements] user=${user.id}`);
  const earned = await db.query.achievements.findMany({
    where: eq(achievements.studentId, user.id),
  });
  const earnedMap = new Map(earned.map((a) => [a.code, a]));
  const earnedCodes = new Set(earned.map((a) => a.code));
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
  const unlockedNotRecorded = expectedCodes.filter((code) => !earnedCodes.has(code));
  if (unlockedNotRecorded.length > 0) {
    console.log(
      `[API /student/achievements] user=${user.id} unlocked-but-not-recorded=${unlockedNotRecorded.join(',')}`,
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
  console.log(
    `[API /student/achievements] user=${user.id} earned=${earned.length} duration=${duration}ms`,
  );
  return c.json({ success: true, data: list });
});

// ========== Student Dashboard & Drafts ==========
app.get('/student/dashboard', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const start = Date.now();
  console.log(`[API /student/dashboard] user=${user.id}`);
  const enrollments = await db.query.classEnrollments.findMany({
    where: and(eq(classEnrollments.userId, user.id), eq(classEnrollments.role, 'student')),
    columns: { classId: true },
  });
  const classIds = enrollments.map((e) => e.classId);
  const [pendingTasksRows, studentEssays, sentenceResources] = await Promise.all([
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
    db.query.teachingResources.findMany({
      where: eq(teachingResources.type, TeachingResourceType.SENTENCE),
      limit: 100,
    }),
  ]);
  const pendingTasks = pendingTasksRows.length;
  const completedEssays = studentEssays.filter((e) => e.status === 'completed');
  const correctedEssays = completedEssays.length;
  const allScores = completedEssays.map((e) => e.totalScore).filter((s): s is number => s !== null);
  const averageScore =
    allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  let quote: DailyQuote | null = null;
  if (sentenceResources.length > 0) {
    const pick = sentenceResources[Math.floor(Math.random() * sentenceResources.length)];
    quote = { id: pick.id, text: pick.content, translation: null, source: pick.title };
  }
  const duration = Date.now() - start;
  console.log(
    `[API /student/dashboard] user=${user.id} pending=${pendingTasks} corrected=${correctedEssays} duration=${duration}ms`,
  );
  return c.json({
    success: true,
    data: { pendingTasks, correctedEssays, averageScore, quote },
  });
});

app.get('/student/drafts/:taskId', authMiddleware, requireRole(UserRole.STUDENT), async (c) => {
  const user = c.get('user');
  const taskId = c.req.param('taskId');
  console.log(`[API /student/drafts/:taskId GET] user=${user.id} taskId=${taskId}`);
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
  content: z.string().min(1),
  wordCount: z.number().optional(),
  durationMs: z.number().optional(),
});

app.post(
  '/student/drafts/:taskId',
  authMiddleware,
  requireRole(UserRole.STUDENT),
  zValidator('json', draftBodySchema),
  async (c) => {
    const user = c.get('user');
    const taskId = c.req.param('taskId');
    const { content, wordCount, durationMs } = c.req.valid('json');
    const now = new Date().toISOString();
    console.log(`[API /student/drafts/:taskId POST] user=${user.id} taskId=${taskId}`);
    const existing = await db.query.essayDrafts.findFirst({
      where: and(eq(essayDrafts.studentId, user.id), eq(essayDrafts.taskId, taskId)),
    });
    let row: typeof essayDrafts.$inferSelect;
    if (existing) {
      [row] = await db
        .update(essayDrafts)
        .set({
          content,
          wordCount: wordCount ?? null,
          durationMs: durationMs ?? null,
          updatedAt: now,
        })
        .where(eq(essayDrafts.id, existing.id))
        .returning();
    } else {
      [row] = await db
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
        .returning();
    }
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
  console.log(`[API /student/drafts/:taskId DELETE] user=${user.id} taskId=${taskId}`);
  await db
    .delete(essayDrafts)
    .where(and(eq(essayDrafts.studentId, user.id), eq(essayDrafts.taskId, taskId)));
  return c.json({ success: true });
});

export type AppType = typeof app;

export default app;
