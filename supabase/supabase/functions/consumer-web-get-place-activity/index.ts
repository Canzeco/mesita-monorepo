// Supabase Edge Function — consumer-web-get-place-activity
//
// Public. Returns one place's guest activity for the place profile's Reviews
// tab: verified Instagram stories, featured visits, featured reservations
// (MESITA-1147).
//
// Split out of consumer-web-get-place rather than bolted onto it: these are
// three more service-role reads, and Place — not Reviews — is the tab a guest
// lands on. The client fetches this lazily the first time Reviews is opened,
// so the default place view costs exactly what it costs today.
//
// Reads go through the service role because visit_tickets / reservation_tickets
// RLS is own-row-only; every row is privacy-shaped by _shared/place-activity.ts
// BEFORE it leaves this function (MESITA-913). Nothing financial ships: no bill
// totals, no phone numbers, no reservation notes.
//
// `orders` is always [] — the order ticket is scoped but not built (entity
// model, 2026-08-18). The key is in the payload so wiring orders later is a
// data change on this function, not a shape change on the client.
//
// Caller: consumer. Verb: get. Noun: place-activity.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, anonClient, readEFEnv } from "../_shared/auth.ts";
import {
  COMPLETED_VISIT_STATUSES,
  FEATURED_RESERVATION_STATUSES,
  mapReservationTickets,
  mapStoryTickets,
  mapVisitTickets,
} from "../_shared/place-activity.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Each feed is a horizontal rail of cards, not a paginated list — a couple of
// dozen is more than a guest will ever swipe through.
const FEED_LIMIT = 24;

// The consumer columns every feed joins. Privacy flags ride along so the
// mappers can drop rows the guest opted out of.
const CONSUMER_JOIN =
  "consumer:consumers(first_name, last_name, full_name, instagram_handle, " +
  "privacy_public, privacy_show_visits, privacy_show_stories, class_key, " +
  "instagram_followers_count)";

type Body = { id?: string; slug?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const idOrSlug = (bodyRes.body.id ?? bodyRes.body.slug ?? "").toString()
    .trim();
  if (!idOrSlug) {
    return json({ ok: false, error: "id or slug is required" }, 400);
  }

  // Resolve through the anon client + profiles RLS first, so this function
  // can never surface activity for a place the caller couldn't browse.
  const supabase = anonClient(envRes.env);
  const column = UUID_RE.test(idOrSlug) ? "id" : "slug";
  const { data: place, error: placeError } = await supabase
    .from("profiles")
    .select("id")
    .eq(column, idOrSlug)
    .maybeSingle();

  if (placeError) return json({ ok: false, error: placeError.message }, 500);
  if (!place) return json({ ok: false, error: "Place not found" }, 404);

  const projectId = (place as { id: string }).id;
  const admin = adminClient(envRes.env);

  const [storiesRes, visitsRes, reservationsRes, reviewedRes] = await Promise
    .all([
      admin
        .from("visit_tickets")
        .select(
          `id, story_status, story_screenshot_url, story_submitted_at, ` +
            `story_verified_at, created_at, ${CONSUMER_JOIN}`,
        )
        .eq("project_id", projectId)
        .not("story_screenshot_url", "is", null)
        .order("story_submitted_at", { ascending: false, nullsFirst: false })
        .limit(FEED_LIMIT),
      admin
        .from("visit_tickets")
        .select(
          `id, status, discount_percent, paid_at, validated_at, created_at, ` +
            CONSUMER_JOIN,
        )
        .eq("project_id", projectId)
        .in("status", COMPLETED_VISIT_STATUSES)
        .order("paid_at", { ascending: false, nullsFirst: false })
        .limit(FEED_LIMIT),
      admin
        .from("reservation_tickets")
        .select(`id, status, reserved_at, party_size, created_at, ${CONSUMER_JOIN}`)
        .eq("project_id", projectId)
        .in("status", FEATURED_RESERVATION_STATUSES)
        .order("reserved_at", { ascending: false, nullsFirst: false })
        .limit(FEED_LIMIT),
      admin
        .from("ticket_reviews")
        .select("ticket_id")
        .eq("project_id", projectId),
    ]);

  // Best-effort per feed, matching consumer-web-get-place: one failing rail
  // must not 500 the whole tab — the others still render, the failed one
  // falls back to its empty state.
  const reviewedTicketIds = new Set(
    reviewedRes.error
      ? []
      : ((reviewedRes.data ?? []) as Array<{ ticket_id: string | null }>)
        .map((r) => r.ticket_id)
        .filter((id): id is string => typeof id === "string"),
  );

  const rows = <T>(res: { error: unknown; data: unknown }): T[] =>
    res.error ? [] : ((res.data ?? []) as T[]);

  return json({
    ok: true,
    stories: mapStoryTickets(
      rows<Parameters<typeof mapStoryTickets>[0][number]>(storiesRes),
    ),
    visits: mapVisitTickets(
      rows<Parameters<typeof mapVisitTickets>[0][number]>(visitsRes),
      reviewedTicketIds,
    ),
    orders: [],
    reservations: mapReservationTickets(
      rows<Parameters<typeof mapReservationTickets>[0][number]>(
        reservationsRes,
      ),
    ),
  });
});
