// Supabase Edge Function — consumer-web-get-calendar-feed (product caller)
//
// MESITA-3954: the guest's reservations as an iCal feed. Google Calendar,
// Apple Calendar and Outlook subscribe to this URL and re-read it on their
// own schedule, so a new table appears and a cancelled one disappears with
// no action from the guest. Public (calendar servers carry no session): the
// token from consumer-web-get-calendar-link is the only key, and it opens
// one guest's upcoming tables and nothing else.
//
// GET ?token=<token>  →  text/calendar
//
// Lists what Me › Reservations' Upcoming lists: pending and confirmed tables
// whose slot hasn't passed, never operator test tickets. Each is a 2-hour
// event in UTC; the calendar shows it in the reader's own zone.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";
import { PASSED_GRACE_MS } from "../_shared/reservation-doc.ts";
import { buildCalendar, type CalendarEvent } from "../_shared/ics.ts";

const TABLE_MINUTES = 120;
const MAX_EVENTS = 200;

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

serveJson("consumer-web-get-calendar-feed", async (req) => {
  const ctx = openRequest(req, ["GET", "HEAD"]);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (token.length < 32) return text("Not found", 404);

  const { data: feed, error: feedError } = await admin
    .from("consumer_calendar_feeds")
    .select("consumer_id")
    .eq("token", token)
    .maybeSingle();
  if (feedError) {
    console.error("[consumer-web-get-calendar-feed] feed:", feedError.message);
    return text("Try again later", 500);
  }
  if (!feed) return text("Not found", 404);

  const cutoff = new Date(Date.now() - PASSED_GRACE_MS).toISOString();
  const { data, error } = await admin
    .from("reservation_tickets")
    .select("id, reserved_at, party_size, state, place_id")
    .eq("consumer_id", feed.consumer_id)
    .eq("is_test", false)
    .in("state", ["pending", "confirmed"])
    .gte("reserved_at", cutoff)
    .order("reserved_at", { ascending: true })
    .limit(MAX_EVENTS);
  if (error) {
    console.error("[consumer-web-get-calendar-feed] tickets:", error.message);
    return text("Try again later", 500);
  }

  const rows = await attachPlaces(admin, data ?? []);
  const events: CalendarEvent[] = [];
  for (const r of rows) {
    if (!r.reserved_at) continue;
    const place = r.place?.name ?? "a restaurant";
    const party = r.party_size ? `Table for ${r.party_size}` : "Table";
    const pending = r.state === "pending";
    events.push({
      uid: `${r.id}@mesita.ai`,
      start: new Date(r.reserved_at),
      minutes: TABLE_MINUTES,
      title: `${party} · ${place}`,
      location: r.place?.address ?? null,
      description: pending
        ? "Booked with Mesita. Waiting for the place to confirm."
        : "Booked with Mesita.",
      url: "https://mesita.ai/me/reservations",
      tentative: pending,
    });
  }

  const body = buildCalendar("Mesita reservations", events);
  return new Response(req.method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="mesita.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
});
