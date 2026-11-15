// HOW LONG AGO, THE INSTAGRAM WAY (MESITA-4000, Pato 2026-11-14: "just a
// list with time ago … or maybe date"; answered "2h · 3d, then date"). Every
// Me list (Notifications, Tickets) ends a row with it instead of grouping
// rows under day headings:
//
//   under a minute   now
//   under an hour    5m
//   under a day      2h
//   under a week     3d
//   older            Nov 10        (Nov 10, 2025 when not this year)
//
// A plain module: no React, so lists and tests share it.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** `iso` as "now", "5m", "2h", "3d" or "Nov 10", measured from `nowMs`. A
 *  time a little in the future (a clock skew) reads "now". */
export function timeAgo(iso: string, nowMs: number = Date.now()): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const ago = nowMs - at;
  if (ago < MIN) return "now";
  if (ago < HOUR) return `${Math.floor(ago / MIN)}m`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)}h`;
  if (ago < 7 * DAY) return `${Math.floor(ago / DAY)}d`;
  const d = new Date(at);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() === new Date(nowMs).getFullYear() ? undefined : "numeric",
  });
}
