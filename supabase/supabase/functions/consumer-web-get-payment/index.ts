// Supabase Edge Function — consumer-web-get-payment
//
// MESITA-3304 (W2a): one of the signed-in guest's payments, so
// /pay?payment=<id> shows its proof again after a reload or from the
// Wallet's history, and the Pay page can see when staff marked it seen.
// A refunded payment still answers and reads Refunded.
//
// MESITA-3305 (W2b): a payment with a card part is settled on this read
// when it is still open: the guest comes back from Checkout to
// /pay?payment=<id>, the session is read on the place's connected account
// and, when Stripe says paid, the hold becomes the spend (the same RPC the
// receiver and the cron call). An open one answers status `open` with the
// Checkout url to resume and its expiry; an expired or failed one answers
// its status with no proof.
//
// Body: { payment_id: uuid }
// MESITA-3539: the proof also answers the ticket the guest typed, how much
// was refunded (card + tip, wallet_payments.refunded_cents) and the place's
// marks (Premier tier, Mesita Pay) beside its name.
//
// Response: { ok: true, payment_id, place: { id, name, marks?: { tier, mesita_pay } },
//             status, amount_cents, credit_cents, card_cents, tip_cents,
//             cashback_cents, currency, paid_at | null, proof_seen_at,
//             proof: { token, url } | null, ticket | null, refunded_cents,
//             url?: string | null, expires_at?: string | null, test_mode }
// MESITA-3545: also outside_cents and expires_at (a bill being paid to the
// waiter waits for Received until then), and cashback_available_at, when
// the cashback entry lands Available (the proof reads "+$6MX back · ready in
// 1 hour"), null with no cashback.
//
//   401 sign_in · 404 gone (not theirs)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { paymentsStripeKey, stripeClient } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentView, readPayment, readPlaceMarks } from "../_shared/pay.ts";
import { settlePayment } from "../_shared/settle-payment.ts";

/** How long one read waits on Stripe for the session. */
const SETTLE_BUDGET_MS = 3000;

serveJson("consumer-web-get-payment", async (req) => {
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

  const admin = adminClient(envRes.env);
  let res = await readPayment(admin, authRes.user.id, paymentId);
  if (!res.ok) return json({ ok: false, error: res.error }, 500);
  if (!res.row) return json({ ok: false, code: "gone", error: "That payment isn't here" }, 404);

  // Still open with a card part: ask Stripe now, under a budget.
  let url: string | null | undefined;
  if (res.row.status === "open" || res.row.status === "opening") {
    const key = paymentsStripeKey();
    if (key && res.row.stripe_checkout_session_id && res.row.stripe_account_id) {
      const stripe = stripeClient(key);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SETTLE_BUDGET_MS);
      try {
        const outcome = await settlePayment(admin, stripe, {
          id: res.row.id,
          stripe_checkout_session_id: res.row.stripe_checkout_session_id,
          stripe_account_id: res.row.stripe_account_id,
          created_at: res.row.created_at,
          expires_at: res.row.expires_at,
        }, Date.now(), { signal: controller.signal });
        if (outcome !== "pending") {
          const again = await readPayment(admin, authRes.user.id, paymentId);
          if (again.ok && again.row) res = again;
        } else {
          // Still open: the url to resume it, read on the connected account.
          try {
            const s = await stripe("GET", `checkout/sessions/${encodeURIComponent(res.row.stripe_checkout_session_id)}`, undefined, {
              stripeAccount: res.row.stripe_account_id,
              signal: controller.signal,
            });
            url = s.status === "open" && typeof s.url === "string" ? s.url : null;
          } catch {
            url = null;
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("[consumer-web-get-payment] settle", JSON.stringify({ payment_id: paymentId, error: String(err) }));
      } finally {
        clearTimeout(timer);
      }
    }
  }
  if (!res.ok || !res.row) return json({ ok: false, code: "gone", error: "That payment isn't here" }, 404);
  const marks = await readPlaceMarks(admin, res.row.place_id, res.placeTier ?? null);
  const view = paymentView(res.row, res.placeName, marks);
  let cashbackAvailableAt: string | null = null;
  if (res.row.cashback_cents > 0) {
    const cb = await admin.from("wallet_entries").select("available_at").eq("payment_id", res.row.id).eq("kind", "cashback").limit(1).maybeSingle();
    if (cb.error) console.error("[consumer-web-get-payment] cashback_read", JSON.stringify({ payment_id: paymentId, error: cb.error.message }));
    cashbackAvailableAt = (cb.data as { available_at: string } | null)?.available_at ?? null;
  }
  return json({ ok: true, ...view, cashback_available_at: cashbackAvailableAt, ...(view.status === "open" || view.status === "opening" ? { url: url ?? null, expires_at: res.row.expires_at ?? null } : {}) });
});
