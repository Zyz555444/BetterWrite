export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { resetStuckEssays } = await import('@betterwrite/worker');
    try {
      const count = await resetStuckEssays();
      if (count > 0) {
      }
    } catch (err) {
      console.error('[Instrumentation] Failed to reset stuck essays:', err);
    }
  }
}
