// Supabase Edge Function — visit-web-close-visit
//
// MESITA-3240: visit.mesita.ai, Received (Pato: "you click received and you input
// the actual amount and the digits"). place_visit_close checks the place code,
// limits wrong tries, works out the discount, logs the visit and spends the
// guest's code. No sign-in: the place code proves it is the place. A record of the
// place's own till for now: no money moves through Mesita.
//
// MESITA-3270: this is Received, the last stamp of the shared visit. It logs only the
// bill the guest confirmed, and Story only if staff saw it.
//
// Body: { place_id: uuid, code: "<32 hex>", place_code: "123456", bill_cents: integer,
//         reward_kinds: [welcome_visit|returning_visit|instagram_story|vip_class],
//         request_id: uuid }
// Response: { ok: true, replayed, bill_cents, discount_cents, total_cents, currency }
//         | { ok: false, code, error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { hashPlaceCode, hashVisitCode, isBillCents, readPlaceCode, readRewardKinds, readVisitCode, VISIT_REFUSED } from "../_shared/place-visits.ts";

serveJson("visit-web-close-visit", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, bill_cents: billCents, request_id: requestId } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (!isUuid(requestId)) return json({ ok: false, error: "request_id must be a uuid" }, 400);
  const code = readVisitCode(bodyRes.body.code);
  if (!code) return json({ ok: false, code: "bad_code", error: VISIT_REFUSED.bad_code }, 409);
  const placeCode = readPlaceCode(bodyRes.body.place_code);
  if (!placeCode) return json({ ok: false, code: "bad_place_code", error: "The place code is six digits." }, 400);
  if (!isBillCents(billCents)) return json({ ok: false, code: "bad_bill", error: "Enter the amount." }, 400);
  const rewardKinds = readRewardKinds(bodyRes.body.reward_kinds);
  if (!rewardKinds) return json({ ok: false, code: "reward_off", error: VISIT_REFUSED.reward_off }, 400);

  const admin = adminClient(envRes.env);
  const { data, error } = await admin.rpc("place_visit_close", {
    p_place_id: placeId,
    p_code_hash: await hashVisitCode(placeId, code),
    p_place_code_hash: await hashPlaceCode(placeId, placeCode),
    p_bill_cents: billCents,
    p_reward_kinds: rewardKinds,
    p_request_id: requestId,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data?.outcome !== "ok") {
    const outcome = String(data?.outcome);
    return json({ ok: false, code: outcome, error: VISIT_REFUSED[outcome] ?? "Couldn't close the visit." }, 409);
  }
  const visit = data.visit;
  console.log(JSON.stringify({ fn: "visit-web-close-visit", place_id: placeId, visit_id: visit?.id, replayed: data.replayed }));
  return json({
    ok: true,
    replayed: data.replayed,
    bill_cents: visit.bill_cents,
    discount_cents: visit.discount_cents,
    total_cents: visit.total_cents,
    currency: visit.currency,
  });
});
