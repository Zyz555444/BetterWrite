import type {
  ErrorTypeValue,
  StudentTagValue,
  TeachingResourceDifficultyValue,
  TeachingResourceTypeValue,
  TopicCategoryValue,
  TopicTypeValue,
} from '../constants/essay.js';

export interface EssayTask {
  id: string;
  classId: string;
  createdBy: string;
  title: string;
  topicType: TopicTypeValue;
  topicCategory: TopicCategoryValue;
  requirements: string;
  keyPoints: string[];
  referenceEssay: string | null;
  wordLimitMin: number;
  wordLimitMax: number;
  dueDate: Date | null;
  status: 'draft' | 'published' | 'closed';
  createdAt: Date;
  updatedAt: Date;
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
  submittedAt: Date;
  correctedAt: Date | null;
}

export interface CorrectionError {
  type: ErrorTypeValue;
  original: string;
  corrected: string;
  explanation: string;
  position: { start: number; end: number };
}

export interface Correction {
  id: string;
  essayId: string;
  contentScore: number;
  languageScore: number;
  structureScore: number;
  presentationScore: number;
  totalScore: number;
  scoreTier: string;
  errors: CorrectionError[];
  revisedEssay: string;
  suggestions: { priority: 'high' | 'medium' | 'low'; category: string; suggestion: string }[];
}

export interface TeachingResource {
  id: string;
  type: TeachingResourceTypeValue;
  title: string;
  topicType: TopicTypeValue | null;
  difficulty: TeachingResourceDifficultyValue;
  content: string;
  highlights: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentTagRecord {
  id: string;
  studentId: string;
  tag: StudentTagValue;
  updatedBy: string;
  updatedAt: string;
}

export interface ScoreDistribution {
  range: string;
  count: number;
}

export interface ErrorStatItem {
  type: string;
  count: number;
  percentage: number;
}

export interface ClassAnalytics {
  classId: string;
  className: string;
  totalStudents: number;
  totalEssays: number;
  averageScore: number | null;
  scoreTrend: Array<{ taskId: string; taskTitle: string; averageScore: number; essayCount: number }>;
  scoreDistribution: ScoreDistribution[];
  topErrors: ErrorStatItem[];
  topicTypeComparison: Array<{ topicType: string; averageScore: number; essayCount: number }>;
}

export interface StudentAnalytics {
  studentId: string;
  studentName: string;
  totalEssays: number;
  averageScore: number | null;
  abilities: {
    content: number;
    language: number;
    structure: number;
    presentation: number;
  };
  scoreTrend: Array<{ essayId: string; title: string; score: number; submittedAt: string }>;
  errorDistribution: ErrorStatItem[];
  recentEssays: Essay[];
}
