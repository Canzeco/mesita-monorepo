// "Add to your calendar" for one reservation (MESITA-4355): one tap puts
// that table in the guest's calendar right away, no setup. Google and
// Outlook get their own prefilled "new event" pages; Apple gets an .ics
// event (Calendar's add sheet on an iPhone, the Calendar app on a Mac).
// The subscribe feed on Me › Integrations › Calendar is the automatic
// alternative; this is the one-off.
//
// React-free: plain functions, so the component and tests share them.

import type { CalendarKind } from "@/components/shared/calendar-marks";

export type CalendarTable = {
  /** Stable, so adding the same table twice updates one event (.ics). */
  id: string;
  title: string;
  start: Date;
  minutes: number;
  location?: string | null;
  details?: string | null;
};

/** 20261114T203000Z */
function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function end(t: CalendarTable): Date {
  return new Date(t.start.getTime() + t.minutes * 60_000);
}

export function googleEventUrl(t: CalendarTable): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: t.title,
    dates: `${utc(t.start)}/${utc(end(t))}`,
  });
  if (t.details) q.set("details", t.details);
  if (t.location) q.set("location", t.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function outlookEventUrl(t: CalendarTable): string {
  const q = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: t.title,
    startdt: t.start.toISOString(),
    enddt: end(t).toISOString(),
  });
  if (t.details) q.set("body", t.details);
  if (t.location) q.set("location", t.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q.toString()}`;
}

function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** One VEVENT, UTC times, so the calendar shows it in the reader's zone. */
export function icsEvent(t: CalendarTable, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mesita//Reservation//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${t.id}@mesita.ai`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(t.start)}`,
    `DTEND:${utc(end(t))}`,
    `SUMMARY:${icsText(t.title)}`,
  ];
  if (t.location) lines.push(`LOCATION:${icsText(t.location)}`);
  if (t.details) lines.push(`DESCRIPTION:${icsText(t.details)}`);
  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function icsDataUrl(t: CalendarTable): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsEvent(t))}`;
}

/** The three calendars, the device's own first: Apple on an iPhone, iPad
 *  or Mac; Google everywhere else. Outlook is always last. */
export function calendarOrder(userAgent: string): CalendarKind[] {
  const apple = /iPhone|iPad|iPod|Macintosh/.test(userAgent) && !/Android/.test(userAgent);
  return apple ? ["apple", "google", "outlook"] : ["google", "apple", "outlook"];
}
