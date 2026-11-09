// Supabase Edge Function — consumer-web-start-payment
//
// MESITA-3304 (W2a): a signed-in guest pays a place from their credit there.
// One RPC (wallet_pay_credit) under the (guest, place) lock writes the paid
// payment and its spend entry and answers a proof token; the QR opens the
// proof on visit.mesita.ai.
//
// MESITA-3305 (W2b): with a card part (`card_cents` > 0) the credit part is
// held and the card part plus an optional tip opens one Stripe Checkout on
// the place's connected account with Mesita's fee on the card part; the
// answer is the Checkout url. The hold becomes a spend when Stripe says
// paid (the receiver, the cron, or the guest's return to /pay?payment=).
//
// Body: { place_id: uuid, amount_cents: integer (credit + card),
//         card_cents?: integer, tip_cents?: integer, return_url?: string,
//         request_id: uuid (one per tap; a retry after a lost answer carries
//         the same), ticket?: string }
// Response (credit only): { ok: true, payment_id, status, outcome: paid |
//           already_paid, amount_cents, credit_cents, currency, paid_at,
//           proof: { token, url }, test_mode }
// Response (card part):   { ok: true, payment_id, status: "open", url,
//           expires_at, amount_cents, credit_cents, card_cents, tip_cents,
//           currency, test_mode }
//   400 (a malformed call) · 400 amount_required | above_cap (+cap_cents) ·
//   401 sign_in · 404 gone (no such active place) ·
//   409 insufficient (+spendable_cents) | taken (+payment_id) |
//       no_account | cards_off | currency_mismatch | below_minimum |
//       in_progress (+url, expires_at, payment_id) | locked (+retry_after_s) ·
//   502 checkout_failed ·
//   500 with request_id (the payment may have gone through: retry the same
//   request_id and a replay answers already_paid)
//
// MESITA-3306 (W2c): the waiter's charge. With `charge_code` (the 4 digits
// staff read out) the charge decides the amount and the ticket: `look: true`
// answers { ok: true, charge: { amount_cents, currency, ticket, expires_at } }
// and moves nothing; a start must carry that amount. One UPDATE claims the
// charge for this guest before any money moves, and it is given back when
// none did; the payment is bound to it so the staff screen reads Paid.
//   404 gone (no open charge under that code: one guest try) ·
//   409 locked (+retry_after_s, the sixth wrong code in 10 minutes) |
//       taken (+payment_id: this guest's paid payment, or null)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { paymentsLivemode, paymentsStripeKey, isAllowedReturnUrl, stripeClient } from "../_shared/boost.ts";
import { MONEY_CURRENCY } from "../_shared/money.ts";
import { readCardPart, readPayBody, startPayment } from "../_shared/pay.ts";
import { startCardPayment } from "../_shared/pay-card.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { readAccount, readSettings } from "../_shared/payments.ts";
import { errorMessage } from "../_shared/errors.ts";
import { isUuid } from "../_shared/place-id.ts";
import { type ChargeRow, type ChargeStore, chargeLook, findGuestCharge, readChargeCode, supabaseChargeStore } from "../_shared/charge.ts";
import { moneyText } from "../_shared/pay.ts";

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
  const admin = adminClient(envRes.env);

  // The waiter's charge (W2c): the code names the amount and the ticket.
  let charge: ChargeRow | null = null;
  let charges: ChargeStore | null = null;
  if (bodyRes.body.charge_code !== undefined && bodyRes.body.charge_code !== null) {
    if (!isUuid(bodyRes.body.place_id)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
    const code = readChargeCode(bodyRes.body.charge_code);
    if (!code) return json({ ok: false, error: "The waiter's code is four digits" }, 400);
    charges = supabaseChargeStore(admin);
    const found = await findGuestCharge(charges, { placeId: bodyRes.body.place_id, consumerId: userId, code, nowMs: Date.now() });
    if (!found.ok) {
      console.log("[consumer-web-start-payment]", JSON.stringify({ outcome: found.code ?? "refused", place_id: bodyRes.body.place_id, charge: true }));
      return json({ ok: false, code: found.code, error: found.error, ...found.detail }, found.status);
    }
    if (bodyRes.body.look === true) return json({ ok: true, charge: chargeLook(found.charge) });
    charge = found.charge;
  }

  const parsed = readPayBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error, ...parsed.detail }, parsed.status);
  const input = charge ? { ...parsed.input, ticket: charge.ticket } : parsed.input;
  if (charge && input.amountCents !== charge.amount_cents) {
    return json({ ok: false, error: `The waiter's charge is ${moneyText(charge.amount_cents, charge.currency)}` }, 400);
  }
  const card = readCardPart(bodyRes.body, input.amountCents);
  if (!card.ok) return json({ ok: false, code: card.code, error: card.error, ...card.detail }, card.status);
  if (card.cardCents > 0 && (!card.returnUrl || !isAllowedReturnUrl(card.returnUrl))) {
    return json({ ok: false, error: "return_url is not a Mesita address" }, 400);
  }

  const placeRes = await readVoucherPlace(admin, input.placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") {
    return json({ ok: false, code: "gone", error: "This place can't take payments" }, 404);
  }
  // A guest's credit is the place's debt (MESITA-3408): no switch refuses
  // it. The switches still shape a card part (Mesita Pay, Cashback).
  const settings = await readSettings(admin, input.placeId);
  // Places store "MXN"; the ledger "mxn" (the RPC lowercases too).
  const currency = String(place.currency ?? MONEY_CURRENCY).toLowerCase();
  const livemode = paymentsLivemode();

  // One guest per charge: claimed before any money moves.
  if (charge && charges && !(await charges.claim(charge.id, userId))) {
    return json({ ok: false, code: "taken", error: "Someone else is paying this charge", payment_id: null }, 409);
  }
  // A start that moved no money gives the charge back; one that did binds it.
  const release = async () => {
    if (charge && charges) await charges.unclaim(charge.id, userId);
  };
  const bind = async (paymentId: string, paidAt: string | null) => {
    if (charge && charges) await charges.bind(charge.id, paymentId, paidAt);
  };

  try {
    if (card.cardCents > 0) {
      const key = paymentsStripeKey();
      if (!key) return json({ ok: false, code: "no_account", error: "Payments are not available right now" }, 503);
      const account = await readAccount(admin, input.placeId);
      const res = await startCardPayment(admin, stripeClient(key), {
        consumerId: userId,
        email: authRes.user.email ?? null,
        input: { ...input, cardCents: card.cardCents, tipCents: card.tipCents, returnUrl: card.returnUrl as string },
        place: { id: place.id, name: place.name, currency },
        account,
        settings,
        livemode,
        nowMs: Date.now(),
      });
      if (!res.ok) {
        await release();
        console.log("[consumer-web-start-payment]", JSON.stringify({ outcome: res.code ?? "refused", place_id: input.placeId, amount_cents: input.amountCents, card_cents: card.cardCents }));
        return json({ ok: false, code: res.code, error: res.error, ...res.detail }, res.status);
      }
      if (res.kind === "already_paid") {
        // The same tap, already settled: the page reads the payment back.
        if (charges) await bind(res.payment_id, (await charges.payment(res.payment_id))?.paid_at ?? null);
        return json({ ok: true, payment_id: res.payment_id, status: "paid", outcome: "already_paid", test_mode: !livemode });
      }
      await bind(res.start.payment_id, null);
      console.log("[consumer-web-start-payment]", JSON.stringify({ outcome: "open", payment_id: res.start.payment_id, place_id: input.placeId, amount_cents: input.amountCents, card_cents: card.cardCents, tip_cents: card.tipCents }));
      return json({ ok: true, ...res.start });
    }

    const res = await startPayment(admin, { consumerId: userId, input, currency, livemode });
    if (!res.ok) {
      await release();
      console.log("[consumer-web-start-payment]", JSON.stringify({ outcome: res.code ?? "refused", place_id: input.placeId, amount_cents: input.amountCents }));
      return json({ ok: false, code: res.code, error: res.error, ...res.detail }, res.status);
    }
    await bind(res.payment.payment_id, res.payment.paid_at);
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
