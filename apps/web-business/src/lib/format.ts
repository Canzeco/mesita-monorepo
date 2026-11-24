export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Timezone-independent absolute stamp ("2026-06-25 07:36 UTC"). Derived
// purely from the ISO string so it renders identically on server and
// client — safe to show during SSR / first paint without a hydration
// mismatch.
export function formatAbsoluteUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

/**
 * A date as "Mar 4, 2027" in one fixed time zone (MESITA-3632), so the
 * server and the browser print the same day. Premier has no place time
 * zone, so it uses the default. "" when the date does not parse.
 */
export function day(iso: string | null | undefined, tz = "America/Monterrey"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz });
}

/** "99 USD", "999 USD", "41.23 USD": the code after the number and never a
 *  "$", which reads as pesos in Mexico (Pato, MESITA-3919: "mention the actual
 *  price"). Whole dollars drop the cents. */
export function usd(cents: number): string {
  const whole = cents % 100 === 0;
  const n = (cents / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  return `${n} USD`;
}
