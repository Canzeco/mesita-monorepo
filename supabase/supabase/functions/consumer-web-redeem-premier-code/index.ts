// Supabase Edge Function — consumer-web-redeem-premier-code
//
// MESITA-3167: a signed-in guest redeems a Mesita Premier code on a place
// (the place screen's Premier tab, "Have a code?"). A code is 100%: it adds
// its Refill days (2X or 5X) through premier_redeem_code; nothing is
// charged. 10 tries per user per hour, shared with the Business door.
//
// Body:     { place_id: uuid, code: string }   ("7KQ2-ABCD", any case, dash optional)
// Response: { ok: true, tier: 1|2, days, ends_at, ends_at_2x, ends_at_5x, paused: { tier, until } | null }
// Refusal:  200 { ok: false, code, error, retry_after? } — code_unknown · code_expired ·
//           code_exhausted · code_used_here · paid_higher · cap_reached · rate_limited ·
//           not_found · archived · unlisted. 503 codes_off (PREMIER_CODE_PEPPER unset).
//
// The flow is `_shared/premier-code.ts` `redeemPremierCode`, shared with
// business-web-redeem-premier-code.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { redeemPremierCode } from "../_shared/premier-code.ts";

serveJson("consumer-web-redeem-premier-code", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, code } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  return await redeemPremierCode(
    adminClient(envRes.env),
    { rawCode: code, placeId, userId: authRes.user.id },
    "consumer-web-redeem-premier-code",
  );
});
