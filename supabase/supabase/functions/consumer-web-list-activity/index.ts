// Supabase Edge Function — consumer-web-list-activity
//
// Social v1 (MESITA-2442): reads place_activity back, three ways.
//
// Body: { scope: "feed", lat?, lng? }
//   → { items: [{ placeId, kind, at, person, distanceKm, place }] }
//   Home › Social (MESITA-2532, Pato: "is juse one person one place events.
//   list all the fucking events … uner you radious or near you, just enough
//   to odn't kill"): every visible event is its own item, never collapsed,
//   newest first, only places inside the operator's Area circle
//   (`map.radiusKm`) around the guest's point (no point, no circle). It
//   reads the FEED_ROWS newest events and returns at most FEED_ITEMS.
// Body: { scope: "place", place_id }
//   → { line, people, total, me: { saved } }
//   The place profile's line under the title ("Perdón and 3 others liked
//   this", likes only since MESITA-2594), up to five faces, and the guest's
//   own saved for the action row.
// Body: { scope: "saved" }
//   → { ids, places }
//   The guest's saves, newest first: every id (the browser cache adopts them)
//   and the cards of the ones still listed (Home's Saved row).
// Body: { scope: "liked", place_id, kind, at }
//   → { places }
//   Social's person card (MESITA-2583, Pato: "just like the user and then the
//   places they liked and thats it. in one list. not when."): every place the
//   member behind that feed event liked, newest first, cards only. The event
//   names the member because no member id reaches the client (MESITA-2460);
//   an anonymous member's event returns no places (place_activity_liked_by).
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
const LIKED_PLACES = 60;

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
      return [{ ...e, distanceKm, place }];
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

  if (body.scope === "liked") {
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
    const { data, error } = await admin.rpc("place_activity_liked_by", {
      p_place_id: placeId,
      p_kind: body.kind,
      p_at: body.at,
      p_limit: LIKED_PLACES,
    });
    if (error) return json({ ok: false, error: `liked: ${error.message}` }, 500);
    const ids = ((data ?? []) as { place_id: string }[]).map((r) => r.place_id);
    const cardsRes = await readCards(anon, ids);
    if (!cardsRes.ok) return json({ ok: false, error: cardsRes.error }, 500);
    const places = ids.flatMap((id) => {
      const c = cardsRes.cards.get(id);
      return c ? [c] : [];
    });
    return json({ ok: true, places });
  }

  return json({ ok: false, error: "scope must be feed, place, saved or liked" }, 400);
});
