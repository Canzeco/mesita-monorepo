// Supabase Edge Function — visit-web-send-bill
//
// MESITA-4823 (waiter-led pay): the waiter sends the bill and the tip, or
// edits them until the guest accepts. `version` is the one the screen read.
//
// Body: { bill_id, place_id, staff_token, version, bill_cents, tip_cents }
// Response: { ok: true, outcome: sent | replayed, version }
//   400 bad_request | amount_required · 403 staff_code_needed | forbidden ·
//   404 gone · 409 stale (+version) | accepted | expired | guest_busy | too_many

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { callTabRpc } from "../_shared/tab.ts";
import { BILL_ANSWER_MIN, billRefusal, billStaff, readCents } from "../_shared/pay-bill.ts";

serveJson("visit-web-send-bill", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  if (!isUuid(body.bill_id) || !Number.isInteger(body.version)) {
    return json({ ok: false, code: "bad_request", error: "That is not a bill" }, 400);
  }
  const bill = readCents(body.bill_cents, 1);
  if (bill === null) return json({ ok: false, code: "amount_required", error: "Type the bill" }, 400);
  const tip = readCents(body.tip_cents, 0);
  if (tip === null) return json({ ok: false, code: "amount_required", error: "Type a tip like 30 or 30.50" }, 400);

  try {
    const staff = await billStaff(admin, env.serviceKey, body, Date.now());
    if (!staff) return json({ ok: false, code: "staff_code_needed", error: "Type the waiter code" }, 403);
    const r = await callTabRpc(admin, "pay_bill_send", {
      p_bill_id: body.bill_id,
      p_place_id: staff.placeId,
      p_version: body.version,
      p_bill_cents: bill,
      p_tip_cents: tip,
      p_key_hash: staff.keyHash,
      p_window_minutes: BILL_ANSWER_MIN,
      p_waiter_id: staff.waiterId,
      p_waiter_name: staff.waiterName,
    });
    console.log("[visit-web-send-bill]", JSON.stringify({ bill_id: body.bill_id, place_id: staff.placeId, outcome: r.ok === true ? r.outcome : r.code }));
    if (r.ok !== true) {
      const refusal = billRefusal(r);
      return json(refusal.body, refusal.status);
    }
    return json({ ok: true, outcome: r.outcome, version: r.version });
  } catch (err) {
    return failWithRequestId("visit-web-send-bill", "Couldn't send the bill. Try again.", err);
  }
});
