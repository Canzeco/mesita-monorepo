// Supabase Edge Function — consumer-web-track-place-share
//
// MESITA-3206: a signed-in guest shared a place or copied its link. One row per
// guest per place; a repeat only moves shared_at. Business Insights counts them.
//
// Body: { place_id: uuid }
// Response: { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("consumer-web-track-place-share", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const { error } = await adminClient(envRes.env).from("place_shares").upsert(
    { consumer_id: authRes.user.id, place_id: placeId, shared_at: new Date().toISOString() },
    { onConflict: "consumer_id,place_id" },
  );
  if (error) {
    // 23503: the place (or the guest's row) does not exist.
    return json({ ok: false, error: `place_shares: ${error.message}` }, error.code === "23503" ? 404 : 500);
  }
  return json({ ok: true });
});
