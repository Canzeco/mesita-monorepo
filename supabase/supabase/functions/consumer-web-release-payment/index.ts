// Supabase Edge Function — consumer-web-release-payment
//
// MESITA-3545: a bill the guest was paying outside (waiting for the
// waiter's Received) cancels with no Stripe: the credit hold is released
// (wallet_release_payment, status expired) and the waiter's charge is
// unbound and unclaimed, so the same or another guest can pay it while its
// 10 minutes last. A new tap after a cancel carries a NEW request_id (the
// cancelled one replays to the closed row).
//
// MESITA-4708: the card Checkout's cancel (MESITA-3458: expire the session,
// release the hold) is gone with the card part of a bill. Any other payment
// answers unchanged; the settle cron closes what Stripe still holds.
//
// Body: { payment_id: uuid }
// Response: { ok: true, outcome: released | unchanged,
//             payment_id, place: { id, name }, status, amount_cents,
//             credit_cents, card_cents, tip_cents, currency,
//             paid_at, proof_seen_at, proof, ticket, test_mode }
//   400 (a malformed call) · 401 sign_in · 404 gone (not the guest's) ·
//   500 with request_id

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentView, readPayment } from "../_shared/pay.ts";
import { supabaseChargeStore } from "../_shared/charge.ts";

serveJson("consumer-web-release-payment", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to see your payment" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const paymentId = bodyRes.body.payment_id;
  if (!isUuid(paymentId)) return json({ ok: false, error: "payment_id must be a uuid" }, 400);

  try {
    const res = await readPayment(admin, user.id, paymentId);
    if (!res.ok) throw new Error(res.error);
    if (!res.row) return json({ ok: false, code: "gone", error: "That payment isn't here" }, 404);

    let outcome: "released" | "unchanged" = "unchanged";
    if ((res.row.status === "open" || res.row.status === "opening") && (res.row.outside_cents ?? 0) > 0) {
      // Paying outside: nothing on Stripe; release, then free the charge.
      const rel = await admin.rpc("wallet_release_payment", { p_payment_id: res.row.id, p_status: "expired", p_error: "cancelled" });
      if (rel.error) throw new Error(`wallet_release_payment: ${rel.error.message}`);
      const released = (rel.data as { outcome?: string } | null)?.outcome === "released";
      // Only a bill this call released frees the charge (never one Received just paid).
      if (released) await supabaseChargeStore(admin).unbind(res.row.id, user.id);
      outcome = released ? "released" : "unchanged";
      console.log("[consumer-web-release-payment]", JSON.stringify({ payment_id: res.row.id, outcome, unbound: released, path: "outside" }));
    }

    const again = await readPayment(admin, user.id, paymentId);
    if (!again.ok) throw new Error(again.error);
    if (!again.row) return json({ ok: false, code: "gone", error: "That payment isn't here" }, 404);
    console.log("[consumer-web-release-payment]", JSON.stringify({ payment_id: paymentId, outcome, status: again.row.status }));
    return json({ ok: true, outcome, ...paymentView(again.row, again.placeName), ticket: again.row.ticket });
  } catch (err) {
    return failWithRequestId("consumer-web-release-payment", "Couldn't cancel the payment. Try again.", err, { payment_id: paymentId });
  }
});
