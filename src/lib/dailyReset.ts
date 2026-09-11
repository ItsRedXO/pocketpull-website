// Frontend counterpart of backend/lib/dailyReset.ts -- keeps the homepage's
// simulated "today" counters (Packs Opened, Cards Won Today, etc.) resetting
// at the same midnight-Pacific boundary as the rest of the site, instead of
// each viewer's own local midnight. Uses America/Los_Angeles (not a fixed
// UTC offset) so it stays correct through PST/PDT transitions, via the
// browser's built-in Intl support -- no extra timezone dependency needed.
const RESET_TIMEZONE = 'America/Los_Angeles';

function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value || '0');
  const reconstructed = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return reconstructed - instantMs;
}

/** The UTC instant corresponding to local midnight, on `date`'s calendar day in `timeZone`. */
export function startOfDayInZone(date: Date = new Date(), timeZone: string = RESET_TIMEZONE): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const target = new Date(`${ymd}T00:00:00Z`).getTime();
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const nextGuess = target - zoneOffsetMs(guess, timeZone);
    if (nextGuess === guess) break;
    guess = nextGuess;
  }
  return new Date(guess);
}

/** The next midnight in `timeZone` strictly after `date`. */
export function nextResetAt(date: Date = new Date(), timeZone: string = RESET_TIMEZONE): Date {
  const startOfToday = startOfDayInZone(date, timeZone);
  return startOfDayInZone(new Date(startOfToday.getTime() + 25 * 60 * 60 * 1000), timeZone);
}
