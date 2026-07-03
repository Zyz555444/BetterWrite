import { randomUUID } from 'node:crypto';
import { lucia } from '@/lib/auth';
import {
  classEnrollments,
  classes,
  db,
  essayTasks,
  essays,
  schools,
  studentTags,
  teachingResources,
  users,
} from '@betterwrite/db';
import {
  StudentTag,
  TeachingResourceType,
  UserRole,
  calculateErrorStats,
  calculateScoreDistribution,
  countWords,
} from '@betterwrite/shared';
import { processCorrection } from '@betterwrite/worker';
import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { authMiddleware, requireRole } from './middleware';
import type { AuthVariables } from './middleware';

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

app.post('/auth/login', zValidator('json', loginSchema), async (c) => {
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

app.post('/auth/register', zValidator('json', registerSchema), async (c) => {
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
    console.log(`[API POST /tasks] user=${user.id} payload=`, JSON.stringify(data));
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

    const header = '学生姓名,学号,作文标题,体裁,词数,状态,总分,提交时间\n';
    const rows = allEssays
      .map(
        (e) =>
          `${e.student?.name ?? ''},${e.student?.studentNo ?? ''},${e.title ?? e.task?.title ?? ''},${e.task?.topicType ?? ''},${e.wordCount},${e.status},${e.totalScore ?? ''},${e.submittedAt}`,
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
        const passwordHash = await bcrypt.hash('123456', 10);
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

    await db.delete(teachingResources).where(eq(teachingResources.id, id));
    const duration = Date.now() - start;
    console.log(
      `[API DELETE /teacher/resources/:id] user=${user.id} id=${id} duration=${duration}ms`,
    );
    return c.json({ success: true });
  },
);

export type AppType = typeof app;

export default app;
