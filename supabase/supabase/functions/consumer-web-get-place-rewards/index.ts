// Supabase Edge Function — consumer-web-get-place-rewards
//
// MESITA-3202: the place screen's Rewards tab. What this place offers and which
// rewards are this guest's. Signed out, it is the offers alone.
//
// Body: { place_id: uuid }
// Response: { ok: true, signed_in: boolean,
//             rewards: [{ kind, percent, cap_cents, eligible, reason }] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("consumer-web-get-place-rewards", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const { user } = await getOptionalAuthedUser(req, envRes.env);

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const admin = adminClient(envRes.env);
  const { data, error } = await admin.rpc("place_rewards_for_guest", {
    p_place_id: placeId,
    p_consumer_id: user?.id ?? null,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, signed_in: !!user, rewards: data ?? [] });
});
