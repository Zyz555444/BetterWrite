import { env } from '@betterwrite/shared/env';
import { logger } from '@betterwrite/shared/logger';

const instrumentationLogger = logger.child({ component: 'instrumentation' });

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 触发运行时环境变量校验；失败会抛错并阻止应用启动。
    void env;

    const { resetStuckEssays } = await import('@betterwrite/worker');
    try {
      const count = await resetStuckEssays();
      if (count > 0) {
        instrumentationLogger.info({ resetCount: count }, 'Reset stuck essays');
      }
    } catch (err) {
      instrumentationLogger.error({ err }, 'Failed to reset stuck essays');
    }
  }
}
