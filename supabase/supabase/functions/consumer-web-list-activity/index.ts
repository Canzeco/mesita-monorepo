// Supabase Edge Function — consumer-web-list-activity
//
// Home › Social's feed (MESITA-2442, MESITA-2532, Pato: "is juse one person
// one place events. list all the fucking events … uner you radious or near
// you, just enough to odn't kill"). Everyone's events, never collapsed, newest
// first, only places inside a fixed 15 km circle (`NO_SCREEN_RADIUS_KM`; the
// operator's `map.radiusKm` retired in MESITA-3086) around
// the guest's point (no point, no circle).
//
// ONE PAGE AT A TIME (MESITA-3220, Pato: "use pagination loading here in
// social"): it walks back from `before` SCAN_ROWS events at a time until it
// holds PAGE_ITEMS near the guest, or has walked MAX_SCANS. `next` is where the
// following page starts, null at the end of the feed. A page can come back
// short, or empty, with a `next` when the guest's circle is sparse. The cursor
// is a time, never an offset: new events land on top while the guest scrolls.
//
// The other Social reads have their own names since MESITA-3042: one person's
// events (consumer-web-get-person), a place's likes line
// (consumer-web-list-place-likes) and the guest's saves
// (consumer-web-list-saved-places).
//
// ONE PLACE (MESITA-3417, Pato: "social is just the notifications for one
// given place"): with `place_id`, the feed is that place's events alone, the
// place screen's Social tab, and the 15 km circle does not apply (the guest
// is already looking at the place). Who is named is unchanged.
//
// ANONYMOUS (MESITA-4246): no session, or the project key, reads one page
// of the same feed with every person reduced to a first name and Class
// (anonymousPerson) and every time to its day (coarseAt). A broken session
// is a 401, never the anonymous view.
//
// LATEST EVENTS (MESITA-4572, Pato: "display number of latest events"): the
// all-places feed shows at most `discovery_config.social.latestEvents` events
// (Admin › Discovery › Social discovery, default 100), then ends. The app
// sends `shown`, how many it already holds. A place's own feed is not capped.
//
// Body: { lat?, lng?, before?, place_id?, shown? }
//   → { viewer: "member"|"anonymous", items: [{ placeId, kind, at, person, distanceKm, place }], next }
//   distanceKm is the guest to the PLACE (it draws the circle and is the
//   row's "0.7 km away"). Nothing about where the EVENT happened leaves
//   this function (MESITA-2946: MESITA-2853's eventKm let two readings from
//   two spots triangulate a member).
//
// Who appears is the SQL's call (place_activity_visible: a verified Instagram,
// not deleted; views too since MESITA-3051; every profile is public since
// MESITA-4690), never this file's. The guest's own row counts like anyone's,
// third person (MESITA-3051). What this file decides is whether the VIEWER
// sees full handles (MESITA-2594, seesHandles): only with their own Instagram
// verified and their own handle shown (MESITA-4659); otherwise every other
// member's handle leaves masked ("per***").

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { consumerOrAnonymousRequest } from "../_shared/request.ts";
import { anonClient } from "../_shared/auth.ts";
import { haversineKm } from "../_shared/geo.ts";
import {
  type ActivityRow,
  anonymousFeedEvents,
  type FeedEvent,
  feedEvents,
  isMesitaPlaceId,
  nearYou,
} from "../_shared/place-activity.ts";
import { type Card, readCards, viewerSeesHandles } from "../_shared/place-activity-read.ts";
import { loadDiscoveryConfig, NO_SCREEN_RADIUS_KM } from "../_shared/discovery-config.ts";
import { finiteOrNull } from "../_shared/input.ts";

const PAGE_ITEMS = 20;
const SCAN_ROWS = 50;
const MAX_SCANS = 6;

type Body = { lat?: number; lng?: number; before?: string; place_id?: string; shown?: number };

serveJson("consumer-web-list-activity", async (req) => {
  const ctx = await consumerOrAnonymousRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;
  const viewer = user ? "member" : "anonymous";

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const before = body.before ?? null;
  if (before != null && (typeof before !== "string" || !Number.isFinite(Date.parse(before)))) {
    return json({ ok: false, error: "before must be a time" }, 400);
  }
  const placeId = body.place_id ?? null;
  if (placeId != null && !isMesitaPlaceId(placeId)) {
    return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  }
  const anon = anonClient(env);
  const lat = finiteOrNull(body.lat);
  const lng = finiteOrNull(body.lng);
  const hasPoint = lat != null && lng != null;
  const canSee = user ? await viewerSeesHandles(admin, user.id) : false;
  const shown = typeof body.shown === "number" && Number.isFinite(body.shown) ? Math.max(0, Math.floor(body.shown)) : 0;
  const latest = placeId ? Number.POSITIVE_INFINITY : (await loadDiscoveryConfig(admin)).social.latestEvents;
  const room = latest - shown;
  if (room <= 0) return json({ ok: true, viewer, items: [], next: null });
  const pageItems = Math.min(PAGE_ITEMS, room);

  const items: Array<FeedEvent & { distanceKm: number | null; place: Card }> = [];
  let cursor = before;
  for (let scan = 0; scan < MAX_SCANS; scan++) {
    const feedRes = await admin.rpc("place_activity_feed", {
      p_limit: SCAN_ROWS,
      ...(cursor ? { p_before: cursor } : {}),
      ...(placeId ? { p_place_id: placeId } : {}),
    });
    if (feedRes.error) return json({ ok: false, error: `feed: ${feedRes.error.message}` }, 500);
    const rows = (feedRes.data ?? []) as ActivityRow[];
    const events = user ? feedEvents(rows, user.id, canSee) : anonymousFeedEvents(rows);
    const cardsRes = await readCards(anon, [...new Set(events.map((e) => e.placeId))]);
    if (!cardsRes.ok) return json({ ok: false, error: cardsRes.error }, 500);
    for (const e of events) {
      const place = cardsRes.cards.get(e.placeId);
      if (!place) continue;
      const km = hasPoint
        ? haversineKm(lat, lng, finiteOrNull(place.lat), finiteOrNull(place.lng))
        : Number.POSITIVE_INFINITY;
      const distanceKm = Number.isFinite(km) ? km : null;
      if (!placeId && !nearYou(distanceKm, NO_SCREEN_RADIUS_KM, hasPoint)) continue;
      items.push({ ...e, distanceKm, place });
      if (items.length === pageItems) {
        // An anonymous visitor gets one page: the cursor is an exact time.
        // The latest-events cap ends the feed here (MESITA-4572).
        const capped = pageItems === room;
        return json({ ok: true, viewer, items, next: user && !capped ? e.at : null });
      }
    }
    // Fewer rows than asked for: the feed ends here.
    if (rows.length < SCAN_ROWS) return json({ ok: true, viewer, items, next: null });
    cursor = rows[rows.length - 1].created_at;
  }
  return json({ ok: true, viewer, items, next: user ? cursor : null });
});
