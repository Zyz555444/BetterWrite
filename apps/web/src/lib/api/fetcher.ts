import type { ClassAnalytics, StudentAnalytics } from '@betterwrite/shared';
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
  ErrorBookItem,
  EssayDraft,
  PracticeExercise,
  QuestionBankItem,
  SchoolStats,
  SchoolWithStats,
  StudentProgress,
} from '@betterwrite/shared';
import type {
  ApiResponse,
  AuthUserResponse,
  CorrectionDetail,
  Essay,
  EssayTask,
  ImportResult,
  StudentDetail,
  StudentListItem,
  TeachingResourceWithCreator,
} from './fetcher-types';

export type {
  ApiResponse,
  AuthUserResponse,
  Correction,
  CorrectionDetail,
  Essay,
  EssayTask,
  ImportResult,
  StudentDetail,
  StudentListItem,
  TeachingResourceWithCreator,
} from './fetcher-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `请求失败 (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) errorMessage = body.error;
    } catch {
      // 响应体不是 JSON（如网关返回的 HTML 错误页）
    }
    throw new Error(errorMessage);
  }

  const data = (await res.json()) as T;
  return data;
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

  // Analytics
  getClassAnalytics: (classId: string) =>
    request<ApiResponse<ClassAnalytics>>(`/api/teacher/analytics/class/${classId}`),

  getStudentAnalytics: (studentId: string) =>
    request<ApiResponse<StudentAnalytics>>(`/api/teacher/analytics/student/${studentId}`),

  exportClassAnalytics: async (classId: string): Promise<void> => {
    console.log(`[Fetcher] exportClassAnalytics classId=${classId}`);
    const res = await fetch(`${API_BASE}/api/teacher/analytics/class/${classId}/export`, {
      credentials: 'include',
    });
    if (!res.ok) {
      console.warn(`[Fetcher] exportClassAnalytics failed status=${res.status}`);
      throw new Error('导出失败');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class-${classId}-essays.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`[Fetcher] exportClassAnalytics downloaded classId=${classId}`);
  },

  // Students
  listStudents: (params?: { classId?: string; keyword?: string }) => {
    const query = new URLSearchParams();
    if (params?.classId) query.set('classId', params.classId);
    if (params?.keyword) query.set('keyword', params.keyword);
    const qs = query.toString();
    return request<ApiResponse<StudentListItem[]>>(`/api/teacher/students${qs ? `?${qs}` : ''}`);
  },

  getStudentDetail: (id: string) =>
    request<ApiResponse<StudentDetail>>(`/api/teacher/students/${id}`),

  importStudents: (body: { classId: string; csv: string }) =>
    request<ApiResponse<ImportResult>>('/api/teacher/students/import', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateStudentTag: (id: string, tag: string) =>
    request<ApiResponse<{ studentId: string; tag: string }>>(`/api/teacher/students/${id}/tags`, {
      method: 'PATCH',
      body: JSON.stringify({ tag }),
    }),

  // Teaching Resources
  listResources: (params?: {
    type?: string;
    topicType?: string;
    difficulty?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.topicType) query.set('topicType', params.topicType);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<ApiResponse<TeachingResourceWithCreator[]>>(
      `/api/teacher/resources${qs ? `?${qs}` : ''}`,
    );
  },

  getResource: (id: string) =>
    request<ApiResponse<TeachingResourceWithCreator>>(`/api/teacher/resources/${id}`),

  createResource: (body: {
    type: string;
    title: string;
    topicType?: string;
    difficulty: string;
    content: string;
    highlights?: string;
    tags?: string[];
  }) =>
    request<ApiResponse<TeachingResourceWithCreator>>('/api/teacher/resources', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateResource: (
    id: string,
    body: {
      title?: string;
      topicType?: string;
      difficulty?: string;
      content?: string;
      highlights?: string;
      tags?: string[];
    },
  ) =>
    request<ApiResponse<TeachingResourceWithCreator>>(`/api/teacher/resources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteResource: (id: string) =>
    request<ApiResponse<null>>(`/api/teacher/resources/${id}`, { method: 'DELETE' }),

  getErrorBookGroups: () => request<ApiResponse<ErrorBookGroup[]>>('/api/student/errors'),
  syncErrorBook: () =>
    request<ApiResponse<{ synced: number }>>('/api/student/errors/sync', { method: 'POST' }),
  generateErrorPractice: (errorType: string) =>
    request<ApiResponse<{ exercises: string[] }>>('/api/student/errors/practice', {
      method: 'POST',
      body: JSON.stringify({ errorType }),
    }),
  getErrorBookByType: (type: string, params?: { offset?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<ApiResponse<ErrorBookItem[]>>(
      `/api/student/errors/${type}${qs ? `?${qs}` : ''}`,
    );
  },
  masterError: (id: string) =>
    request<ApiResponse<{ studentId: string; id: string; status: string }>>(
      `/api/student/errors/${id}/master`,
      { method: 'POST' },
    ),

  getStudentProgress: () => request<ApiResponse<StudentProgress>>('/api/student/progress'),
  getAchievements: () => request<ApiResponse<Achievement[]>>('/api/student/achievements'),

  aiPolish: (text: string) =>
    request<ApiResponse<AiAssistantResult>>('/api/student/ai/polish', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  aiUpgrade: (text: string) =>
    request<ApiResponse<AiAssistantResult>>('/api/student/ai/upgrade', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  aiSynonym: (word: string, context: string) =>
    request<ApiResponse<AiAssistantResult>>('/api/student/ai/synonym', {
      method: 'POST',
      body: JSON.stringify({ word, context }),
    }),
  aiGrammar: (text: string) =>
    request<ApiResponse<AiAssistantResult>>('/api/student/ai/grammar', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  getAiHistory: (params?: { offset?: number; limit?: number; mode?: string }) => {
    const query = new URLSearchParams();
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.mode) query.set('mode', params.mode);
    const qs = query.toString();
    return request<ApiResponse<AiConversation[]>>(`/api/student/ai/history${qs ? `?${qs}` : ''}`);
  },

  getQuestionBank: (params?: {
    topicType?: string;
    difficulty?: string;
    offset?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.topicType) query.set('topicType', params.topicType);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<ApiResponse<QuestionBankItem[]>>(
      `/api/student/question-bank${qs ? `?${qs}` : ''}`,
    );
  },
  getQuestion: (id: string) =>
    request<ApiResponse<QuestionBankItem>>(`/api/student/question-bank/${id}`),
  submitPractice: (body: {
    questionId?: string;
    content: string;
    durationMs?: number;
    exerciseType: string;
  }) =>
    request<
      ApiResponse<{
        exercise: PracticeExercise;
        feedback: {
          errors: Array<{
            original: string;
            corrected: string;
            type: string;
            explanation: string;
          }>;
        };
      }>
    >('/api/student/practice', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  submitPracticeDeep: (body: {
    questionId?: string;
    content: string;
    durationMs?: number;
    exerciseType: string;
  }) =>
    request<ApiResponse<{ essayId: string }>>('/api/student/practice/deep', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getPracticeHistory: (params?: { offset?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<ApiResponse<PracticeExercise[]>>(
      `/api/student/practice/history${qs ? `?${qs}` : ''}`,
    );
  },

  getStudentDashboard: () =>
    request<
      ApiResponse<{
        pendingTasks: number;
        correctedEssays: number;
        averageScore: number | null;
        quote: DailyQuote | null;
      }>
    >('/api/student/dashboard'),
  getDraft: (taskId: string) =>
    request<ApiResponse<EssayDraft | null>>(`/api/student/drafts/${taskId}`),
  saveDraft: (taskId: string, body: { content: string; wordCount: number; durationMs: number }) =>
    request<ApiResponse<EssayDraft>>(`/api/student/drafts/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteDraft: (taskId: string) =>
    request<ApiResponse<null>>(`/api/student/drafts/${taskId}`, { method: 'DELETE' }),

  // Admin: Dashboard
  getAdminDashboardStats: () =>
    request<ApiResponse<AdminDashboardStats>>('/api/admin/dashboard/stats'),

  // Admin: Schools
  listAdminSchools: (params?: { region?: string; offset?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.region) query.set('region', params.region);
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<ApiResponse<SchoolWithStats[]>>(`/api/admin/schools${qs ? `?${qs}` : ''}`);
  },
  createAdminSchool: (body: {
    code: string;
    name: string;
    region: string;
    contactName?: string;
    contactPhone?: string;
  }) =>
    request<ApiResponse<{ id: string }>>('/api/admin/schools', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAdminSchool: (
    id: string,
    body: {
      code?: string;
      name?: string;
      region?: string;
      contactName?: string;
      contactPhone?: string;
      isActive?: boolean;
    },
  ) =>
    request<ApiResponse<null>>(`/api/admin/schools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteAdminSchool: (id: string) =>
    request<ApiResponse<null>>(`/api/admin/schools/${id}`, { method: 'DELETE' }),
  getAdminSchoolStats: (id: string) =>
    request<ApiResponse<SchoolStats>>(`/api/admin/schools/${id}/stats`),

  // Admin: API Configs
  listAdminApiConfigs: () => request<ApiResponse<ApiConfigItem[]>>('/api/admin/api-configs'),
  createAdminApiConfig: (body: {
    provider: string;
    apiKey: string;
    baseUrl?: string;
    model?: string;
    isActive?: boolean;
    priority?: number;
    maxTokens?: number;
    temperature?: number;
    rateLimitPerMin?: number;
  }) =>
    request<ApiResponse<{ id: string }>>('/api/admin/api-configs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAdminApiConfig: (
    id: string,
    body: {
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      isActive?: boolean;
      priority?: number;
      maxTokens?: number;
      temperature?: number;
      rateLimitPerMin?: number;
    },
  ) =>
    request<ApiResponse<null>>(`/api/admin/api-configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteAdminApiConfig: (id: string) =>
    request<ApiResponse<null>>(`/api/admin/api-configs/${id}`, { method: 'DELETE' }),

  // Admin: API Logs
  listAdminApiLogs: (params?: {
    provider?: string;
    dateFrom?: string;
    dateTo?: string;
    offset?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.provider) query.set('provider', params.provider);
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<ApiResponse<ApiCallLogItem[]>>(`/api/admin/api-logs${qs ? `?${qs}` : ''}`);
  },

  // Admin: Announcements
  listAdminAnnouncements: () =>
    request<ApiResponse<AnnouncementItem[]>>('/api/admin/announcements'),
  createAdminAnnouncement: (body: {
    title: string;
    content: string;
    targetRole?: string;
    isActive?: boolean;
  }) =>
    request<ApiResponse<{ id: string }>>('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAdminAnnouncement: (
    id: string,
    body: {
      title?: string;
      content?: string;
      targetRole?: string;
      isActive?: boolean;
    },
  ) =>
    request<ApiResponse<null>>(`/api/admin/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteAdminAnnouncement: (id: string) =>
    request<ApiResponse<null>>(`/api/admin/announcements/${id}`, { method: 'DELETE' }),

  // Admin: Question Bank
  listAdminQuestionBank: (params?: {
    topicType?: string;
    difficulty?: string;
    offset?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.topicType) query.set('topicType', params.topicType);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<ApiResponse<QuestionBankItem[]>>(
      `/api/admin/question-bank${qs ? `?${qs}` : ''}`,
    );
  },
  createAdminQuestion: (body: {
    topicType: string;
    title: string;
    requirements: string;
    topicCategory?: string;
    keyPoints?: string[];
    referenceEssay?: string;
    wordLimitMin?: number;
    wordLimitMax?: number;
    timeLimitMinutes?: number;
    difficulty?: string;
    source?: string;
  }) =>
    request<ApiResponse<{ id: string }>>('/api/admin/question-bank', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAdminQuestion: (
    id: string,
    body: {
      topicType?: string;
      title?: string;
      requirements?: string;
      topicCategory?: string;
      keyPoints?: string[];
      referenceEssay?: string;
      wordLimitMin?: number;
      wordLimitMax?: number;
      timeLimitMinutes?: number;
      difficulty?: string;
      source?: string;
    },
  ) =>
    request<ApiResponse<null>>(`/api/admin/question-bank/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteAdminQuestion: (id: string) =>
    request<ApiResponse<null>>(`/api/admin/question-bank/${id}`, { method: 'DELETE' }),

  // Admin: Scoring Config (read-only)
  getAdminScoringConfig: () =>
    request<
      ApiResponse<{
        scoringWeights: {
          content: number;
          language: number;
          structure: number;
          presentation: number;
        };
        scoreTiers: Array<{ tier: string; label: string; min: number; max: number }>;
        deductionRules: Record<string, unknown>;
      }>
    >('/api/admin/scoring-config'),
};
