import type {
  Achievement,
  AiAssistantResult,
  AiConversation,
  ClassAnalytics,
  DailyQuote,
  ErrorBookGroup,
  ErrorBookItem,
  EssayDraft,
  PracticeExercise,
  QuestionBankItem,
  StudentAnalytics,
  StudentProgress,
  TeachingResource,
} from '@betterwrite/shared';
import type { ApiResponse } from './client';
import { request } from './client';

// ========== Types (mirrors web fetcher, kept in sync) ==========

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
  topicAdherenceScore: number | null;
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
  topicAdherenceScore: number;
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

export interface StudentListItem {
  id: string;
  name: string;
  email: string;
  studentNo: string | null;
  classId: string;
  className: string;
  grade: string;
  tag: string | null;
  essayCount: number;
  averageScore: number | null;
}

export interface StudentDetail {
  id: string;
  name: string;
  email: string;
  studentNo: string | null;
  classes: Array<{ id: string; name: string | null; grade: string | null }>;
  tag: string | null;
  averageScore: number | null;
  essayCount: number;
  recentEssays: Array<{
    id: string;
    title: string;
    status: string;
    totalScore: number | null;
    wordCount: number;
    submittedAt: string;
    topicType: string | null;
  }>;
}

export interface ImportResult {
  successCount: number;
  totalCount: number;
  results: Array<{
    line: number;
    name: string;
    email: string;
    success: boolean;
    error?: string;
  }>;
}

export interface TeachingResourceWithCreator extends TeachingResource {
  creator?: { id: string; name: string } | null;
}

export interface OcrResult {
  content: string;
  confidence: number;
}

export interface ApiTokenItem {
  id: string;
  platform: string;
  deviceName: string | null;
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface TokenLoginResult {
  token: string;
  user: AuthUserResponse;
}

// ========== Fetcher ==========

export const fetcher = {
  // ----- Auth (mobile-specific) -----
  loginWithToken: (body: {
    email: string;
    password: string;
    platform: string;
    deviceName: string;
  }) =>
    request<ApiResponse<TokenLoginResult>>('/api/auth/token', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listTokens: () => request<ApiResponse<ApiTokenItem[]>>('/api/auth/tokens'),

  registerDeviceToken: (body: { token: string; platform: string }) =>
    request<ApiResponse<{ userId: string; token: string }>>('/api/auth/device-token', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ----- Auth (shared) -----
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

  // ----- Notifications (mobile-specific) -----
  sendTestNotification: () =>
    request<ApiResponse<{ sent: number }>>('/api/notifications/test', { method: 'POST' }),

  // ----- OCR (mobile-specific) -----
  submitOcr: (body: { imageBase64: string; taskId?: string }) =>
    request<ApiResponse<OcrResult>>('/api/essays/ocr', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ----- Essays -----
  submitEssay: (body: { content: string; taskId?: string; title?: string }) =>
    request<ApiResponse<Essay>>('/api/essays', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listMyEssays: () => request<ApiResponse<Essay[]>>('/api/essays/my'),
  getEssay: (id: string) => request<ApiResponse<Essay>>(`/api/essays/${id}`),
  getCorrection: (id: string) =>
    request<ApiResponse<CorrectionDetail>>(`/api/essays/${id}/correction`),

  // ----- Tasks -----
  listTasks: () => request<ApiResponse<EssayTask[]>>('/api/tasks'),
  getTask: (id: string) => request<ApiResponse<EssayTask>>(`/api/tasks/${id}`),
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
    request<ApiResponse<EssayTask>>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ----- Teacher dashboard -----
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

  // ----- Analytics -----
  getClassAnalytics: (classId: string) =>
    request<ApiResponse<ClassAnalytics>>(`/api/teacher/analytics/class/${classId}`),

  getStudentAnalytics: (studentId: string) =>
    request<ApiResponse<StudentAnalytics>>(`/api/teacher/analytics/student/${studentId}`),

  // ----- Students -----
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

  // ----- Teaching Resources -----
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

  // ----- Error book -----
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

  // ----- Student progress & achievements -----
  getStudentProgress: () => request<ApiResponse<StudentProgress>>('/api/student/progress'),
  getAchievements: () => request<ApiResponse<Achievement[]>>('/api/student/achievements'),

  // ----- AI assistant -----
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

  // ----- Question bank & practice -----
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

  // ----- Student dashboard -----
  getStudentDashboard: () =>
    request<
      ApiResponse<{
        pendingTasks: number;
        correctedEssays: number;
        averageScore: number | null;
        quote: DailyQuote | null;
      }>
    >('/api/student/dashboard'),

  // ----- Drafts (cloud sync) -----
  getDraft: (taskId: string) =>
    request<ApiResponse<EssayDraft | null>>(`/api/student/drafts/${taskId}`),
  saveDraft: (taskId: string, body: { content: string; wordCount: number; durationMs: number }) =>
    request<ApiResponse<EssayDraft>>(`/api/student/drafts/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteDraft: (taskId: string) =>
    request<ApiResponse<null>>(`/api/student/drafts/${taskId}`, { method: 'DELETE' }),
};
