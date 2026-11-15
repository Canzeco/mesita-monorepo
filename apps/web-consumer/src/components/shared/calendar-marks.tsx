// The three calendars a guest's reservations feed goes to (MESITA-3979),
// as their OFFICIAL icons (MESITA-3985): the Wikimedia Commons files in
// public/marks/ (public domain), shipped unchanged, each on the one app tile
// (AppTile, MESITA-3990). Used wherever the app names a calendar:
// Reservations' header button, the Calendar page's rows and Integrations'
// Calendar row.

import { AppTile } from "./app-tile";

export type CalendarKind = "google" | "apple" | "outlook";

const FILES: Record<CalendarKind, { src: string; inset: boolean }> = {
  google: { src: "/marks/google-calendar.svg", inset: true },
  apple: { src: "/marks/apple-calendar.svg", inset: false },
  outlook: { src: "/marks/outlook.svg", inset: true },
};

export function CalendarMark({ kind, size = 28 }: { kind: CalendarKind; size?: number }) {
  return <AppTile src={FILES[kind].src} inset={FILES[kind].inset} size={size} />;
}

/** The three side by side, Google first. */
export function CalendarMarksRow({ size = 28 }: { size?: number }) {
  const order: CalendarKind[] = ["google", "apple", "outlook"];
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      {order.map((kind) => (
        <CalendarMark key={kind} kind={kind} size={size} />
      ))}
    </span>
  );
}
