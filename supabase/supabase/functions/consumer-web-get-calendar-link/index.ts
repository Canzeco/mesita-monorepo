// Supabase Edge Function — consumer-web-get-calendar-link (product caller)
//
// Me › Integrations › Calendar: the signed-in guest's private calendar feed
// links, one per calendar (MESITA-3954, MESITA-4041), made on first ask, with
// whether each calendar is connected (it has read its link) and on.
//
// Body: { reset?: boolean, calendar?: "google"|"apple"|"outlook", on?: boolean }
//   reset              replaces all three links: a link shared by mistake
//                      stops working, and every calendar must be added again
//   calendar + on      switches that calendar on or off; off, its link serves
//                      an empty calendar, so Mesita's tables leave it
// Response: { ok: true, calendars: { google|apple|outlook:
//              { url, last_read_at: string|null, on: boolean } } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { newLinkToken } from "../_shared/link-token.ts";

const CALENDARS = ["google", "apple", "outlook"] as const;
type Calendar = typeof CALENDARS[number];
type Row = { calendar: Calendar; token: string; last_read_at: string | null; off: boolean };

serveJson("consumer-web-get-calendar-link", async (req) => {
  const ctx = await requireConsumerRequest(req, {
    signIn: "Sign in to add your reservations to a calendar.",
  });
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;
  const body = await readJsonOr<{ reset?: boolean; calendar?: unknown; on?: unknown }>(req, {});

  if (body.calendar !== undefined) {
    if (!CALENDARS.includes(body.calendar as Calendar) || typeof body.on !== "boolean") {
      return json({ ok: false, error: "calendar must be google, apple or outlook, with on: boolean" }, 400);
    }
  }

  let rows: Row[] = [];
  if (!body.reset) {
    const { data, error } = await admin
      .from("consumer_calendar_feeds")
      .select("calendar, token, last_read_at, off")
      .eq("consumer_id", user.id);
    if (error) return json({ ok: false, error: error.message }, 500);
    rows = (data ?? []) as Row[];
  }

  const missing = CALENDARS.filter((c) => !rows.some((r) => r.calendar === c));
  if (missing.length > 0) {
    const now = new Date().toISOString();
    const fresh: Row[] = missing.map((calendar) => ({ calendar, token: newLinkToken(), last_read_at: null, off: false }));
    const { error } = await admin
      .from("consumer_calendar_feeds")
      .upsert(
        fresh.map((r) => ({ consumer_id: user.id, calendar: r.calendar, token: r.token, created_at: now, last_read_at: null, off: false })),
        { onConflict: "consumer_id,calendar" },
      );
    if (error) return json({ ok: false, error: error.message }, 500);
    rows = [...rows.filter((r) => !missing.includes(r.calendar)), ...fresh];
  }

  // Rows exist before on/off (MESITA-4141). A first request that turns a
  // calendar off used to update zero rows, then create them with off:false.
  if (body.calendar !== undefined && typeof body.on === "boolean") {
    const { error } = await admin
      .from("consumer_calendar_feeds")
      .update({ off: !body.on })
      .eq("consumer_id", user.id)
      .eq("calendar", body.calendar);
    if (error) return json({ ok: false, error: error.message }, 500);
    rows = rows.map((r) => r.calendar === body.calendar ? { ...r, off: !body.on } : r);
  }

  const feed = `${env.url}/functions/v1/consumer-web-get-calendar-feed?token=`;
  const calendars = Object.fromEntries(
    rows.map((r) => [r.calendar, { url: feed + encodeURIComponent(r.token), last_read_at: r.last_read_at, on: !r.off }]),
  );
  return json({ ok: true, calendars });
});
