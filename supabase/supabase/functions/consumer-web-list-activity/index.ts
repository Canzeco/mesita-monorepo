// Supabase Edge Function — consumer-web-list-activity
//
// Social v1 (MESITA-2442): reads place_activity back, three ways.
//
// Body: { scope: "feed", lat?, lng? }
//   → { items: [{ placeId, kind, at, lead, people, others, distanceKm, place }] }
//   Home › Social: everyone visible, same place + same verb collapsed
//   ("Perdón and 4 others saved Contramar"), newest day first and, within a
//   day, nearer places first. At most FEED_ITEMS items.
// Body: { scope: "place", place_id }
//   → { line, people, total, me: { saved, went } }
//   The place profile's line under the title ("Perdón and 3 others saw this"),
//   up to five faces, and the guest's own saved / went for the action row.
// Body: { scope: "saved" }
//   → { ids, places }
//   The guest's saves, newest first: every id (the browser cache adopts them)
//   and the cards of the ones still listed (Home's Saved row).
//
// Who appears is the SQL's call (place_activity_visible: Instagram connected,
// Show my activity on, not deleted), never this file's. The guest's own row
// counts like anyone's and reads as "You".

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, anonClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { type PlaceCategoryRow, withFamilyKeysList } from "../_shared/place-family-keys.ts";
import { haversineKm } from "../_shared/geo.ts";
import {
  type ActivityRow,
  groupFeed,
  isMesitaPlaceId,
  orderFeed,
  socialLine,
  toPerson,
} from "../_shared/place-activity.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const FEED_ROWS = 200;
const FEED_ITEMS = 50;
const LINE_FACES = 5;

type Body = { scope?: string; place_id?: string; lat?: number; lng?: number };

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
    const { data, error } = await admin.rpc("place_activity_feed", { p_limit: FEED_ROWS });
    if (error) return json({ ok: false, error: `feed: ${error.message}` }, 500);
    const groups = groupFeed((data ?? []) as ActivityRow[], viewerId);
    const cardsRes = await readCards(anon, [...new Set(groups.map((g) => g.placeId))]);
    if (!cardsRes.ok) return json({ ok: false, error: cardsRes.error }, 500);
    const lat = finite(body.lat);
    const lng = finite(body.lng);
    const items = groups.flatMap((g) => {
      const place = cardsRes.cards.get(g.placeId);
      if (!place) return [];
      const km = lat != null && lng != null
        ? haversineKm(lat, lng, finite(place.lat), finite(place.lng))
        : Number.POSITIVE_INFINITY;
      return [{ ...g, distanceKm: Number.isFinite(km) ? km : null, place }];
    });
    return json({ ok: true, items: orderFeed(items, new Date()).slice(0, FEED_ITEMS) });
  }

  if (body.scope === "place") {
    const placeId = body.place_id;
    if (!isMesitaPlaceId(placeId)) {
      return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
    }
    const [peopleRes, mineRes] = await Promise.all([
      admin.rpc("place_activity_people", { p_place_id: placeId, p_limit: LINE_FACES }),
      admin
        .from("place_activity")
        .select("kind")
        .eq("consumer_id", viewerId)
        .eq("place_id", placeId),
    ]);
    if (peopleRes.error) return json({ ok: false, error: `people: ${peopleRes.error.message}` }, 500);
    if (mineRes.error) return json({ ok: false, error: `mine: ${mineRes.error.message}` }, 500);
    const rows = (peopleRes.data ?? []) as ActivityRow[];
    const people = rows.map((r) => toPerson(r, viewerId));
    const total = rows.length > 0 ? Number(rows[0].total ?? rows.length) : 0;
    const mine = new Set(((mineRes.data ?? []) as { kind: string }[]).map((r) => r.kind));
    return json({
      ok: true,
      line: socialLine(people[0] ?? null, total),
      people,
      total,
      me: { saved: mine.has("saved"), went: mine.has("went") },
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

  return json({ ok: false, error: "scope must be feed, place or saved" }, 400);
});
