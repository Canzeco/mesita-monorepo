// Supabase Edge Function — consumer-web-list-activity
//
// Social v1 (MESITA-2442): reads place_activity back, three ways.
//
// Body: { scope: "feed", lat?, lng? }
//   → { items: [{ placeId, kind, at, person, distanceKm, eventKm, place }] }
//   Home › Social (MESITA-2532, Pato: "is juse one person one place events.
//   list all the fucking events … uner you radious or near you, just enough
//   to odn't kill"): every visible event is its own item, never collapsed,
//   newest first, only places inside the operator's Area circle
//   (`map.radiusKm`) around the guest's point (no point, no circle). It
//   reads the FEED_ROWS newest events and returns at most FEED_ITEMS.
//   distanceKm is the guest to the PLACE (it draws the circle); eventKm is
//   the guest to where the EVENT happened, the member's device fix when they
//   liked or viewed (MESITA-2853, "1.2 km away" on the row). The event's
//   point never leaves this function; null without either point.
// Body: { scope: "place", place_id }
//   → { line, people, total, me: { saved } }
//   The place profile's line under the title ("Perdón and 3 others liked
//   this", likes only since MESITA-2594), up to five faces, and the guest's
//   own saved for the action row.
// Body: { scope: "saved" }
//   → { ids, places }
//   The guest's saves, newest first: every id (the browser cache adopts them)
//   and the cards of the ones still listed (Home's Saved row).
// Body: { scope: "history", place_id, kind, at }
//   → { person, items: [{ placeId, kind, at, place }] }
//   Social's person card (MESITA-2609, Pato: "a list of notifications of
//   exactly that user … just all the historic feed scrollable"; it replaces
//   MESITA-2583's liked-only list): the member behind that feed event, named
//   by a like's rule (place_activity_visible), and every one of their events,
//   saved and viewed, newest first, with the place cards. The event names the
//   member because no member id reaches the client (MESITA-2460); a member who
//   is deleted returns person null and no items; everyone else is named by
//   first name (MESITA-2612)
//   (place_activity_history_by).
//
// Who appears is the SQL's call (place_activity_visible: a verified Instagram,
// Public profile, not deleted; a view is never named, MESITA-2594), never this
// file's. The guest's own row counts like anyone's and reads as "You".
// What this file decides is whether the VIEWER sees full handles (MESITA-2594,
// seesHandles): only with their own Instagram verified and their profile
// public; otherwise every other member's handle leaves masked ("per***").

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, anonClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { type PlaceCategoryRow, withFamilyKeysList } from "../_shared/place-family-keys.ts";
import { haversineKm } from "../_shared/geo.ts";
import {
  type ActivityRow,
  eventKm,
  feedEvents,
  isActivityKind,
  isMesitaPlaceId,
  nearYou,
  seesHandles,
  socialLine,
  toPerson,
} from "../_shared/place-activity.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { readSocialStanding } from "../_shared/consumer-doc.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const FEED_ROWS = 500;
const FEED_ITEMS = 50;
const LINE_FACES = 5;
const HISTORY_ROWS = 200;

type Body = {
  scope?: string;
  place_id?: string;
  kind?: string;
  at?: string;
  lat?: number;
  lng?: number;
};

type Card = Record<string, unknown> & { id: string; lat?: number | null; lng?: number | null };

/** Place cards for ids, through the browse view (RLS keeps unlisted places
 *  out), keyed by id. */
async function readCards(
  anon: SupabaseClient,
  ids: string[],
): Promise<{ ok: true; cards: Map<string, Card> } | { ok: false; error: string }> {
  if (ids.length === 0) return { ok: true, cards: new Map() };
  const { data, error } = await anon.from("profiles").select(PLACE_CARD_COLUMNS).in("id", ids);
  if (error) return { ok: false, error: `cards: ${error.message}` };
  const rows = withFamilyKeysList(
    (data ?? []) as unknown as Array<Card & PlaceCategoryRow>,
  ) as unknown as Card[];
  return { ok: true, cards: new Map(rows.map((r) => [r.id, r])) };
}

/** Whether this viewer sees other members' full handles (MESITA-2594). An
 *  unreadable row masks: the safe side is showing less. */
async function viewerSeesHandles(
  admin: SupabaseClient,
  viewerId: string,
): Promise<boolean> {
  const res = await readSocialStanding(admin, viewerId);
  if (!res.ok) {
    console.error("viewer_standing_failed", res.error);
    return false;
  }
  return seesHandles(res.row);
}

