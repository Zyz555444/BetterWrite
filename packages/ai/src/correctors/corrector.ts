import { countWords, getScoreTier } from '@betterwrite/shared';
import type { BaseAIProvider } from '../providers/base.js';
import type { AIProviderRouter } from '../router.js';
import { contentPrompt } from './content.js';
import { languagePrompt } from './language.js';
import {
  type ContentAnalysis,
  type LanguageAnalysis,
  type ScorerResult,
  type StructureAnalysis,
  type TopicAdherenceAnalysis,
  contentAnalysisSchema,
  languageAnalysisSchema,
  scorerSchema,
  structureAnalysisSchema,
  topicAdherenceAnalysisSchema,
} from './schemas.js';
import { scorerPrompt } from './scorer.js';
import { structurePrompt } from './structure.js';
import { topicAdherencePrompt } from './topic-adherence.js';

export interface EssayTaskInput {
  title: string;
  requirements: string;
  keyPoints: string[];
  topicType: string;
  wordLimitMin: number;
  wordLimitMax: number;
}

export interface CorrectionResult {
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
  highlights: Array<{
    sentence: string;
    type: string;
    comment: string;
  }>;
  revisedEssay: string;
  suggestions: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    suggestion: string;
  }>;
  aiProvider: string;
  aiModel: string;
}

export async function correctEssay(
  essay: string,
  task: EssayTaskInput,
  router: AIProviderRouter,
): Promise<CorrectionResult> {
  const wordCount = countWords(essay);

  const [topicAdherenceResult, contentResult, languageResult, structureResult] = await Promise.all([
    router.executeWithFallback('topicAdherence', (provider) =>
      analyzeTopicAdherence(provider, essay, task),
    ),
    router.executeWithFallback('content', (provider) => analyzeContent(provider, essay, task)),
    router.executeWithFallback('language', (provider) => analyzeLanguage(provider, essay)),
    router.executeWithFallback('structure', (provider) => analyzeStructure(provider, essay, task)),
  ]);

  const scoreResult = await router.executeWithFallback('scorer', (provider) =>
    calculateScore(provider, {
      topicAdherenceResult,
      contentResult,
      languageResult,
      structureResult,
      wordCount,
      task,
    }),
  );

  return {
    topicAdherenceScore: scoreResult.dimensionScores.topicAdherence,
    contentScore: scoreResult.dimensionScores.content,
    languageScore: scoreResult.dimensionScores.language,
    structureScore: scoreResult.dimensionScores.structure,
    presentationScore: scoreResult.dimensionScores.presentation,
    totalScore: scoreResult.totalScore,
    scoreTier: scoreResult.scoreTier,
    errors: languageResult.errors,
    highlights: languageResult.highlights,
    revisedEssay: languageResult.revisedEssay,
    suggestions: mergeSuggestions(topicAdherenceResult.suggestions, scoreResult.suggestions),
    aiProvider: scoreResult.aiProvider,
    aiModel: scoreResult.aiModel,
  };
}

async function analyzeContent(
  provider: BaseAIProvider,
  essay: string,
  task: EssayTaskInput,
): Promise<ContentAnalysis> {
  const prompt = contentPrompt(essay, task);
  return provider.completeStructured(prompt, contentAnalysisSchema, { maxOutputTokens: 2048 });
}

async function analyzeTopicAdherence(
  provider: BaseAIProvider,
  essay: string,
  task: EssayTaskInput,
): Promise<TopicAdherenceAnalysis> {
  const prompt = topicAdherencePrompt(essay, task);
  return provider.completeStructured(prompt, topicAdherenceAnalysisSchema, {
    maxOutputTokens: 2048,
  });
}

async function analyzeLanguage(provider: BaseAIProvider, essay: string): Promise<LanguageAnalysis> {
  const prompt = languagePrompt(essay);
  return provider.completeStructured(prompt, languageAnalysisSchema, { maxOutputTokens: 4096 });
}

async function analyzeStructure(
  provider: BaseAIProvider,
  essay: string,
  task: EssayTaskInput,
): Promise<StructureAnalysis> {
  const prompt = structurePrompt(essay, task);
  return provider.completeStructured(prompt, structureAnalysisSchema, { maxOutputTokens: 2048 });
}

async function calculateScore(
  provider: BaseAIProvider,
  input: {
    topicAdherenceResult: TopicAdherenceAnalysis;
    contentResult: ContentAnalysis;
    languageResult: LanguageAnalysis;
    structureResult: StructureAnalysis;
    wordCount: number;
    task: EssayTaskInput;
  },
): Promise<ScorerResult & { aiProvider: string; aiModel: string }> {
  const prompt = scorerPrompt(input);
  const result = await provider.completeStructured(prompt, scorerSchema, { maxOutputTokens: 2048 });
  const tier = getScoreTier(result.totalScore);
  return {
    ...result,
    scoreTier: tier.tier,
    tierLabel: tier.label,
    aiProvider: provider.name,
    aiModel: provider.defaultModel,
  };
}

function mergeSuggestions(
  topicSuggestions: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    suggestion: string;
  }>,
  scorerSuggestions: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    suggestion: string;
  }>,
): Array<{ priority: 'high' | 'medium' | 'low'; category: string; suggestion: string }> {
  const seen = new Set<string>();
  const merged: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    suggestion: string;
  }> = [];
  for (const s of [...topicSuggestions, ...scorerSuggestions]) {
    const key = `${s.category}::${s.suggestion}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }
  return merged;
}
