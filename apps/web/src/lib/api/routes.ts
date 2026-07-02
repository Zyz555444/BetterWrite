import { randomUUID } from 'node:crypto';
import { lucia } from '@/lib/auth';
import { classEnrollments, classes, db, essayTasks, essays, schools, users } from '@betterwrite/db';
import { UserRole, countWords } from '@betterwrite/shared';
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

export type AppType = typeof app;

export default app;
