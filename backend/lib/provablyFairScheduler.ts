import { nextResetAt } from './dailyReset';
import { rotateServerSeed } from './provablyFairServerSeed';

/**
 * Automatically rotates the provably-fair server seed every night at
 * midnight Pacific (the same reset boundary the daily battle cap / item
 * shop already use -- see dailyReset.ts), so it happens on a professional,
 * predictable cadence without an admin needing to remember to do it
 * manually. A failed rotation is logged and retried at the next scheduled
 * time rather than crashing the server or blocking pack openings, which
 * keep working off whatever seed is currently active either way.
 */
export function startProvablyFairRotationScheduler() {
  const runAndReschedule = async () => {
    try {
      const result = await rotateServerSeed();
      console.log(`[provablyFair] Automatic nightly rotation complete. Old seed (${result.oldSeedHash}) revealed, new active: ${result.newSeedHash}`);
    } catch (err: any) {
      console.error('[provablyFair] Automatic nightly rotation failed:', err?.message || err);
    } finally {
      scheduleNext();
    }
  };

  const scheduleNext = () => {
    const delay = nextResetAt(new Date()).getTime() - Date.now();
    setTimeout(runAndReschedule, Math.max(delay, 1000));
  };

  scheduleNext();
}
