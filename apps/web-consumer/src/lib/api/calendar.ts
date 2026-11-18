// Me › Integrations › Calendar (MESITA-3954, MESITA-4041): one private feed
// link per calendar, whether each is connected, and each calendar's own
// "subscribe" address for its link.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarKind } from "@/components/shared/calendar-marks";
import { invokeEF } from "./_invoke";

export type { CalendarKind };

export type CalendarFeed = {
  /** The https feed address for this calendar alone. */
  url: string;
  /** When this calendar last read its link; null = never, so not connected. */
  last_read_at: string | null;
  /** Off: the link serves an empty calendar, so Mesita's tables leave it. */
  on: boolean;
};

export type CalendarFeeds = Record<CalendarKind, CalendarFeed>;

/** The one cache key for the feeds: the Calendar page and the Reserve
 *  page's quick-connect (MESITA-4315, gone with MESITA-4355) shared it, so either updates both. */
export const CALENDAR_FEEDS_KEY = "calendar-feeds";

/** The three links, made on first ask. `reset` replaces all three; `set`
 *  switches one calendar on or off. */
export async function apiGetCalendarFeeds(
  client: SupabaseClient,
  opts: { reset?: boolean; set?: { calendar: CalendarKind; on: boolean } } = {},
): Promise<CalendarFeeds> {
  const body = opts.reset ? { reset: true } : opts.set ? { calendar: opts.set.calendar, on: opts.set.on } : {};
  const res = await invokeEF<{ calendars: CalendarFeeds }>(client, "consumer-web-get-calendar-link", body);
  return res.calendars;
}

/** webcal:// is "subscribe", not "download", to Apple Calendar and Google. */
export function webcalUrl(https: string): string {
  return https.replace(/^https?:\/\//, "webcal://");
}

/** A calendar's own add-by-URL door for its link. */
export function subscribeUrl(kind: CalendarKind, https: string): string {
  if (kind === "google") {
    return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl(https))}`;
  }
  if (kind === "apple") return webcalUrl(https);
  return `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent("Mesita reservations")}`;
}
