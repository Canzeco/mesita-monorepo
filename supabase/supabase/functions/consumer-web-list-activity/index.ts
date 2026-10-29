// Supabase Edge Function — consumer-web-list-activity
//
// Home › Social's feed (MESITA-2442, MESITA-2532, Pato: "is juse one person
// one place events. list all the fucking events … uner you radious or near
// you, just enough to odn't kill"). Everyone's events, never collapsed, newest
// first, only places inside the operator's Area circle (`map.radiusKm`) around
// the guest's point (no point, no circle). It reads the FEED_ROWS newest
// events and returns at most FEED_ITEMS.
//
// The other Social reads have their own names since MESITA-3042: one person's
// events (consumer-web-get-person), a place's likes line
// (consumer-web-list-place-likes) and the guest's saves
// (consumer-web-list-saved-places).
//
// Body: { lat?, lng? }
//   → { items: [{ placeId, kind, at, person, distanceKm, place }] }
//   distanceKm is the guest to the PLACE (it draws the circle and is the
//   row's "0.7 km away"). Nothing about where the EVENT happened leaves
//   this function (MESITA-2946: MESITA-2853's eventKm let two readings from
//   two spots triangulate a member).
//
// Who appears is the SQL's call (place_activity_visible: a verified Instagram,
// Public profile, not deleted; views too since MESITA-3051), never this
// file's. The guest's own row counts like anyone's, third person (MESITA-3051).
// What this file decides is whether the VIEWER sees full handles (MESITA-2594,
// seesHandles): only with their own Instagram verified and their profile
// public; otherwise every other member's handle leaves masked ("per***").

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, anonClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { haversineKm } from "../_shared/geo.ts";
import { type ActivityRow, feedEvents, nearYou } from "../_shared/place-activity.ts";
import { readCards, viewerSeesHandles } from "../_shared/place-activity-read.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { finiteOrNull } from "../_shared/input.ts";

const FEED_ROWS = 500;
const FEED_ITEMS = 50;

type Body = { lat?: number; lng?: number };

serveJson("consumer-web-list-activity", async (req) => {
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

  const [feedRes, cfg, canSee] = await Promise.all([
    admin.rpc("place_activity_feed", { p_limit: FEED_ROWS }),
    loadDiscoveryConfig(admin),
    viewerSeesHandles(admin, viewerId),
  ]);
  if (feedRes.error) return json({ ok: false, error: `feed: ${feedRes.error.message}` }, 500);
  const events = feedEvents((feedRes.data ?? []) as ActivityRow[], viewerId, canSee);
  const cardsRes = await readCards(anon, [...new Set(events.map((e) => e.placeId))]);
  if (!cardsRes.ok) return json({ ok: false, error: cardsRes.error }, 500);
  const lat = finiteOrNull(body.lat);
  const lng = finiteOrNull(body.lng);
  const hasPoint = lat != null && lng != null;
  const items = events.flatMap((e) => {
    const place = cardsRes.cards.get(e.placeId);
    if (!place) return [];
    const km = hasPoint
      ? haversineKm(lat, lng, finiteOrNull(place.lat), finiteOrNull(place.lng))
      : Number.POSITIVE_INFINITY;
    const distanceKm = Number.isFinite(km) ? km : null;
    if (!nearYou(distanceKm, cfg.map.radiusKm, hasPoint)) return [];
    return [{ ...e, distanceKm, place }];
  });
  return json({ ok: true, items: items.slice(0, FEED_ITEMS) });
});
