import type {
  AdminDashboardStats,
  ClassAnalytics,
  DailyQuote,
  SchoolWithStats,
  StudentProgress,
} from '@betterwrite/shared';
import { cookies } from 'next/headers';
import type { ApiResponse, Essay, EssayTask, StudentListItem } from './fetcher-types';

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function serverRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `请求失败 (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) errorMessage = body.error;
    } catch {
      // 响应体不是 JSON
    }
    throw new Error(errorMessage);
  }

  return (await res.json()) as T;
}

export interface TeacherDashboardData {
  stats: {
    totalClasses: number;
    totalStudents: number;
    pendingEssays: number;
    averageScore: number | null;
  };
  classes: Array<{ id: string; name: string; grade: string; studentCount: number }>;
  recentTasks: EssayTask[];
  recentEssays: Essay[];
}

export interface StudentDashboardData {
  pendingTasks: number;
  correctedEssays: number;
  averageScore: number | null;
  quote: DailyQuote | null;
}

export interface TeacherClass {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
}

export const serverFetcher = {
  // Admin
  getAdminDashboardStats: () =>
    serverRequest<ApiResponse<AdminDashboardStats>>('/api/admin/dashboard/stats'),

  listAdminSchools: (params?: { region?: string; offset?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.region) query.set('region', params.region);
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return serverRequest<ApiResponse<SchoolWithStats[]>>(`/api/admin/schools${qs ? `?${qs}` : ''}`);
  },

  // Teacher
  getTeacherDashboard: () =>
    serverRequest<ApiResponse<TeacherDashboardData>>('/api/teacher/dashboard'),

  listTeacherClasses: () => serverRequest<ApiResponse<TeacherClass[]>>('/api/teacher/classes'),

  listStudents: (params?: { classId?: string; keyword?: string }) => {
    const query = new URLSearchParams();
    if (params?.classId) query.set('classId', params.classId);
    if (params?.keyword) query.set('keyword', params.keyword);
    const qs = query.toString();
    return serverRequest<ApiResponse<StudentListItem[]>>(
      `/api/teacher/students${qs ? `?${qs}` : ''}`,
    );
  },

  getClassAnalytics: (classId: string) =>
    serverRequest<ApiResponse<ClassAnalytics>>(`/api/teacher/analytics/class/${classId}`),

  // Student
  getStudentDashboard: () =>
    serverRequest<ApiResponse<StudentDashboardData>>('/api/student/dashboard'),

  listTasks: () => serverRequest<ApiResponse<EssayTask[]>>('/api/tasks'),

  listMyEssays: () => serverRequest<ApiResponse<Essay[]>>('/api/essays/my'),

  getStudentProgress: () => serverRequest<ApiResponse<StudentProgress>>('/api/student/progress'),
};
