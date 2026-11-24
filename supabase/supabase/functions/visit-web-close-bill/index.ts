// Supabase Edge Function — visit-web-close-bill
//
// MESITA-4823 (waiter-led pay): the waiter's Received on an accepted bill
// (the credits are spent, the cashback granted), or Cancel until then. Any
// phone signed in at the place may do either; a second tap moves nothing.
//
// Body: { bill_id, place_id, staff_token, action: received | cancel }
// Response: { ok: true, outcome: received | already | confirming | cancelled }
//   400 bad_request · 403 staff_code_needed | forbidden · 404 gone ·
//   409 not_accepted | expired | already_final | charging

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { callTabRpc } from "../_shared/tab.ts";
import { confirmAttempt, endAttempt } from "../_shared/guest-attempt.ts";
import { billRefusal, billStaff, readBill, readBillAttempt } from "../_shared/pay-bill.ts";

serveJson("visit-web-close-bill", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  if (!isUuid(body.bill_id) || (body.action !== "received" && body.action !== "cancel")) {
    return json({ ok: false, code: "bad_request", error: "That is not a bill" }, 400);
  }

  try {
    const staff = await billStaff(admin, env.serviceKey, body, Date.now());
    if (!staff) return json({ ok: false, code: "staff_code_needed", error: "Type the waiter code" }, 403);
    const bill = await readBill(admin, body.bill_id);
    if (!bill) return json({ ok: false, code: "gone", error: "This bill is gone" }, 404);
    if (bill.place_id !== staff.placeId) return json({ ok: false, code: "forbidden", error: "This bill is for another place" }, 403);
    const log = (outcome: unknown) =>
      console.log("[visit-web-close-bill]", JSON.stringify({ bill_id: bill.id, place_id: staff.placeId, action: body.action, outcome }));

    if (body.action === "received") {
      const attempt = await readBillAttempt(admin, bill);
      if (!attempt) return json({ ok: false, code: "not_accepted", error: "The guest has not accepted this bill yet" }, 409);
      // No card pays a bill (MESITA-4708): no Stripe here.
      const out = await confirmAttempt(admin, null, attempt, { placeId: staff.placeId, keyHash: staff.keyHash });
      log(out.ok ? out.outcome : out.code);
      if (!out.ok) {
        return json({ ok: false, code: out.code, error: out.code === "expired" ? "This bill expired. Send it again." : out.error }, out.status);
      }
      return json({ ok: true, outcome: out.outcome === "verified" ? "received" : out.outcome === "already_verified" ? "already" : "confirming" });
    }

    let r: Record<string, unknown> = await callTabRpc(admin, "pay_bill_cancel", { p_bill_id: bill.id, p_place_id: staff.placeId });
    if (r.code === "accepted" && typeof r.attempt_id === "string") {
      const out = await endAttempt(admin, null, r.attempt_id, "rejected", { placeId: staff.placeId, source: "visit-web-close-bill" });
      r = out.ok ? { ok: true } : { ok: false, code: out.code };
    }
    log(r.ok === true ? "cancelled" : r.code);
    if (r.ok !== true) {
      const refusal = billRefusal(r);
      return json(refusal.body, refusal.status);
    }
    return json({ ok: true, outcome: "cancelled" });
  } catch (err) {
    return failWithRequestId("visit-web-close-bill", "Couldn't reach Mesita. Tap again.", err);
  }
});
