// The guest's calendar feed as iCalendar text (RFC 5545), MESITA-3954.
//
// Pure: rows in, text out, so the feed EF stays a read and this stays
// testable. Times go out in UTC (`…Z`), which every calendar converts to the
// reader's own zone, so the place's timezone never has to be named here.

export type CalendarEvent = {
  /** Stable across refreshes: the calendar updates the event in place. */
  uid: string;
  start: Date;
  minutes: number;
  title: string;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  /** A table the place hasn't confirmed yet shows as tentative. */
  tentative?: boolean;
};

/** 20261114T203000Z */
export function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escape a TEXT value: backslash, semicolon, comma, newline. */
export function icsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets (RFC 5545 §3.1), never inside a
 *  UTF-8 character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curLen = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (curLen + n > limit) {
      parts.push(cur);
      cur = "";
      curLen = 0;
      limit = 74; // continuation lines start with one space
    }
    cur += ch;
    curLen += n;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

export function buildCalendar(
  name: string,
  events: CalendarEvent[],
  now: Date = new Date(),
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mesita//Reservations//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(name)}`,
    // Hints for how often to re-read the feed; Apple honors them, Google
    // keeps its own schedule.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  const stamp = icsDate(now);
  for (const e of events) {
    const end = new Date(e.start.getTime() + e.minutes * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(e.start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText(e.title)}`,
    );
    if (e.location) lines.push(`LOCATION:${icsText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push(
      `STATUS:${e.tentative ? "TENTATIVE" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
