// Supabase Edge Function — consumer-web-answer-bill
//
// MESITA-4823 (waiter-led pay): the guest's answer to the waiter's bill.
//   accept    the guest's Pay (pay_bill_accept): holds the credits, and closes
//             the bill when the waiter already tapped Receive (MESITA-4889);
//             the version is the one on screen
//   decline   back to the waiter, who fixes it; `not_mine` ends it and kills
//             the QR that phone scanned
//   cancel    an accepted bill, until the waiter's Received
//
// Body: { bill_id, action: accept | decline | not_mine | cancel, version? }
// Response: { ok: true, outcome, attempt_id?, tab_id?, status? }
//   400 bad_request · 401 sign_in · 404 gone · 409 quote_changed (+version) |
//   expired | cancelled | declined | accepted | too_many_open | already_final |
//   charging

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { callTabRpc, hashTabToken, mintTabToken } from "../_shared/tab.ts";
import { paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";
import { endAttempt } from "../_shared/guest-attempt.ts";
import { BILL_PAY_MIN, billRefusal, readBill } from "../_shared/pay-bill.ts";

serveJson("consumer-web-answer-bill", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { bill_id: billId, action, version } = bodyRes.body;
  const versioned = action === "accept" || action === "decline";
  if (
    !isUuid(billId) || !["accept", "decline", "not_mine", "cancel"].includes(String(action)) ||
    (versioned && !Number.isInteger(version))
  ) {
    return json({ ok: false, code: "bad_request", error: "That is not an answer to a bill" }, 400);
  }

  try {
    let r: Record<string, unknown>;
    if (action === "cancel") {
      const bill = await readBill(admin, billId);
      if (!bill || bill.consumer_id !== user.id || !bill.attempt_id) r = { ok: false, code: "gone" };
      else {
        const k = paymentsStripeKey();
        const out = await endAttempt(admin, k ? stripeClient(k) : null, bill.attempt_id, "cancelled", { consumerId: user.id, source: "consumer-web-answer-bill" });
        if (!out.ok && out.code === "charging") {
          return json({ ok: false, code: "charging", error: "The waiter already confirmed this payment." }, 409);
        }
        r = out.ok ? { ok: true, outcome: "cancelled" } : { ok: false, code: out.code };
      }
    } else if (action === "accept") {
      r = await callTabRpc(admin, "pay_bill_accept", {
        p_bill_id: billId,
        p_consumer_id: user.id,
        p_version: version,
        // The attempt's own key: nobody scans it, so its plaintext is dropped.
        p_token_hash: await hashTabToken(mintTabToken()),
        p_window_minutes: BILL_PAY_MIN,
      });
    } else {
      r = await callTabRpc(admin, "pay_bill_decline", {
        p_bill_id: billId,
        p_consumer_id: user.id,
        p_version: versioned ? version : 0,
        p_not_mine: action === "not_mine",
      });
    }
    console.log("[consumer-web-answer-bill]", JSON.stringify({ action, bill_id: billId, outcome: r.ok === true ? r.outcome : r.code }));
    if (r.ok !== true) {
      const refusal = billRefusal(r);
      return json(refusal.body, refusal.status);
    }
    return json({ ok: true, outcome: r.outcome, attempt_id: r.attempt_id ?? null, tab_id: r.tab_id ?? null, status: r.status ?? null });
  } catch (err) {
    return failWithRequestId("consumer-web-answer-bill", "Couldn't send your answer. Try again.", err);
  }
});
