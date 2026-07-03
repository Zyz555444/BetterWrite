export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { resetStuckEssays } = await import('@betterwrite/worker');
    try {
      const count = await resetStuckEssays();
      if (count > 0) {
        console.log(`[Instrumentation] Reset ${count} stuck essay(s) on startup`);
      }
    } catch (err) {
      console.error('[Instrumentation] Failed to reset stuck essays:', err);
    }
  }
}
