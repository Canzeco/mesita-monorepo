// Supabase Edge Function — business-web-create-place-visit
//
// MESITA-3202: Business › Visits, Log visit. place_visit_create decides the
// reward, computes the discount, logs the visit and spends the code together.
// A record of the place's own till: no money moves through Mesita.
//
// Body: { place_id: uuid, code: "123456", bill_cents: integer,
//         payment_method: cash|card|transfer|other,
//         reward_kinds: [welcome_visit|returning_visit|instagram_story|vip_class],
//         request_id: uuid }
// Response: { ok: true, replayed: boolean, visit }
//         | { ok: false, code: bad_code|reward_off|not_eligible, error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { hashVisitCode, isBillCents, isPaymentMethod, readRewardKinds, readVisitCode } from "../_shared/place-visits.ts";

const REFUSED: Record<string, string> = {
  bad_code: "That code isn't valid here anymore. Ask the guest for a new one.",
  reward_off: "This place doesn't offer one of those rewards right now.",
  not_eligible: "This guest can't use one of those rewards.",
};

serveJson("business-web-create-place-visit", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, bill_cents: billCents, payment_method: method, request_id: requestId } =
    bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (!isUuid(requestId)) return json({ ok: false, error: "request_id must be a uuid" }, 400);
  const code = readVisitCode(bodyRes.body.code);
  if (!code) return json({ ok: false, code: "bad_code", error: "The code is six digits" }, 400);
  if (!isBillCents(billCents)) return json({ ok: false, code: "bad_bill", error: "Enter the bill's amount" }, 400);
  if (!isPaymentMethod(method)) return json({ ok: false, code: "bad_method", error: "Choose how it was paid" }, 400);
  const rewardKinds = readRewardKinds(bodyRes.body.reward_kinds);
  if (!rewardKinds) return json({ ok: false, code: "reward_off", error: REFUSED.reward_off }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const { data, error } = await admin.rpc("place_visit_create", {
    p_place_id: placeId,
    p_code_hash: await hashVisitCode(placeId, code),
    p_bill_cents: billCents,
    p_payment_method: method,
    p_reward_kinds: rewardKinds,
    p_request_id: requestId,
    p_created_by: user.id,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data?.outcome !== "ok") {
    const outcome = String(data?.outcome);
    return json({ ok: false, code: outcome, reason: data?.reason ?? null, error: REFUSED[outcome] ?? "Couldn't log the visit" }, 409);
  }
  console.log(JSON.stringify({ fn: "business-web-create-place-visit", place_id: placeId, visit_id: data.visit?.id, replayed: data.replayed }));
  return json({ ok: true, replayed: data.replayed, visit: data.visit });
});
