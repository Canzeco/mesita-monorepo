// Supabase Edge Function — consumer-web-release-payment
//
// MESITA-3458: the guest came back from Stripe Checkout with
// `checkout=cancel`. The open session is expired on the place's connected
// account and the credit hold released (wallet_release_payment, status
// `expired` so a cancel never counts toward the three-failed lock), so the
// next start opens a new Checkout instead of answering in_progress with
// the old one, and the credit is spendable again. A session Stripe had
// already paid is settled, never released.
//
// MESITA-3545: a bill the guest was paying outside (waiting for the
// waiter's Received) cancels the same way, with no Stripe: the hold is
// released (status expired) and the waiter's charge is unbound and
// unclaimed, so the same or another guest can pay it while its 10 minutes
// last. A new tap after a cancel carries a NEW request_id (the cancelled
// one replays to the closed row).
//
// Body: { payment_id: uuid }
// Response: { ok: true, outcome: released | paid | unchanged | pending,
//             payment_id, place: { id, name }, status, amount_cents,
//             credit_cents, card_cents, tip_cents, cashback_cents, currency,
//             paid_at, proof_seen_at, proof, ticket, test_mode }
//   400 (a malformed call) · 401 sign_in · 404 gone (not the guest's) ·
//   500 with request_id

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { paymentsStripeKey, stripeClient } from "../_shared/boost.ts";
import { errorMessage } from "../_shared/errors.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentView, readPayment } from "../_shared/pay.ts";
import { releaseCardPayment, type ReleaseOutcome } from "../_shared/pay-card.ts";
import { releasePayment } from "../_shared/settle-payment.ts";
import { supabaseChargeStore } from "../_shared/charge.ts";

serveJson("consumer-web-release-payment", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return json({ ok: false, code: "sign_in", error: "Sign in to see your payment" }, 401);

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const paymentId = bodyRes.body.payment_id;
  if (!isUuid(paymentId)) return json({ ok: false, error: "payment_id must be a uuid" }, 400);

  const requestId = crypto.randomUUID();
  const admin = adminClient(envRes.env);
  try {
    const res = await readPayment(admin, authRes.user.id, paymentId);
    if (!res.ok) throw new Error(res.error);
    if (!res.row) return json({ ok: false, code: "gone", error: "That payment isn't here" }, 404);

    let outcome: ReleaseOutcome = "unchanged";
    if ((res.row.status === "open" || res.row.status === "opening") && (res.row.outside_cents ?? 0) > 0) {
      // Paying outside: nothing on Stripe; release, then free the charge.
      const rel = await admin.rpc("wallet_release_payment", { p_payment_id: res.row.id, p_status: "expired", p_error: "cancelled" });
      if (rel.error) throw new Error(`wallet_release_payment: ${rel.error.message}`);
      const released = (rel.data as { outcome?: string } | null)?.outcome === "released";
      // Only a bill this call released frees the charge (never one Received just paid).
      if (released) await supabaseChargeStore(admin).unbind(res.row.id, authRes.user.id);
      outcome = released ? "released" : "unchanged";
      console.log("[consumer-web-release-payment]", JSON.stringify({ payment_id: res.row.id, outcome, unbound: released, path: "outside" }));
    } else if (res.row.status === "open" || res.row.status === "opening") {
      const key = paymentsStripeKey();
      if (key) {
        outcome = await releaseCardPayment(admin, stripeClient(key), res.row, Date.now());
      } else if (!res.row.stripe_checkout_session_id) {
        // No Stripe here and no session: nothing can take money for it.
        await releasePayment(admin, res.row.id, "expired", "cancelled");
        outcome = "released";
      } else {
        throw new Error("no_stripe_key");
      }
    }

    const again = await readPayment(admin, authRes.user.id, paymentId);
    if (!again.ok) throw new Error(again.error);
    if (!again.row) return json({ ok: false, code: "gone", error: "That payment isn't here" }, 404);
    console.log("[consumer-web-release-payment]", JSON.stringify({ payment_id: paymentId, outcome, status: again.row.status }));
    return json({ ok: true, outcome, ...paymentView(again.row, again.placeName), ticket: again.row.ticket });
  } catch (err) {
    console.error("[consumer-web-release-payment]", JSON.stringify({ request_id: requestId, payment_id: paymentId, error: errorMessage(err) }));
    return json({ ok: false, error: "Couldn't cancel the payment. Try again.", request_id: requestId }, 500);
  }
});
