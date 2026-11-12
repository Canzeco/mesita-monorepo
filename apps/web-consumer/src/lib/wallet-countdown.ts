// When a pending Wallet entry turns Available (MESITA-3549). The moment is
// the server's `available_at`; this only words the time left: "in 2 d 4 h",
// "in 3 h 12 min", "in 5 min", and "Available soon" once it has passed and
// the next Wallet read has not answered yet.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Null when the entry names no moment (an Available entry, an older server). */
export function countdownLabel(availableAt: string | null | undefined, nowMs: number): string | null {
  if (!availableAt) return null;
  const at = Date.parse(availableAt);
  if (!Number.isFinite(at)) return null;
  const left = at - nowMs;
  if (left <= 0) return "Available soon";
  if (left >= DAY) return `in ${Math.floor(left / DAY)} d ${Math.floor((left % DAY) / HOUR)} h`;
  if (left >= HOUR) return `in ${Math.floor(left / HOUR)} h ${Math.floor((left % HOUR) / MIN)} min`;
  return `in ${Math.max(1, Math.ceil(left / MIN))} min`;
}

/** The latest moment among these that is still ahead, for one re-read. */
export function nextAvailableMs(availableAts: Array<string | null | undefined>, nowMs: number): number | null {
  let next: number | null = null;
  for (const a of availableAts) {
    const t = a ? Date.parse(a) : NaN;
    if (Number.isFinite(t) && t > nowMs && (next === null || t < next)) next = t;
  }
  return next;
}

/** Extra re-reads while a row reads "Available soon" (MESITA-3750): at most
 *  this many per stuck moment, one per 30 s tick, then the page waits for the
 *  next visit. A failed or slow read never loops. */
export const MAX_STUCK_REREADS = 3;

export function shouldReread(attempts: number): boolean {
  return attempts < MAX_STUCK_REREADS;
}
