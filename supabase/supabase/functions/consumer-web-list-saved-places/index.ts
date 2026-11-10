// Supabase Edge Function — consumer-web-list-saved-places
//
// The guest's saves, newest first (Home's Saved row): every id (the browser
// cache adopts them) and the cards of the ones still listed. Its own name
// since MESITA-3042 (it was consumer-web-list-activity's "saved" scope).
//
// Body: {}
//   → { ids, places }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { anonClient } from "../_shared/auth.ts";
import { readCards } from "../_shared/place-activity-read.ts";

serveJson("consumer-web-list-saved-places", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;
  const viewerId = user.id;

  const { data, error } = await admin
    .from("place_activity")
    .select("place_id")
    .eq("consumer_id", viewerId)
    .eq("kind", "saved")
    .order("created_at", { ascending: false });
  if (error) return json({ ok: false, error: `saved: ${error.message}` }, 500);
  const ids = ((data ?? []) as { place_id: string }[]).map((r) => r.place_id);
  const cardsRes = await readCards(anonClient(env), ids);
  if (!cardsRes.ok) return json({ ok: false, error: cardsRes.error }, 500);
  const places = ids.flatMap((id) => {
    const c = cardsRes.cards.get(id);
    return c ? [c] : [];
  });
  return json({ ok: true, ids, places });
});
