import { z } from 'zod';

export const errorPositionSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});

export const errorSchema = z.object({
  type: z.string(),
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
  position: errorPositionSchema,
});

export const vocabularySuggestionSchema = z.object({
  original: z.string(),
  suggestion: z.string(),
  context: z.string(),
});

export const highlightSchema = z.object({
  sentence: z.string(),
  type: z.string(),
  comment: z.string(),
});

export const contentPointSchema = z.object({
  point: z.string(),
  status: z.enum(['fully', 'partially', 'missing']),
  evidence: z.string(),
});

export const contentAnalysisSchema = z.object({
  pointCoverage: z.array(contentPointSchema),
  expansionScore: z.number().min(0).max(4.5),
  relevanceScore: z.number().min(0).max(4.5),
  contentScore: z.number().min(0).max(1.5),
  comment: z.string(),
});

export const taskUnderstandingSchema = z.object({
  genreCorrect: z.boolean(),
  personTenseAppropriate: z.boolean(),
  formatAppropriate: z.boolean(),
  comment: z.string(),
});

export const requiredElementSchema = z.object({
  element: z.string(),
  required: z.boolean(),
  present: z.boolean(),
  evidence: z.string(),
});

export const topicIssueSchema = z.object({
  severity: z.enum(['high', 'medium', 'low']),
  category: z.string(),
  description: z.string(),
  evidence: z.string(),
});

export const languageAnalysisSchema = z.object({
  errors: z.array(errorSchema),
  errorStats: z.record(z.string(), z.number().int().min(0)),
  vocabularyLevel: z.enum(['basic', 'intermediate', 'advanced']),
  vocabularySuggestions: z.array(vocabularySuggestionSchema),
  sentenceStats: z.object({
    simpleCount: z.number().int().min(0),
    compoundCount: z.number().int().min(0),
    complexCount: z.number().int().min(0),
  }),
  highlights: z.array(highlightSchema),
  revisedEssay: z.string(),
  languageScore: z.number().min(0).max(6),
  comment: z.string(),
});

export const paragraphStructureSchema = z.object({
  hasOpening: z.boolean(),
  hasBody: z.boolean(),
  hasClosing: z.boolean(),
  openingQuality: z.enum(['poor', 'fair', 'good', 'excellent']),
  bodyParagraphs: z.number().int().min(0),
  closingQuality: z.enum(['poor', 'fair', 'good', 'excellent']),
});

export const connectiveUsageSchema = z.object({
  usedConnectives: z.array(z.string()),
  missingTypes: z.array(z.string()),
  score: z.number().min(0).max(3),
});

export const formatCheckSchema = z.object({
  type: z.string(),
  hasGreeting: z.boolean(),
  hasClosing: z.boolean(),
  hasSignature: z.boolean(),
  isCorrect: z.boolean(),
});

export const structureAnalysisSchema = z.object({
  paragraphStructure: paragraphStructureSchema,
  connectiveUsage: connectiveUsageSchema,
  formatCheck: formatCheckSchema,
  wordCount: z.number().int().min(0),
  wordCountScore: z.number().min(0).max(3),
  structureScore: z.number().min(0).max(3),
  comment: z.string(),
});

export const suggestionSchema = z.object({
  priority: z.enum(['high', 'medium', 'low']),
  category: z.string(),
  suggestion: z.string(),
});

export const topicAdherenceAnalysisSchema = z.object({
  taskUnderstanding: taskUnderstandingSchema,
  keyPointCoverage: z.array(contentPointSchema),
  requiredElements: z.array(requiredElementSchema),
  topicRelevance: z.object({
    score: z.number().min(0).max(5),
    comment: z.string(),
  }),
  topicAdherenceScore: z.number().min(0).max(3),
  issues: z.array(topicIssueSchema),
  suggestions: z.array(suggestionSchema),
  comment: z.string(),
});

export const dimensionScoresSchema = z.object({
  topicAdherence: z.number().min(0).max(3),
  content: z.number().min(0).max(1.5),
  language: z.number().min(0).max(6),
  structure: z.number().min(0).max(3),
  presentation: z.number().min(0).max(1.5),
});

export const scorerSchema = z.object({
  totalScore: z.number().min(0).max(15),
  scoreTier: z.string(),
  tierLabel: z.string(),
  dimensionScores: dimensionScoresSchema,
  suggestions: z.array(suggestionSchema),
  comment: z.string(),
});

export type ContentAnalysis = z.infer<typeof contentAnalysisSchema>;
export type TopicAdherenceAnalysis = z.infer<typeof topicAdherenceAnalysisSchema>;
export type LanguageAnalysis = z.infer<typeof languageAnalysisSchema>;
export type StructureAnalysis = z.infer<typeof structureAnalysisSchema>;
export type ScorerResult = z.infer<typeof scorerSchema>;
