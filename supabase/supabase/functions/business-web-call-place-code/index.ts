// Supabase Edge Function — business-web-call-place-code
//
// MESITA-3127. "Call the place": a Twilio call to the place's listing phone
// says a new 6-digit code (it replaces any earlier one). The caller types it
// into business-web-check-place-code. 3 calls per place and 5 per guest a
// rolling day (place_take_verification_send). Refuses `claimed` while
// someone else holds the owner seat (MESITA-3155).
// Calls are OFF while we test (MESITA-3594; CALLS_LIVE in _shared/place-call-code.ts). With it false, no call goes out:
// the code would be TEST_CODE and the reply would say `test: true`.
//
// Body: { place_id: uuid }
// Response: { ok: true, outcome: "calling", masked_phone, minutes, test } | { ok: true, outcome: "already_owner" }
//         | { ok: false, code: "no_account" | "no_phone" | "claimed" | "too_many_calls" | "call_failed" | "invalid" | "not_found", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { ensureConsumer } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { isLiveManager, MANAGER_COLUMNS, managerRow, type ManagerRow } from "../_shared/place-access.ts";
import { maskPhone } from "../_shared/place-verification.ts";
import { CALLS_LIVE, CODE_MINUTES, dropCode, newCode, TEST_CODE, placeCodeCall, storeCode, toE164 } from "../_shared/place-call-code.ts";

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

  // Someone else holds the owner seat (MESITA-3155): no code, no call. The
  // claim modal shows their masked email and offers Report to Mesita.
  const { data: seats, error: seatErr } = await admin
    .from("place_managers")
    .select(MANAGER_COLUMNS)
    .eq("place_id", placeId)
    .eq("role", "owner")
    .is("revoked_at", null)
    .neq("consumer_id", user.id);
  if (seatErr) return json({ ok: false, error: seatErr.message }, 500);
  if (((seats ?? []) as ManagerRow[]).some((r) => isLiveManager(r))) {
    return json({ ok: false, code: "claimed", error: "Someone else already runs this place on Mesita. If that's wrong, report it to Mesita." }, 409);
  }

  // The daily call limit guards the place's phone; with calls off nothing
  // dials, so the test code never spends a slot (MESITA-3594).
  if (CALLS_LIVE) {
    const { data: slot, error: slotErr } = await admin.rpc("place_take_verification_send", {
      p_place_id: placeId,
      p_consumer_id: user.id,
      p_channel: "call",
    });
    if (slotErr) return json({ ok: false, error: slotErr.message }, 500);
    if (slot !== "ok") {
      return json({ ok: false, code: "too_many_calls", error: "No more calls to this place today. Try tomorrow, or ask Mesita to check by hand." }, 429);
    }
  }

  const code = CALLS_LIVE ? newCode() : TEST_CODE;
  const { error: codeErr } = await storeCode(admin, placeId, user.id, code);
  if (codeErr) return json({ ok: false, error: codeErr.message }, 500);

  if (!CALLS_LIVE) {
    console.log(JSON.stringify({ fn: "business-web-call-place-code", place_id: placeId, outcome: "test_code" }));
    return json({ ok: true, outcome: "calling", masked_phone: maskPhone(place.phone), minutes: CODE_MINUTES, test: true });
  }

  const call = await placeCodeCall(to, code);
  if (!call.ok) {
    console.error(JSON.stringify({ fn: "business-web-call-place-code", place_id: placeId, outcome: "call_failed", error: call.error }));
    await dropCode(admin, placeId, user.id);
    return json({ ok: false, code: "call_failed", error: "We couldn't call this place. Ask Mesita to check by hand." }, 502);
  }
  console.log(JSON.stringify({ fn: "business-web-call-place-code", place_id: placeId, outcome: "calling", call_sid: call.sid }));
  return json({ ok: true, outcome: "calling", masked_phone: maskPhone(place.phone), minutes: CODE_MINUTES, test: false });
});
