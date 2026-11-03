// Supabase Edge Function — business-web-call-place-code
//
// MESITA-3127. "Call the place": a Twilio call to the place's listing phone
// says a new 6-digit code (it replaces any earlier one). The caller types it
// into business-web-check-place-code. 3 calls per place and 5 per guest a
// rolling day (place_take_verification_send). Never says who runs the place.
//
// Body: { place_id: uuid }
// Response: { ok: true, outcome: "calling", masked_phone, minutes } | { ok: true, outcome: "already_owner" }
//         | { ok: false, code: "no_account" | "no_phone" | "too_many_calls" | "call_failed" | "invalid" | "not_found", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { ensureConsumer, requireBusinessRequest } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { isLiveManager, managerRow } from "../_shared/place-access.ts";
import { maskPhone } from "../_shared/place-verification.ts";
import { CODE_MINUTES, dropCode, newCode, placeCodeCall, storeCode, toE164 } from "../_shared/place-call-code.ts";

serveJson("business-web-call-place-code", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, code: "invalid", error: "place_id must be a Mesita place id" }, 400);

  const consumer = await ensureConsumer(admin, user);
  if (!consumer.ok) return json({ ok: false, error: consumer.error, code: consumer.code ?? null }, consumer.status);
  if (!consumer.consumerId) {
    return json({ ok: false, code: "no_account", error: "Sign in again to claim a place" }, 400);
  }

  const { data: place, error: placeErr } = await admin
    .from("profiles")
    .select("id, state, phone")
    .eq("id", placeId)
    .maybeSingle();
  if (placeErr) return json({ ok: false, error: placeErr.message }, 500);
  if (!place || (place.state !== "active" && place.state !== "paused")) {
    return json({ ok: false, code: "not_found", error: "Place not found" }, 404);
  }
  const to = toE164(place.phone);
  if (!to) return json({ ok: false, code: "no_phone", error: "This place has no phone to call" }, 400);

  try {
    if (isLiveManager(await managerRow(admin, placeId, user.id))) return json({ ok: true, outcome: "already_owner" });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }

  const { data: slot, error: slotErr } = await admin.rpc("place_take_verification_send", {
    p_place_id: placeId,
    p_consumer_id: user.id,
    p_channel: "call",
  });
  if (slotErr) return json({ ok: false, error: slotErr.message }, 500);
  if (slot !== "ok") {
    return json({ ok: false, code: "too_many_calls", error: "No more calls to this place today. Try tomorrow, or ask Mesita to check by hand." }, 429);
  }

  const code = newCode();
  const { error: codeErr } = await storeCode(admin, placeId, user.id, code);
  if (codeErr) return json({ ok: false, error: codeErr.message }, 500);

  const call = await placeCodeCall(to, code);
  if (!call.ok) {
    console.error(JSON.stringify({ fn: "business-web-call-place-code", place_id: placeId, outcome: "call_failed", error: call.error }));
    await dropCode(admin, placeId, user.id);
    return json({ ok: false, code: "call_failed", error: "We couldn't call this place. Ask Mesita to check by hand." }, 502);
  }
  console.log(JSON.stringify({ fn: "business-web-call-place-code", place_id: placeId, outcome: "calling", call_sid: call.sid }));
  return json({ ok: true, outcome: "calling", masked_phone: maskPhone(place.phone), minutes: CODE_MINUTES });
});
