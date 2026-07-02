const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  const data = (await res.json()) as T;
  return data;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthUserResponse {
  userId: string;
  name: string;
  email: string;
  role: string;
  schoolId: string | null;
}

export interface Essay {
  id: string;
  taskId: string | null;
  studentId: string;
  title: string | null;
  content: string;
  wordCount: number;
  submitType: 'typed' | 'ocr';
  status: 'pending' | 'correcting' | 'completed' | 'failed';
  totalScore: number | null;
  scoreTier: string | null;
  correctionId: string | null;
  submittedAt: string;
  correctedAt: string | null;
  createdAt: string;
  updatedAt: string;
  task?: EssayTask | null;
  correction?: Correction | null;
  student?: { id: string; name: string; studentNo: string | null } | null;
}

export interface EssayTask {
  id: string;
  classId: string;
  createdBy: string;
  title: string;
  topicType: string;
  topicCategory: string | null;
  requirements: string;
  keyPoints: string;
  referenceEssay: string | null;
  wordLimitMin: number;
  wordLimitMax: number;
  timeLimitMinutes: number;
  status: 'draft' | 'published' | 'closed';
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Correction {
  id: string;
  essayId: string;
  contentScore: number | null;
  languageScore: number | null;
  structureScore: number | null;
  presentationScore: number | null;
  totalScore: number | null;
  scoreTier: string | null;
  errors: string;
  errorStats: string;
  highlights: string;
  sentenceAnalysis: string;
  revisedEssay: string | null;
  suggestions: string;
  aiProvider: string | null;
  aiModel: string | null;
  correctionTimeMs: number | null;
  createdAt: string;
}

export interface CorrectionDetail {
  id: string;
  essayId: string;
  contentScore: number;
  languageScore: number;
  structureScore: number;
  presentationScore: number;
  totalScore: number;
  scoreTier: string;
  errors: Array<{
    type: string;
    original: string;
    corrected: string;
    explanation: string;
    position: { start: number; end: number };
  }>;
  errorStats: Record<string, number>;
  highlights: Array<{ sentence: string; type: string; comment: string }>;
  sentenceAnalysis: unknown[];
  revisedEssay: string;
  suggestions: Array<{ priority: 'high' | 'medium' | 'low'; category: string; suggestion: string }>;
  aiProvider: string;
  aiModel: string;
  correctionTimeMs: number;
  createdAt: string;
}

export const fetcher = {
  login: (email: string, password: string) =>
    request<ApiResponse<AuthUserResponse>>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (body: {
    email: string;
    password: string;
    name: string;
    role: string;
    schoolCode?: string;
    classCode?: string;
  }) =>
    request<ApiResponse<AuthUserResponse>>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () => request<ApiResponse<null>>('/api/auth/logout', { method: 'POST' }),
  me: () =>
    request<
      ApiResponse<{
        id: string;
        name: string;
        email: string;
        role: string;
        schoolId: string | null;
      }>
    >('/api/auth/me'),

  // Essays
  submitEssay: (body: { content: string; taskId?: string; title?: string }) =>
    request<ApiResponse<Essay>>('/api/essays', { method: 'POST', body: JSON.stringify(body) }),
  listMyEssays: () => request<ApiResponse<Essay[]>>('/api/essays/my'),
  getEssay: (id: string) => request<ApiResponse<Essay>>(`/api/essays/${id}`),
  getCorrection: (id: string) =>
    request<ApiResponse<CorrectionDetail>>(`/api/essays/${id}/correction`),

  // Tasks
  listTasks: () => request<ApiResponse<EssayTask[]>>('/api/tasks'),
  getTask: (id: string) => request<ApiResponse<EssayTask>>(`/api/tasks/${id}`),

  // Teacher dashboard
  getTeacherDashboard: () =>
    request<
      ApiResponse<{
        stats: {
          totalClasses: number;
          totalStudents: number;
          pendingEssays: number;
          averageScore: number | null;
        };
        classes: Array<{ id: string; name: string; grade: string; studentCount: number }>;
        recentTasks: EssayTask[];
        recentEssays: Essay[];
      }>
    >('/api/teacher/dashboard'),

  listTeacherClasses: () =>
    request<ApiResponse<Array<{ id: string; name: string; grade: string; studentCount: number }>>>(
      '/api/teacher/classes',
    ),

  listTeacherEssays: () => request<ApiResponse<Essay[]>>('/api/essays'),

  createTask: (body: {
    title: string;
    topicType: string;
    requirements: string;
    keyPoints: string[];
    classId: string;
    wordLimitMin: number;
    wordLimitMax: number;
    dueDate?: string;
  }) =>
    request<ApiResponse<EssayTask>>('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
};
