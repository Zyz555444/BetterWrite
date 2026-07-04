import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  lucia: {
    sessionCookieName: 'auth_session',
    createSession: vi.fn().mockResolvedValue({ id: 'mock-session-id', userId: 'mock' }),
    createSessionCookie: vi.fn().mockReturnValue({
      name: 'auth_session',
      value: 'mock-session-id',
      attributes: { secure: false, sameSite: 'lax' },
      serialize: () => 'auth_session=mock-session-id; Path=/; SameSite=Lax',
    }),
    createBlankSessionCookie: vi.fn().mockReturnValue({
      name: 'auth_session',
      value: '',
      attributes: {},
      serialize: () => 'auth_session=; Path=/',
    }),
    validateSession: vi.fn().mockResolvedValue({ user: null, session: null }),
    invalidateSession: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

vi.mock('@betterwrite/worker', () => ({
  performOcr: vi.fn().mockResolvedValue({ content: 'mock ocr text', confidence: 0.95 }),
}));

vi.mock('@/lib/api/queue', () => ({
  addCorrectionJob: vi.fn().mockResolvedValue(undefined),
}));

import app from '@/lib/api/routes';
import { applyMigrations, authHeaders, cleanAllTables, seedEssayRow, seedFixtures } from './setup';

describe('API routes integration', () => {
  let fixtures: Awaited<ReturnType<typeof seedFixtures>>;

  beforeEach(async () => {
    await applyMigrations();
    await cleanAllTables();
    fixtures = await seedFixtures();
  });

  describe('GET /api/health', () => {
    it('returns ok status', async () => {
      const res = await app.request('/api/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with userId for correct password', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'student@test.com',
          password: fixtures.passwordPlain,
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.userId).toBe(fixtures.studentId);
      expect(body.data.role).toBe('student');
    });

    it('returns 401 for wrong password', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'student@test.com',
          password: 'wrongpassword',
        }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('creates a new student user', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newstudent@test.com',
          password: 'NewPass123!',
          name: '新学生',
          role: 'student',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.userId).toBeDefined();
    });

    it('rejects duplicate email', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'student@test.com',
          password: 'AnyPass123!',
          name: '重复学生',
          role: 'student',
        }),
      });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user with Bearer token', async () => {
      const res = await app.request('/api/auth/me', {
        headers: authHeaders(fixtures.studentToken),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(fixtures.studentId);
      expect(body.data.email).toBe('student@test.com');
    });

    it('returns 401 without token', async () => {
      const res = await app.request('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/dashboard/stats', () => {
    it('returns stats for super_admin', async () => {
      const res = await app.request('/api/admin/dashboard/stats', {
        headers: authHeaders(fixtures.adminToken),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalSchools).toBe(1);
      expect(body.data.totalTeachers).toBe(1);
      expect(body.data.totalStudents).toBe(1);
    });

    it('returns 403 for teacher token', async () => {
      const res = await app.request('/api/admin/dashboard/stats', {
        headers: authHeaders(fixtures.teacherToken),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/teacher/students', () => {
    it('returns student list for teacher', async () => {
      const res = await app.request('/api/teacher/students', {
        headers: authHeaders(fixtures.teacherToken),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].name).toBe('测试学生');
    });

    it('returns 403 for student token', async () => {
      const res = await app.request('/api/teacher/students', {
        headers: authHeaders(fixtures.studentToken),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/essays', () => {
    it('creates an essay for student with valid task', async () => {
      const res = await app.request('/api/essays', {
        method: 'POST',
        headers: {
          ...authHeaders(fixtures.studentToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'This is my test essay about daily life in Shenzhen.',
          taskId: fixtures.taskId,
          title: 'My Daily Life',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.status).toBe('pending');
      expect(body.data.studentId).toBe(fixtures.studentId);
    });

    it('returns 404 for non-existent task', async () => {
      const res = await app.request('/api/essays', {
        method: 'POST',
        headers: {
          ...authHeaders(fixtures.studentToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Some content here.',
          taskId: 'non-existent-task-id',
        }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/student/progress', () => {
    it('returns progress data for student', async () => {
      await seedEssayRow(fixtures.studentId, fixtures.taskId, 'completed', 12);
      await seedEssayRow(fixtures.studentId, fixtures.taskId, 'completed', 14);

      const res = await app.request('/api/student/progress', {
        headers: authHeaders(fixtures.studentToken),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.studentId).toBe(fixtures.studentId);
      expect(body.data.totalEssays).toBe(2);
      expect(body.data.averageScore).toBeGreaterThan(0);
      expect(body.data.level).toBeDefined();
    });

    it('allows teacher to access (higher role inherits student permissions)', async () => {
      const res = await app.request('/api/student/progress', {
        headers: authHeaders(fixtures.teacherToken),
      });
      expect(res.status).toBe(200);
    });
  });
});
