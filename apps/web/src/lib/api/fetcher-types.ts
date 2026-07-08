import type { TeachingResource } from '@betterwrite/shared';

export interface ApiResponse<T> {
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

export interface AiGeneratedTask {
  title: string;
  topicType: string;
  topicCategory: string;
  requirements: string;
  keyPoints: string[];
  referenceEssay: string;
  wordLimitMin?: number;
  wordLimitMax?: number;
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
  teacherReview: string | null;
  teacherScore: number | null;
  submittedAt: string;
  correctedAt: string | null;
  createdAt: string;
  updatedAt: string;
  task?: EssayTask | null;
  correction?: Correction | null;
  student?: { id: string; name: string; studentNo: string | null } | null;
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