function finite(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const viewerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const admin = adminClient(envRes.env);
  const anon = anonClient(envRes.env);

  if (body.scope === "feed") {
    const [feedRes, cfg, canSee] = await Promise.all([
      admin.rpc("place_activity_feed", { p_limit: FEED_ROWS }),
      loadDiscoveryConfig(admin),
      viewerSeesHandles(admin, viewerId),
    ]);
    if (feedRes.error) return json({ ok: false, error: `feed: ${feedRes.error.message}` }, 500);
    const events = feedEvents((feedRes.data ?? []) as ActivityRow[], viewerId, canSee);
    const cardsRes = await readCards(anon, [...new Set(events.map((e) => e.placeId))]);
    if (!cardsRes.ok) return json({ ok: false, error: cardsRes.error }, 500);
    const lat = finite(body.lat);
    const lng = finite(body.lng);
    const hasPoint = lat != null && lng != null;
    const items = events.flatMap((e) => {
      const place = cardsRes.cards.get(e.placeId);
      if (!place) return [];
      const km = hasPoint
        ? haversineKm(lat, lng, finite(place.lat), finite(place.lng))
        : Number.POSITIVE_INFINITY;
      const distanceKm = Number.isFinite(km) ? km : null;
      if (!nearYou(distanceKm, cfg.map.radiusKm, hasPoint)) return [];
      // The point stays here; only its km leaves (MESITA-2853).
      const { point, ...item } = e;
      const eventDistance = hasPoint && point
        ? eventKm(haversineKm(lat, lng, point.lat, point.lng))
        : null;
      return [{ ...item, distanceKm, eventKm: eventDistance, place }];
    });
    return json({ ok: true, items: items.slice(0, FEED_ITEMS) });
  }

  if (body.scope === "place") {
    const placeId = body.place_id;
    if (!isMesitaPlaceId(placeId)) {
      return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
    }
    const [peopleRes, mineRes, canSee] = await Promise.all([
      admin.rpc("place_activity_people", { p_place_id: placeId, p_limit: LINE_FACES }),
      admin
        .from("place_activity")
        .select("kind")
        .eq("consumer_id", viewerId)
        .eq("place_id", placeId),
      viewerSeesHandles(admin, viewerId),
    ]);
    if (peopleRes.error) return json({ ok: false, error: `people: ${peopleRes.error.message}` }, 500);
    if (mineRes.error) return json({ ok: false, error: `mine: ${mineRes.error.message}` }, 500);
    const rows = (peopleRes.data ?? []) as ActivityRow[];
    const people = rows.map((r) => toPerson(r, viewerId, canSee));
    const total = rows.length > 0 ? Number(rows[0].total ?? rows.length) : 0;
    const mine = new Set(((mineRes.data ?? []) as { kind: string }[]).map((r) => r.kind));
    return json({
      ok: true,
      line: socialLine(people[0] ?? null, total),
      people,
      total,
      me: { saved: mine.has("saved") },
    });
  }

  if (body.scope === "saved") {
    const { data, error } = await admin
      .from("place_activity")
      .select("place_id")
      .eq("consumer_id", viewerId)
      .eq("kind", "saved")
      .order("created_at", { ascending: false });
    if (error) return json({ ok: false, error: `saved: ${error.message}` }, 500);
    const ids = ((data ?? []) as { place_id: string }[]).map((r) => r.place_id);
    const cardsRes = await readCards(anon, ids);
    if (!cardsRes.ok) return json({ ok: false, error: cardsRes.error }, 500);
    const places = ids.flatMap((id) => {
      const c = cardsRes.cards.get(id);
      return c ? [c] : [];
    });
    return json({ ok: true, ids, places });
  }

  if (body.scope === "history") {
    const placeId = body.place_id;
    if (!isMesitaPlaceId(placeId)) {
      return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
    }
    if (!isActivityKind(body.kind)) {
      return json({ ok: false, error: "kind must be saved or viewed" }, 400);
    }
    if (typeof body.at !== "string" || !Number.isFinite(Date.parse(body.at))) {
      return json({ ok: false, error: "at must be the event's time" }, 400);
    }
    const [histRes, canSee] = await Promise.all([
      admin.rpc("place_activity_history_by", {
        p_place_id: placeId,
        p_kind: body.kind,
        p_at: body.at,
        p_limit: HISTORY_ROWS,
      }),
      viewerSeesHandles(admin, viewerId),
    ]);
    if (histRes.error) return json({ ok: false, error: `history: ${histRes.error.message}` }, 500);
    const rows = (histRes.data ?? []) as ActivityRow[];
    if (rows.length === 0) return json({ ok: true, person: null, items: [] });
    // One member, every row the same: the person comes from the first.
    const person = toPerson(rows[0], viewerId, canSee);
    const events = feedEvents(rows, viewerId, canSee);
    const cardsRes = await readCards(anon, [...new Set(events.map((e) => e.placeId))]);
    if (!cardsRes.ok) return json({ ok: false, error: cardsRes.error }, 500);
    const items = events.flatMap((e) => {
      const place = cardsRes.cards.get(e.placeId);
      return place ? [{ placeId: e.placeId, kind: e.kind, at: e.at, place }] : [];
    });
    return json({ ok: true, person, items });
  }

  return json({ ok: false, error: "scope must be feed, place, saved or history" }, 400);
});
