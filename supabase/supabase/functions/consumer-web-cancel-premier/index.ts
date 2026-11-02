// Supabase Edge Function — consumer-web-cancel-premier
//
// MESITA-3092: the payer stops renewing their place's Premier. The period
// already paid runs out; nothing renews it, and their saved card is
// detached. A Checkout of theirs still open is abandoned the same way. No
// verification: it is the payer's own subscription. Anyone else gets "not
// found".
//
// Body: { place_id: uuid }  (or { backing_id: uuid }, builds before
//       MESITA-3092, one release)
// Response: { ok: true }
//
// The flow is `_shared/premier-flow.ts` `cancelPremier` (MESITA-3103), shared
// with business-web-cancel-premier.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { cancelPremier } from "../_shared/premier-flow.ts";

serveJson("consumer-web-cancel-premier", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, backing_id: backingId } = bodyRes.body;
  if (!isUuid(placeId) && !isUuid(backingId)) {
    return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  }
  return await cancelPremier(envRes.env, authRes.user.id, { placeId, backingId });
});
