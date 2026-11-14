// The three calendars a guest's reservations feed goes to (MESITA-3979),
// as their OFFICIAL icons (MESITA-3985, Pato: "use the actual fucking
// icons, not invent them"): the files in public/marks/, from Wikimedia
// Commons (public domain), shipped unchanged. Used wherever the app names
// a calendar: Reservations' header button, the Calendar page's rows and
// Integrations' Calendar row.

/* eslint-disable @next/next/no-img-element -- static SVG files, no optimizer needed */

export type CalendarKind = "google" | "apple" | "outlook";

const FILES: Record<CalendarKind, string> = {
  google: "/marks/google-calendar.svg",
  apple: "/marks/apple-calendar.svg",
  outlook: "/marks/outlook.svg",
};

export function CalendarMark({ kind, size = 20 }: { kind: CalendarKind; size?: number }) {
  return (
    <img
      src={FILES[kind]}
      alt=""
      aria-hidden
      width={size}
      height={size}
      // Apple's tile is white: a hairline keeps it a tile on a white row.
      className={`shrink-0 object-contain ${kind === "apple" ? "rounded-[22.5%] ring-1 ring-black/10" : ""}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

/** The three side by side, Google first. */
export function CalendarMarksRow({ size = 20 }: { size?: number }) {
  const order: CalendarKind[] = ["google", "apple", "outlook"];
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      {order.map((kind) => (
        <CalendarMark key={kind} kind={kind} size={size} />
      ))}
    </span>
  );
}
