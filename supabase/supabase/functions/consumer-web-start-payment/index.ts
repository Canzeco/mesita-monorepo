// Supabase Edge Function — consumer-web-start-payment
//
// MESITA-3304 (W2a): a signed-in guest pays a place from their credit there.
// One RPC (wallet_pay_credit) under the (guest, place) lock writes the paid
// payment and its spend entry and answers a proof token; the QR opens the
// proof on visit.mesita.ai.
//
// MESITA-4708: NO CARD FOR A BILL. The card part (MESITA-3305, W2b: a Stripe
// Checkout for the rest and a tip) is gone: cards buy vouchers only. A
// `card_cents` or `tip_cents` above 0 answers 409 cards_off; the rest of a
// bill is paid outside (below).
//
// Body: { place_id: uuid, amount_cents: integer (credit),
//         request_id: uuid (one per tap; a retry after a lost answer carries
//         the same), ticket?: string }
// Response (credit only): { ok: true, payment_id, status, outcome: paid |
//           already_paid, amount_cents, credit_cents, currency, paid_at,
//           proof: { token, url }, test_mode }
//   400 (a malformed call) · 400 amount_required | above_cap (+cap_cents) ·
//   401 sign_in · 404 gone (no such active place) ·
//   409 insufficient (+spendable_cents) | taken (+payment_id) | cards_off ·
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
//
// MESITA-3545 (Payments Flow v2): `look: true` also answers the waiter's tip
// (tip_cents). With a charge the credit path pays at most the waiter's bill:
// `amount_cents` may be lower, never higher (the rest is "rest at the
// table", paid off-app, earning nothing); the tip is the guest's to change.
// The outside path: body { place_id, charge_code, outside: true, tip_cents,
// request_id }. A new tap after a cancel carries a NEW request_id. Always the charge's full bill: the server takes credit
// first (min(spendable, bill)) and the rest is paid outside, waiting 30
// minutes for the waiter's Received (visit-web-confirm-charge). Never
// no_account or cards_off: no Stripe on this path.
// Response (outside): { ok: true, payment_id, status: "open" | "paid",
//           outcome: opened | in_progress | already_paid, amount_cents,
//           credit_cents, outside_cents, tip_cents, currency, expires_at,
//           test_mode }
//   400 outside_needs_charge (no charge_code) | tip_invalid ·
//   409 credit_covers (+spendable_cents, bill_cents: credit pays the whole
//       bill, pay from credit) | insufficient | taken

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { MONEY_CURRENCY } from "../_shared/money.ts";
import { readPayBody, startOutsidePayment, startPayment } from "../_shared/pay.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { readSettings } from "../_shared/payments.ts";
import { moneyState } from "../_shared/money-state.ts";
import { errorMessage } from "../_shared/errors.ts";
import { isUuid } from "../_shared/place-id.ts";
import { type ChargeRow, type ChargeStore, chargeLook, findGuestCharge, openOutsideOf, readChargeCode, readTip, supabaseChargeStore } from "../_shared/charge.ts";
import { moneyText } from "../_shared/pay.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

