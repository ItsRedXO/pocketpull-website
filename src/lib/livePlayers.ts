const RESET_TIMEZONE = 'America/Los_Angeles';

// Hour-of-day (Pacific) -> fraction of the admin-set [min,max] range. Lowest
// overnight while people sleep, ramping up through the morning and peaking
// in the evening. Interpolated smoothly between these anchors below.
const ANCHORS: [number, number][] = [
  [0, 0.34], [3, 0.12], [6, 0.16], [8, 0.34], [10, 0.55],
  [13, 0.68], [16, 0.8], [19, 1.0], [21, 0.86], [23, 0.5], [24, 0.34],
];

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function envelopeAt(hourFraction: number): number {
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [h0, v0] = ANCHORS[i];
    const [h1, v1] = ANCHORS[i + 1];
    if (hourFraction >= h0 && hourFraction <= h1) {
      const t = (hourFraction - h0) / (h1 - h0);
      return v0 + (v1 - v0) * smoothstep(t);
    }
  }
  return ANCHORS[0][1];
}

function hourFractionInZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(date);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return hour + minute / 60;
}

/**
 * Deterministic "live players online" figure: a continuous function of wall
 * clock time, so it never jumps between polls and reads the same for every
 * visitor at the same moment (no per-tab randomness to desync). Bounded to
 * [min,max], shaped lower overnight (America/Los_Angeles) and higher in the
 * evening, with small organic sine-wave wander layered on top so it still
 * drifts up and down like people joining/leaving -- never in a big single
 * step.
 */
export function getSimulatedLivePlayers(min: number, max: number, date: Date = new Date()): number {
  if (max <= min) return Math.round(Math.max(0, min));
  const envelope = envelopeAt(hourFractionInZone(date, RESET_TIMEZONE));

  const t = date.getTime();
  const wander =
    0.05 * Math.sin(t / (6.5 * 60_000)) +
    0.035 * Math.sin(t / (17 * 60_000) + 1.3) +
    0.025 * Math.sin(t / (41 * 60_000) + 2.7);

  const fraction = Math.min(1, Math.max(0, envelope + wander));
  return Math.round(min + fraction * (max - min));
}
