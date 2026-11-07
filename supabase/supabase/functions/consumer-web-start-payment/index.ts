// Supabase Edge Function — consumer-web-start-payment
//
// MESITA-3304 (W2a): a signed-in guest pays a place from their credit there.
// One RPC (wallet_pay_credit) under the (guest, place) lock writes the paid
// payment and its spend entry and answers a proof token; the QR opens the
// proof on visit.mesita.ai. No Stripe in this wave: a guest whose credit is
// short reads insufficient; W2b turns that case into a card part.
//
// Body: { place_id: uuid, amount_cents: integer, request_id: uuid (one per
//         tap; a retry after a lost answer carries the same), ticket?: string }
// Response: { ok: true, payment_id, status, outcome: paid | already_paid,
//             amount_cents, credit_cents, currency, paid_at,
//             proof: { token, url }, test_mode }
//   400 (a malformed call) · 400 amount_required | above_cap (+cap_cents) ·
//   401 sign_in · 404 gone (no such active place) ·
//   409 insufficient (+spendable_cents) | taken (+payment_id) ·
//   500 with request_id (the payment may have gone through: retry the same
//   request_id and a replay answers already_paid)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { boostLivemode } from "../_shared/boost.ts";
import { MONEY_CURRENCY } from "../_shared/money.ts";
import { readPayBody, startPayment } from "../_shared/pay.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { readSettings } from "../_shared/payments.ts";
import { errorMessage } from "../_shared/errors.ts";

serveJson("consumer-web-start-payment", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return json({ ok: false, code: "sign_in", error: "Sign in to pay" }, 401);
  const userId = authRes.user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readPayBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error, ...parsed.detail }, parsed.status);
  const input = parsed.input;

  const admin = adminClient(envRes.env);
  const placeRes = await readVoucherPlace(admin, input.placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") {
    return json({ ok: false, code: "gone", error: "This place can't take payments" }, 404);
  }
  // The owner's Credits switch (MESITA-3396): off means no credit is spent
  // here, whatever the guest holds. Read before the lock, so a refusal costs
  // no money move; the balance itself is untouched.
  const settings = await readSettings(admin, input.placeId);
  if (settings.pay_credits === false) {
    return json({ ok: false, code: "credits_off", error: "This place isn't taking credit right now" }, 409);
  }
  // Places store "MXN"; the ledger "mxn" (the RPC lowercases too).
  const currency = String(place.currency ?? MONEY_CURRENCY).toLowerCase();
  const livemode = boostLivemode();

  try {
    const res = await startPayment(admin, { consumerId: userId, input, currency, livemode });
    if (!res.ok) {
      console.log("[consumer-web-start-payment]", JSON.stringify({ outcome: res.code ?? "refused", place_id: input.placeId, amount_cents: input.amountCents }));
      return json({ ok: false, code: res.code, error: res.error, ...res.detail }, res.status);
    }
    console.log("[consumer-web-start-payment]", JSON.stringify({
      outcome: res.payment.outcome,
      payment_id: res.payment.payment_id,
      place_id: input.placeId,
      amount_cents: input.amountCents,
    }));
    return json({ ok: true, ...res.payment });
  } catch (err) {
    // The RPC failed to run. Whether money moved is unknown here: the client
    // keeps this request_id, and a retry replays to already_paid if it did.
    console.error("[consumer-web-start-payment] rpc", JSON.stringify({
      consumer_id: userId,
      place_id: input.placeId,
      amount_cents: input.amountCents,
      request_id: input.requestId,
      error: errorMessage(err),
    }));
    return json({ ok: false, error: "Couldn't confirm the payment. Try again.", request_id: input.requestId }, 500);
  }
});
