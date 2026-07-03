import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  apiTokens,
  classEnrollments,
  classes,
  db,
  essayTasks,
  essays,
  schools,
  users,
} from '@betterwrite/db';
import { UserRole } from '@betterwrite/shared';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';

const MIGRATIONS_DIR = join(process.cwd(), 'packages', 'db', 'migrations');

const TABLES_TO_CLEAN = [
  'ai_conversations',
  'achievements',
  'practice_exercises',
  'error_books',
  'essay_drafts',
  'corrections',
  'essays',
  'essay_tasks',
  'class_enrollments',
  'classes',
  'api_tokens',
  'device_tokens',
  'api_configs',
  'api_call_logs',
  'announcements',
  'question_bank',
  'teaching_resources',
  'student_tags',
  'sessions',
  'users',
  'schools',
];

let migrationsApplied = false;

export async function applyMigrations(): Promise<void> {
  if (migrationsApplied) return;
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const content = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const statements = content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await db.run(sql.raw(stmt));
    }
  }
  migrationsApplied = true;
}

export async function cleanAllTables(): Promise<void> {
  for (const table of TABLES_TO_CLEAN) {
    await db.run(sql.raw(`DELETE FROM "${table}"`));
  }
}

export interface SeedFixtures {
  schoolId: string;
  teacherId: string;
  teacherToken: string;
  studentId: string;
  studentToken: string;
  adminId: string;
  adminToken: string;
  classId: string;
  taskId: string;
  passwordPlain: string;
}

export async function seedFixtures(): Promise<SeedFixtures> {
  const now = new Date().toISOString();
  const passwordPlain = 'Test1234!';
  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  const schoolId = randomUUID();
  const teacherId = randomUUID();
  const studentId = randomUUID();
  const adminId = randomUUID();
  const classId = randomUUID();
  const taskId = randomUUID();

  await db.insert(schools).values({
    id: schoolId,
    code: 'TEST',
    name: '测试学校',
    region: '深圳',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(users).values([
    {
      id: adminId,
      email: 'admin@test.com',
      passwordHash,
      name: '超级管理员',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: teacherId,
      email: 'teacher@test.com',
      passwordHash,
      name: '测试教师',
      role: UserRole.TEACHER,
      schoolId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: studentId,
      email: 'student@test.com',
      passwordHash,
      name: '测试学生',
      role: UserRole.STUDENT,
      schoolId,
      studentNo: 'S001',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(classes).values({
    id: classId,
    schoolId,
    code: 'CLS1',
    name: '测试班级',
    grade: '初三',
    teacherId,
    academicYear: '2025-2026',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(classEnrollments).values({
    id: randomUUID(),
    classId,
    userId: studentId,
    role: 'student',
    createdAt: now,
  });

  await db.insert(essayTasks).values({
    id: taskId,
    classId,
    createdBy: teacherId,
    title: '测试作文任务',
    topicType: 'narrative',
    requirements: '请写一篇不少于80词的记叙文',
    wordLimitMin: 80,
    wordLimitMax: 125,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const teacherToken = randomUUID();
  const studentToken = randomUUID();
  const adminToken = randomUUID();

  await db.insert(apiTokens).values([
    {
      id: randomUUID(),
      userId: teacherId,
      token: teacherToken,
      platform: 'web',
      deviceName: 'test-teacher',
      expiresAt,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: studentId,
      token: studentToken,
      platform: 'web',
      deviceName: 'test-student',
      expiresAt,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: adminId,
      token: adminToken,
      platform: 'web',
      deviceName: 'test-admin',
      expiresAt,
      createdAt: now,
    },
  ]);

  return {
    schoolId,
    teacherId,
    teacherToken,
    studentId,
    studentToken,
    adminId,
    adminToken,
    classId,
    taskId,
    passwordPlain,
  };
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function seedEssayRow(
  studentId: string,
  taskId: string | null,
  status: 'completed' | 'pending' = 'completed',
  totalScore: number | null = 12,
): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.insert(essays).values({
    id,
    studentId,
    taskId,
    title: '测试作文',
    content: 'This is a test essay about my daily life.',
    wordCount: 10,
    submitType: 'typed',
    status,
    totalScore,
    scoreTier: totalScore !== null ? (totalScore >= 13 ? 'excellent' : 'good') : null,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
