// Supabase Edge Function — visit-web-open-bill
//
// MESITA-4823 (waiter-led pay): the waiter scanned the guest's QR or
// starts over a bill that ended. Answers the bill
// session the waiter types into; the QR may rotate after that.
//
// Body: { place_id, staff_token, token | again_bill_id }
// Response: { ok: true, bill_id, outcome: opened | reused }
//   400 bad_request · 403 staff_code_needed · 404 code_gone ·
//   409 too_many | not_over

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { MONEY_CURRENCY } from "../_shared/money.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { callTabRpc } from "../_shared/tab.ts";
import { billRefusal, billStaff, hashPayCode, readOpenBy } from "../_shared/pay-bill.ts";

serveJson("visit-web-open-bill", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const by = readOpenBy(body);
  if (!by) return json({ ok: false, code: "bad_request", error: "That is not a guest's Mesita QR" }, 400);

  try {
    const staff = await billStaff(admin, env.serviceKey, body, Date.now());
    if (!staff) return json({ ok: false, code: "staff_code_needed", error: "Type the waiter code" }, 403);
    const placeRes = await readVoucherPlace(admin, staff.placeId);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const place = placeRes.place;
    if (!place || place.state !== "active") {
      return json({ ok: false, code: "gone", error: "This place can't take payments" }, 404);
    }
    const r = await callTabRpc(admin, "pay_bill_open", {
      p_code_hash: by.kind === "token" ? await hashPayCode(by.token) : null,
      p_again_bill_id: by.kind === "again" ? by.billId : null,
      p_place_id: staff.placeId,
      p_currency: String(place.currency ?? MONEY_CURRENCY).toLowerCase(),
      p_livemode: paymentsLivemode(),
      p_key_hash: staff.keyHash,
    });
    console.log("[visit-web-open-bill]", JSON.stringify({ place_id: staff.placeId, by: by.kind, outcome: r.ok === true ? r.outcome : r.code }));
    if (r.ok !== true) {
      const refusal = billRefusal(r);
      return json(refusal.body, refusal.status);
    }
    return json({ ok: true, bill_id: r.bill_id, outcome: r.outcome });
  } catch (err) {
    return failWithRequestId("visit-web-open-bill", "Couldn't open the bill. Try again.", err);
  }
});
