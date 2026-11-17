// The Story staff page's times (MESITA-4264, MESITA-4297): absolute times in
// the place's timezone ("Approved at 14:05", "until 14:35 to pay"), and how
// long ago a story was posted ("12 min ago"), read against the server's clock.

const FALLBACK_TZ = "America/Mexico_City";

/** HH:MM of `iso` in `timeZone` (the place's; Mexico City when unknown). */
export function zonedClock(iso: string, timeZone: string | null | undefined): string {
  const d = new Date(iso);
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(d);
  try {
    return fmt(timeZone || FALLBACK_TZ);
  } catch {
    return fmt(FALLBACK_TZ);
  }
}

/** "just now", "12 min ago", "3 h ago". */
export function agoLabel(iso: string, nowIso: string): string {
  const min = Math.floor((Date.parse(nowIso) - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(min) || min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ago`;
}
