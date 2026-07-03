import { randomUUID } from 'node:crypto';
import { type EssayTaskInput, correctEssay, createProviderRouter } from '@betterwrite/ai';
import { corrections, db, essays } from '@betterwrite/db';
import { getScoreTier } from '@betterwrite/shared';
import { and, eq } from 'drizzle-orm';

export { performOcr, type OcrResult } from './ocr.js';

export interface CorrectionJob {
  essayId: string;
}

const router = createProviderRouter(process.env);

// 启动时恢复卡住的作文：将 'correcting' 状态的作文重置为 'pending'，使其可被重新处理。
export async function resetStuckEssays(): Promise<number> {
  const stuck = await db.query.essays.findMany({ where: eq(essays.status, 'correcting') });
  if (stuck.length === 0) return 0;

  const now = new Date().toISOString();
  for (const essay of stuck) {
    await db
      .update(essays)
      .set({ status: 'pending', updatedAt: now })
      .where(eq(essays.id, essay.id));
  }
  console.log(`[Worker] Reset ${stuck.length} stuck essay(s) from 'correcting' to 'pending'`);
  return stuck.length;
}

export async function processCorrection(job: CorrectionJob): Promise<void> {
  const { essayId } = job;
  console.log(`📝 Correcting essay ${essayId}`);

  const essay = await db.query.essays.findFirst({
    where: eq(essays.id, essayId),
    with: { task: true, student: true },
  });

  if (!essay) {
    throw new Error(`Essay ${essayId} not found`);
  }

  // 幂等性：已完成的作文不重复批改，避免重复插入 correction 行。
  if (essay.status === 'completed') {
    console.log(`⏭️ Essay ${essayId} already completed, skipping`);
    return;
  }

  const now = new Date().toISOString();

  await db
    .update(essays)
    .set({ status: 'correcting', updatedAt: now })
    .where(eq(essays.id, essayId));

  const startTime = Date.now();

  try {
    let result: Awaited<ReturnType<typeof correctEssay>>;

    if (router.availableNames().length === 0) {
      console.warn('No AI provider configured, using mock correction');
      result = createMockCorrection(essay.content, essay.wordCount ?? 0);
    } else if (!essay.task) {
      result = await correctEssay(
        essay.content,
        {
          title: '自由写作',
          requirements: '请根据题目要求完成一篇英语作文。',
          keyPoints: [],
          topicType: 'narration',
          wordLimitMin: 80,
          wordLimitMax: 125,
        },
        router,
      );
    } else {
      const taskInput: EssayTaskInput = {
        title: essay.task.title,
        requirements: essay.task.requirements,
        keyPoints: safeParseJson<string[]>(essay.task.keyPoints, []),
        topicType: essay.task.topicType,
        wordLimitMin: essay.task.wordLimitMin,
        wordLimitMax: essay.task.wordLimitMax,
      };
      result = await correctEssay(essay.content, taskInput, router);
    }

    const correctionTimeMs = Date.now() - startTime;
    const correctionId = randomUUID();

    // 事务保证 correction 写入与 essay 状态更新的原子性；
    // 末尾 UPDATE 附加 status='correcting' 条件，防止并发重复处理写入第二份结果。
    await db.transaction(async (tx) => {
      await tx.insert(corrections).values({
        id: correctionId,
        essayId,
        contentScore: result.contentScore,
        languageScore: result.languageScore,
        structureScore: result.structureScore,
        presentationScore: result.presentationScore,
        totalScore: result.totalScore,
        scoreTier: result.scoreTier,
        errors: JSON.stringify(result.errors),
        errorStats: JSON.stringify(aggregateErrorStats(result.errors)),
        highlights: JSON.stringify(result.highlights),
        sentenceAnalysis: JSON.stringify([]),
        revisedEssay: result.revisedEssay,
        suggestions: JSON.stringify(result.suggestions),
        aiProvider: result.aiProvider,
        aiModel: result.aiModel,
        correctionTimeMs,
        createdAt: now,
      });

      const updated = await tx
        .update(essays)
        .set({
          status: 'completed',
          totalScore: result.totalScore,
          scoreTier: result.scoreTier,
          correctionId,
          correctedAt: now,
          updatedAt: now,
        })
        .where(and(eq(essays.id, essayId), eq(essays.status, 'correcting')));

      if (updated.rowsAffected === 0) {
        throw new Error(`Essay ${essayId} was not in 'correcting' state, aborting`);
      }
    });

    console.log(`✅ Essay ${essayId} corrected: ${result.totalScore}/15 (${result.scoreTier})`);
  } catch (error) {
    console.error(`❌ Essay ${essayId} correction failed:`, error);
    await db.update(essays).set({ status: 'failed', updatedAt: now }).where(eq(essays.id, essayId));
    throw error;
  }
}

function aggregateErrorStats(errors: Array<{ type: string }>): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const error of errors) {
    stats[error.type] = (stats[error.type] ?? 0) + 1;
  }
  return stats;
}

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createMockCorrection(
  content: string,
  wordCount: number,
): Awaited<ReturnType<typeof correctEssay>> {
  const length = content.length;
  let base = 10;

  if (length > 600) base = 13;
  else if (length > 400) base = 12;
  else if (length > 200) base = 10;
  else base = 7;

  let total = base;
  if (wordCount < 80) total = Math.min(total, 9.5);
  if (wordCount >= 100 && wordCount <= 125) total = Math.min(15, total + 0.5);

  const tier = getScoreTier(total);
  const contentScore = Math.round(total * 0.3 * 10) / 10;
  const languageScore = Math.round(total * 0.4 * 10) / 10;
  const structureScore = Math.round(total * 0.2 * 10) / 10;
  const presentationScore = Math.round(total * 0.1 * 10) / 10;

  return {
    contentScore,
    languageScore,
    structureScore,
    presentationScore,
    totalScore: total,
    scoreTier: tier.tier,
    errors: [],
    highlights: [],
    revisedEssay: content,
    suggestions: [
      {
        priority: 'medium' as const,
        category: '系统提示',
        suggestion: 'AI Provider 未配置，当前为模拟评分。请配置 API Key 后启用真实批改。',
      },
    ],
    aiProvider: 'mock',
    aiModel: 'mock',
  };
}
