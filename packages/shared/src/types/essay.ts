import type { ErrorTypeValue, TopicCategoryValue, TopicTypeValue } from '../constants/essay.js';

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
