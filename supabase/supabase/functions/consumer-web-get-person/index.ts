// Supabase Edge Function — consumer-web-get-person
//
// Social's person card (MESITA-2609, Pato: "a list of notifications of exactly
// that user … just all the historic feed scrollable"; its own name since
// MESITA-3042, it was consumer-web-list-activity's "history" scope). The
// member behind one feed event, named by a like's rule
// (place_activity_visible), and every one of their events, saved and viewed,
// newest first, with the place cards (place_activity_history_by).
//
// Body: { place_id, kind, at }   (the feed event that names the member)
//   → { person, items: [{ placeId, kind, at, place }] }
//
// The event names the member because no member id reaches the client
// (MESITA-2460). A deleted member returns person null and no items; everyone
// else is named by first name (MESITA-2612). Handles leave masked unless the
// viewer shows their own (MESITA-2594, seesHandles).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, anonClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  type ActivityRow,
  feedEvents,
  isActivityKind,
  isMesitaPlaceId,
  toPerson,
} from "../_shared/place-activity.ts";
import { readCards, viewerSeesHandles } from "../_shared/place-activity-read.ts";

const HISTORY_ROWS = 200;

type Body = { place_id?: string; kind?: string; at?: string };

serveJson("consumer-web-get-person", async (req) => {
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

  const admin = adminClient(envRes.env);
  const anon = anonClient(envRes.env);
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
});