serveJson("consumer-web-start-payment", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const outside = bodyRes.body.outside === true;
  if (outside && (bodyRes.body.charge_code === undefined || bodyRes.body.charge_code === null)) {
    return json({ ok: false, code: "outside_needs_charge", error: "Paying outside needs the waiter's code" }, 400);
  }

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

  // Paying outside (MESITA-3545): the charge's whole bill, credit first.
  if (outside && charge && charges) {
    const c = charge;
    const store = charges;
    if (!isUuid(bodyRes.body.request_id)) return json({ ok: false, error: "request_id must be a uuid" }, 400);
    const tip = readTip(bodyRes.body.tip_cents);
    if (!tip.ok) return json({ ok: false, code: tip.code, error: tip.error, ...tip.detail }, tip.status);
    const placeRes = await readVoucherPlace(admin, c.place_id);
    if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
    if (!placeRes.place || placeRes.place.state !== "active") {
      return json({ ok: false, code: "gone", error: "This place can't take payments" }, 404);
    }
    const settings = await readSettings(admin, c.place_id);
    // Cash Payments (MESITA-3589): the waiter's code means the place code is
    // set; the owner's switch decides whether a bill may be paid outside.
    const money = moneyState({ ...settings, has_place_code: true }, null, null);
    if (!money.cash) {
      return json({ ok: false, code: "cash_off", error: "This place doesn't take cash through Mesita. Pay with credit." }, 409);
    }
    const currency = String(placeRes.place.currency ?? MONEY_CURRENCY).toLowerCase();
    const livemode = paymentsLivemode();
    if (!(await store.claim(c.id, userId))) {
      return json({ ok: false, code: "taken", error: "Someone else is paying this charge", payment_id: null }, 409);
    }
    // This guest's outside bill on this charge is still waiting: answer it,
    // never a second hold under a new request_id.
    // A live payment of this guest already holds the charge.
    if (c.payment_id && !(await openOutsideOf(store, c, userId))) {
      const held = await store.payment(c.payment_id);
      if (held && held.consumer_id === userId && (held.status === "open" || held.status === "opening")) {
        return json({ ok: false, code: "in_progress", error: "This charge is already being paid", payment_id: held.id }, 409);
      }
    }
    const bound = await openOutsideOf(store, c, userId);
    if (bound) {
      await store.bind(c.id, bound.id, null, c.amount_cents);
      return json({
        ok: true,
        payment_id: bound.id,
        status: "open",
        outcome: "in_progress",
        amount_cents: bound.amount_cents,
        credit_cents: bound.credit_cents,
        outside_cents: bound.outside_cents,
        tip_cents: bound.tip_cents,
        currency,
        expires_at: bound.expires_at,
        test_mode: !livemode,
      });
    }
    try {
      const res = await startOutsidePayment(admin, {
        consumerId: userId,
        placeId: c.place_id,
        billCents: c.amount_cents,
        tipCents: tip.tipCents,
        ticket: c.ticket,
        requestId: bodyRes.body.request_id,
        currency,
        livemode,
        nowMs: Date.now(),
      });
      if (!res.ok) {
        // Nothing moved: the charge goes back to the waiter.
        await store.unclaim(c.id, userId);
        console.log("[consumer-web-start-payment]", JSON.stringify({ outcome: res.code ?? "refused", place_id: c.place_id, path: "outside" }));
        return json({ ok: false, code: res.code, error: res.error, ...res.detail }, res.status);
      }
      const paidAt = res.started.outcome === "already_paid" ? (await store.payment(res.started.payment_id))?.paid_at ?? null : null;
      if (!(await store.bind(c.id, res.started.payment_id, paidAt, c.amount_cents))) {
        // Another payment holds the charge: never a second one.
        return json({ ok: false, code: "in_progress", error: "This charge is already being paid", payment_id: c.payment_id }, 409);
      }
      console.log("[consumer-web-start-payment]", JSON.stringify({
        outcome: res.started.outcome,
        payment_id: res.started.payment_id,
        place_id: c.place_id,
        credit_cents: res.started.credit_cents,
        outside_cents: res.started.outside_cents,
        tip_cents: res.started.tip_cents,
        path: "outside",
      }));
      return json({ ok: true, ...res.started });
    } catch (err) {
      console.error("[consumer-web-start-payment] outside", JSON.stringify({ consumer_id: userId, place_id: c.place_id, request_id: bodyRes.body.request_id, error: errorMessage(err) }));
      return json({ ok: false, error: "Couldn't confirm the payment. Try again.", request_id: bodyRes.body.request_id }, 500);
    }
  }

  const parsed = readPayBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error, ...parsed.detail }, parsed.status);
  const input = charge ? { ...parsed.input, ticket: charge.ticket } : parsed.input;
  // Lower-only (MESITA-3545): never more than the waiter's bill; less is the
  // rest at the table.
  if (charge && input.amountCents > charge.amount_cents) {
    return json({ ok: false, error: `The waiter's charge is ${moneyText(charge.amount_cents, charge.currency)}` }, 400);
  }
  // MESITA-4708: no card part (and so no card tip) for a bill.
  const cardCents = bodyRes.body.card_cents;
  const tipCents = bodyRes.body.tip_cents;
  if ((typeof cardCents === "number" && cardCents > 0) || (typeof tipCents === "number" && tipCents > 0)) {
    return json({ ok: false, code: "cards_off", error: "Pay the rest to the place, in cash or on its own terminal" }, 409);
  }

  const placeRes = await readVoucherPlace(admin, input.placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") {
    return json({ ok: false, code: "gone", error: "This place can't take payments" }, 404);
  }
  // A guest's credit is the place's debt (MESITA-3408): no switch refuses it.
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
    if (charge && charges && !(await charges.bind(charge.id, paymentId, paidAt, charge.amount_cents))) {
      console.error("[consumer-web-start-payment] bind_refused", JSON.stringify({ payment_id: paymentId, place_id: charge.place_id }));
    }
  };

  try {
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
