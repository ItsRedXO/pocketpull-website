// Shared "resets every night at midnight Pacific" clock for the Poke Brawl
// daily battle cap and the Item Shop rotation -- both need to flip over at
// the same wall-clock moment, not on a rolling N-hours-since-last-action
// timer (which drifts depending on when a player/admin last touched them).
// Uses America/Los_Angeles (not a fixed UTC offset) so the boundary stays at
// midnight through PST/PDT transitions automatically, via Node's built-in
// Intl support -- no extra timezone dependency needed.
const RESET_TIMEZONE = 'America/Los_Angeles';

function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value || '0');
  // Reading the zone's wall-clock digits for this instant and re-parsing them
  // *as UTC* recovers instant + offset(instant) -- comparing that back to the
  // instant itself gives the zone's actual UTC offset at that moment,
  // correctly accounting for whichever side of a DST transition it falls on.
  const reconstructed = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return reconstructed - instantMs;
}

/** The UTC instant corresponding to local midnight, on `date`'s calendar day in `timeZone`. */
export function startOfDayInZone(date: Date, timeZone: string = RESET_TIMEZONE): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const target = new Date(`${ymd}T00:00:00Z`).getTime();
  // Converges in <=2 iterations for any real-world zone: each pass re-derives
  // the zone's offset at the current guess and corrects toward the instant
  // whose zone-rendering is exactly `ymd 00:00:00`.
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const nextGuess = target - zoneOffsetMs(guess, timeZone);
    if (nextGuess === guess) break;
    guess = nextGuess;
  }
  return new Date(guess);
}

/** The next midnight in `timeZone` strictly after `date`. */
export function nextResetAt(date: Date, timeZone: string = RESET_TIMEZONE): Date {
  const startOfToday = startOfDayInZone(date, timeZone);
  // Nudge 25h past today's local midnight (covers a DST fall-back day's
  // extra hour) then re-snap to that instant's own local midnight, rather
  // than naively adding 24h which would land an hour off on a DST
  // transition day.
  return startOfDayInZone(new Date(startOfToday.getTime() + 25 * 60 * 60 * 1000), timeZone);
}
