// `opens_at` for an opening on a LATER day: "tomorrow 08:30", "Wed 08:30",
// "next Tue 08:30" a week out. A bare "08:30" means later today and nothing
// else (MESITA-2047). On a Tuesday a place shut all day used to read "opens
// 08:30" at 07:00; Scroll and the swipe deck now show closed places, so the
// chip is read. Every reader prints `opens ${opens_at}`, so the day rides
// inside the string.
//
// Web twin: `opensOnDay` in web-consumer's place-to-detail-helpers.ts.
// No imports, on purpose: `pnpm test` loads this file straight into Node.

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `dayIdx` is today, 0 = Sunday; `daysAhead` counts from it. */
export function opensOnDay(
  daysAhead: number,
  dayIdx: number,
  time: string,
): string {
  if (daysAhead <= 0) return time;
  if (daysAhead === 1) return `tomorrow ${time}`;
  const day = WEEKDAY_SHORT[(dayIdx + daysAhead) % 7];
  return daysAhead >= 7 ? `next ${day} ${time}` : `${day} ${time}`;
}
