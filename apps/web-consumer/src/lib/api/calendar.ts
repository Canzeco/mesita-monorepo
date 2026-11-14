// Me › Integrations › Calendar (MESITA-3954): the guest's private calendar
// feed link, and the three calendars' own "subscribe" addresses for it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

/** The https feed address; `reset` makes a new one and kills the old. */
export async function apiGetCalendarLink(
  client: SupabaseClient,
  reset = false,
): Promise<string> {
  const res = await invokeEF<{ url: string }>(
    client,
    "consumer-web-get-calendar-link",
    reset ? { reset: true } : {},
  );
  return res.url;
}

/** webcal:// is "subscribe", not "download", to Apple Calendar and Google. */
export function webcalUrl(https: string): string {
  return https.replace(/^https?:\/\//, "webcal://");
}

/** Each calendar's own add-by-URL door for the feed. */
export function calendarSubscribeLinks(https: string) {
  return {
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl(https))}`,
    apple: webcalUrl(https),
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent("Mesita reservations")}`,
  };
}
