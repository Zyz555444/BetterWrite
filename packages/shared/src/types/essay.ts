import type {
  AchievementTierValue,
  AiAssistantModeValue,
  ErrorBookStatusValue,
  ErrorTypeValue,
  ExerciseTypeValue,
  PracticeDifficultyValue,
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
  submittedAt: string;
  correctedAt: string | null;
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
  scoreTrend: Array<{
    taskId: string;
    taskTitle: string;
    averageScore: number;
    essayCount: number;
  }>;
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

export interface ErrorBookItem {
  id: string;
  studentId: string;
  essayId: string | null;
  correctionId: string | null;
  errorType: string;
  original: string;
  corrected: string;
  explanation: string | null;
  status: ErrorBookStatusValue;
  practiceCount: number;
  masteredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ErrorBookGroup {
  errorType: string;
  total: number;
  unresolved: number;
  mastered: number;
  latestOriginal: string;
  latestCorrected: string;
}

export interface QuestionBankItem {
  id: string;
  topicType: string;
  topicCategory: string | null;
  title: string;
  requirements: string;
  keyPoints: string[];
  referenceEssay: string | null;
  wordLimitMin: number;
  wordLimitMax: number;
  timeLimitMinutes: number | null;
  difficulty: PracticeDifficultyValue;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeExercise {
  id: string;
  studentId: string;
  exerciseType: ExerciseTypeValue;
  questionId: string | null;
  topicType: string | null;
  title: string | null;
  content: string;
  wordCount: number | null;
  score: number | null;
  scoreTier: string | null;
  aiFeedback: Record<string, unknown>;
  durationMs: number | null;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface AiConversation {
  id: string;
  studentId: string;
  mode: AiAssistantModeValue;
  inputText: string;
  outputText: string;
  metadata: Record<string, unknown>;
  aiProvider: string | null;
  aiModel: string | null;
  tokensUsed: number | null;
  createdAt: string;
}

export interface AiAssistantResult {
  mode: AiAssistantModeValue;
  input: string;
  output: string;
  details: Record<string, unknown>;
  provider: string | null;
  model: string | null;
}

export interface Achievement {
  id: string;
  studentId: string;
  code: string;
  tier: AchievementTierValue;
  title: string;
  description: string | null;
  icon: string | null;
  earnedAt: string;
  isUnlocked: boolean;
}

export interface EssayDraft {
  id: string;
  studentId: string;
  taskId: string;
  content: string;
  wordCount: number | null;
  durationMs: number | null;
  updatedAt: string;
}

export interface DailyQuote {
  id: string;
  text: string;
  translation: string | null;
  source: string | null;
}

export interface StudentProgress {
  studentId: string;
  totalEssays: number;
  averageScore: number | null;
  radarData: Array<{ label: string; value: number; max: number }>;
  progressCurve: Array<{ label: string; value: number }>;
  achievements: Achievement[];
  rank: { classRank: number; total: number; percentile: number } | null;
  level: 'basic' | 'improving' | 'advanced';
}
