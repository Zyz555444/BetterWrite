import { env } from '@betterwrite/shared/env';
import { logger } from '@betterwrite/shared/logger';
import {
  CORRECTION_JOB,
  CORRECTION_QUEUE,
  type CorrectionJobData,
} from '@betterwrite/shared/queue';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  : null;

export const correctionQueue = connection
  ? new Queue<CorrectionJobData>(CORRECTION_QUEUE, { connection })
  : null;

export async function addCorrectionJob(essayId: string): Promise<void> {
  if (!correctionQueue) {
    throw new Error('Redis 未配置，无法入队批改任务');
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
  logger.info({ essayId }, 'Correction job queued');
}
