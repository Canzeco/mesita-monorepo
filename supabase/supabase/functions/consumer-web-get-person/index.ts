// Supabase Edge Function — consumer-web-get-person
//
// Social's person card (MESITA-2609, Pato: "a list of notifications of exactly
// that user … just all the historic feed scrollable"; its own name since
// MESITA-3042, it was consumer-web-list-activity's "history" scope). The
// member behind one feed event, named by a like's rule
// (place_activity_visible), and every one of their events, saved and viewed,
// newest first, with the place cards (place_activity_history_by).
//
// Body: { place_id, kind, at, first? }   (the feed event that names the member)
//   → { person, items: [{ placeId, kind, at, place? }] }
// Body: { fill: [place ids] }            (the next page's cards)
//   → { places: [card] }
//
// Paged like Home (MESITA-3212, Pato: "use loading pagination too when loading
// profiles"): with `first`, every event comes back but only the first `first`
// places of each verb carry a card, and the card asks for the rest by id as
// its grid nears them. A place that fill does not return is unlisted, and the
// card drops it. Without `first`, every event carries its card and unlisted
// places are dropped here, so a browser open across a deploy keeps working.
//
// The event names the member because no member id reaches the client
// (MESITA-2460). A deleted member returns person null and no items; everyone
// else is named by first name (MESITA-2612). Handles leave masked unless the
// viewer shows their own (MESITA-2594, seesHandles).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { anonClient } from "../_shared/auth.ts";
import {
  type ActivityRow,
  feedEvents,
  isActivityKind,
  isMesitaPlaceId,
  toPerson,
} from "../_shared/place-activity.ts";
import { readCards, viewerSeesHandles } from "../_shared/place-activity-read.ts";

const HISTORY_ROWS = 200;
/** The most cards one read returns when it is paged. */
const PAGE_MAX = 24;

type Body = {
  place_id?: string;
  kind?: string;
  at?: string;
  first?: number;
  fill?: unknown;
};

/** The first `first` distinct places of each verb, newest first. */
function firstPagePlaceIds(
  events: { placeId: string; kind: string }[],
  first: number,
): string[] {
  const byKind = new Map<string, Set<string>>();
  for (const e of events) {
    const seen = byKind.get(e.kind) ?? new Set<string>();
    if (seen.size < first) seen.add(e.placeId);
    byKind.set(e.kind, seen);
  }
  return [...new Set([...byKind.values()].flatMap((s) => [...s]))];
}

serveJson("consumer-web-get-person", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;
  const viewerId = user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  // A later page: only place cards, which the browse view already shows to
  // anyone, so it needs no event and reads no member.
  if (body.fill !== undefined) {
    if (!Array.isArray(body.fill) || !body.fill.every(isMesitaPlaceId)) {
      return json({ ok: false, error: "fill must be Mesita place ids" }, 400);
    }
    if (body.fill.length > PAGE_MAX) {
      return json({ ok: false, error: `fill takes at most ${PAGE_MAX} ids` }, 400);
    }
    const filled = await readCards(anonClient(env), body.fill as string[]);
    if (!filled.ok) return json({ ok: false, error: filled.error }, 500);
    return json({ ok: true, places: [...filled.cards.values()] });
  }

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

  const anon = anonClient(env);
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
  const first = Number.isInteger(body.first)
    ? Math.min(Math.max(body.first as number, 1), PAGE_MAX)
    : null;
  const cardsRes = await readCards(
    anon,
    first != null
      ? firstPagePlaceIds(events, first)
      : [...new Set(events.map((e) => e.placeId))],
  );
  if (!cardsRes.ok) return json({ ok: false, error: cardsRes.error }, 500);
  if (first != null) {
    const paged = events.map((e) => {
      const place = cardsRes.cards.get(e.placeId);
      return { placeId: e.placeId, kind: e.kind, at: e.at, ...(place ? { place } : {}) };
    });
    return json({ ok: true, person, items: paged });
  }
  const items = events.flatMap((e) => {
    const place = cardsRes.cards.get(e.placeId);
    return place ? [{ placeId: e.placeId, kind: e.kind, at: e.at, place }] : [];
  });
  return json({ ok: true, person, items });
});
