import { env } from '@betterwrite/shared/env';
import { logger } from '@betterwrite/shared/logger';
import {
  CORRECTION_JOB,
  CORRECTION_QUEUE,
  type CorrectionJobData,
} from '@betterwrite/shared/queue';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

const connection =
  env.REDIS_URL && !isBuildPhase
    ? new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      })
    : null;

export const correctionQueue = connection
  ? new Queue<CorrectionJobData>(CORRECTION_QUEUE, { connection })
  : null;

export async function addCorrectionJob(essayId: string): Promise<void> {
  if (!correctionQueue) {
    throw new Error('Redis 未配置，无法入队批改任务');
  }
  // Bug #264: 之前用 jobId: essayId + 同一篇 essay 在 retry 路径会被二次 add。
  // BullMQ 5.x 在 jobId 已存在时（即便原 job 已 failed）默认抛 "Job already exists"。
  // 修法：先用 removeOnFail=100 把失败 job 移除；万一仍冲突则带延时 nonce 重试。
  try {
    // 先尝试清理可能残留的 failed/completed job（removeOnComplete/Fail 窗口内）。
    const existing = await correctionQueue.getJob(essayId);
    if (existing) {
      try {
        await existing.remove();
      } catch (removeErr) {
        logger.warn(
          { essayId, err: removeErr instanceof Error ? removeErr.message : 'unknown' },
          'Failed to remove stale correction job (will retry add anyway)',
        );
      }
    }
    await correctionQueue.add(
      CORRECTION_JOB,
      { essayId },
      {
        jobId: essayId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/already exists|duplicate/i.test(message)) {
      // 极端竞态：另一个并发 retry 已经 add 了。返回成功即可（最终都会被 worker 处理）。
      logger.warn(
        { essayId, message },
        'Correction job already exists, treating as success',
      );
      return;
    }
    throw err;
  }
  logger.info({ essayId }, 'Correction job queued');
}
