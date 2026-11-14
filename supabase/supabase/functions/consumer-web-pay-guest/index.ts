// Supabase Edge Function — consumer-web-pay-guest
//
// MESITA-3707 (guest pays, waiter verifies): the guest's one tap. The guest
// picked the place, typed the amount they are paying (before tip) and the
// tip, and chose how to pay: credit first, then a saved card or cash for the
// rest; the tip by card or cash (credits never pay a tip). pay_tab_guest_pay
// makes it one guest tab in one transaction under the (guest, place) lock,
// through the same pay_tab_open_parts the waiter's tab uses: the parts must
// add up to the bill, the credit must be spendable. Any refusal leaves
// nothing (the SQL raises). Credit alone → paid now; a cash part → it waits
// for the waiter's Verify (visit-web-verify-tab), which writes the 2%; a card
// part → charged inside the app as on the waiter's tab (_shared/tab-card.ts).
// Every guest tab ends with the waiter scanning its QR and tapping Verify,
// within ten minutes (MESITA-3843).
//
// Body: { place_id, bill_cents, credit_cents, cash_bill_cents,
//         cash_tip_cents, card_bill_cents?, card_tip_cents?, card_pm_id?
//         (with a card part), request_id (one per tap; a retry after a lost
//         answer carries the same), ticket? (MESITA-3776: the number on the
//         restaurant's ticket, 1-16 letters, digits, spaces, dashes or
//         slashes; null = none), repeat_ok? ("Yes, my share": resend the
//         SAME request_id with true after ticket_paid) }
// Response: { ok: true, outcome: opened | replayed, tab_id, status: paying |
//             paid, token, qr_url, expires_at, card_payment_id?,
//             card?: { status, payment_intent_id, client_secret?,
//                      stripe_account?, publishable_key? },
//             cashback_on_sign_cents (MESITA-3772: what the waiter's
//             signature would earn: card bill × card rate + cash bill ×
//             cash rate; nothing is earned unsigned) }
//   MESITA-3772: one open guest payment per guest at any place; a second
//   tap answers 409 too_many_open with open_tab_id and open_place_id.
//   MESITA-3776: a ticket another guest paid here in the last 12 hours
//   answers 409 ticket_paid (no time, no amount) unless repeat_ok; one the
//   guest paid themselves answers 409 ticket_paid_by_you with paid_tab_id
//   (repeat_ok never overrides it); a bad ticket answers 400 ticket_invalid.
//   400 bad_request | amount_required | parts | tip_by_credit |
//   card_required | ticket_invalid · 401 sign_in · 404 gone |
//   card_not_found · 409 parts | insufficient (+spendable_cents) |
//   too_many_open | ticket_paid | ticket_paid_by_you (+paid_tab_id) | cash_off |
//   card_unavailable | card_tip_alone | below_minimum | cards_off |
//   no_account | currency_mismatch | card_declined | card_needs_auth ·
//   502 card_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { readAccount, readSettings } from "../_shared/payments.ts";
import { moneyState } from "../_shared/money-state.ts";
import { readCustomer } from "../_shared/boost.ts";
import { bps, MESITA_FEE_BPS_PAYMENT, MONEY_CURRENCY } from "../_shared/money.ts";
import { cardRefusal } from "../_shared/pay-card.ts";
import { PI_TTL_MS } from "../_shared/settle-payment.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { mintProofToken } from "../_shared/proof.ts";
import { callTabRpc, hashTabToken, mintTabToken, readGuestPayBody, rpcRefusal, tabUrl } from "../_shared/tab.ts";
import { ownCard, runTabCard, tabCardRates } from "../_shared/tab-card.ts";
import { paymentsLivemode, paymentsPublishableKey, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("consumer-web-pay-guest", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readGuestPayBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error, ...parsed.detail }, parsed.status);
  const pay = parsed.input;
  const userId = user.id;
  const hasCard = pay.cardBillCents > 0 || pay.cardTipCents > 0;

  try {
    const placeRes = await readVoucherPlace(admin, pay.placeId);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const place = placeRes.place;
    if (!place || place.state !== "active") {
      return json({ ok: false, code: "gone", error: "This place can't take payments" }, 404);
    }
    const currency = String(place.currency ?? MONEY_CURRENCY).toLowerCase();
    const livemode = paymentsLivemode();
    const settings = await readSettings(admin, pay.placeId);
    // Cash Payments (MESITA-3589): a cash part needs the owner's switch.
    const cashMoney = moneyState({ ...settings, has_place_code: true }, null, null);
    if ((pay.cashBillCents > 0 || pay.cashTipCents > 0) && !cashMoney.cash) {
      return json({ ok: false, code: "cash_off", error: "This place doesn't take cash through Mesita. Pay with credit or card." }, 409);
    }

    // The card part's gates, before anything is held.
    const key = paymentsStripeKey();
    const stripe = key ? stripeClient(key) : null;
    let customer: string | null = null;
    let cardArgs: Record<string, unknown> = {};
    let cardBackBps = 0;
    if (hasCard) {
      const account = await readAccount(admin, pay.placeId);
      const rates = tabCardRates({ account, settings, livemode, currency, stripeReady: !!stripe });
      if (!rates.card_available || !account) {
        return json({ ok: false, code: "card_unavailable", error: "This place isn't taking cards right now. Pay with credit or cash." }, 409);
      }
      const gate = cardRefusal({ account, settings, livemode, currency, cardCents: pay.cardBillCents, tipCents: pay.cardTipCents });
      if (gate) return json({ ok: false, code: gate.code, error: gate.error, ...gate.detail }, gate.status);
      customer = await readCustomer(admin, userId, livemode);
      if (!(await ownCard(stripe!, customer, pay.cardPmId as string))) {
        return json({ ok: false, code: "card_not_found", error: "That card is not saved on your account" }, 404);
      }
      cardBackBps = rates.card_back_bps;
      cardArgs = {
        p_stripe_account_id: account.stripe_account_id,
        p_card_fee_cents: bps(pay.cardBillCents, MESITA_FEE_BPS_PAYMENT),
        p_card_cashback_bps: rates.card_back_bps,
        p_card_proof_token: mintProofToken(),
        p_card_expires_at: new Date(Date.now() + PI_TTL_MS).toISOString(),
      };
    }

    const token = mintTabToken();
    const r = await callTabRpc(admin, "pay_tab_guest_pay", {
      p_consumer_id: userId,
      p_place_id: pay.placeId,
      p_currency: currency,
      p_livemode: livemode,
      p_token_hash: await hashTabToken(token),
      p_bill_cents: pay.billCents,
      p_credit_cents: pay.creditCents,
      p_cash_bill_cents: pay.cashBillCents,
      p_cash_tip_cents: pay.cashTipCents,
      p_card_bill_cents: pay.cardBillCents,
      p_card_tip_cents: pay.cardTipCents,
      p_request_id: pay.requestId,
      p_proof_token: mintProofToken(),
      p_outside_cashback_bps: Math.max(0, cashMoney.cash_cashback_bps),
      p_ticket: pay.ticket,
      p_repeat_ok: pay.repeatOk,
      // MESITA-3843: the waiter has ten minutes to sign.
      p_window: "10 minutes",
      ...cardArgs,
    });
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[consumer-web-pay-guest]", JSON.stringify({ outcome: refusal.code, place_id: pay.placeId }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    const tabId = String(r.tab_id);

    // The card part, charged inside the app on the place's account. A
    // replay of a tap whose card already started reads its state from
    // consumer-web-get-tab instead.
    const cardPaymentId = typeof r.card_payment_id === "string" ? r.card_payment_id : null;
    let cardStep: Record<string, unknown> | null = null;
    if (hasCard && cardPaymentId && stripe && customer && r.outcome === "opened") {
      const res = await runTabCard(admin, stripe, {
        paymentId: cardPaymentId,
        customer,
        platformPm: pay.cardPmId as string,
        currency,
        placeId: pay.placeId,
        placeName: place.name ?? null,
        consumerId: userId,
        tabId,
        publishableKey: paymentsPublishableKey(livemode),
      });
      if (!res.ok) {
        console.log("[consumer-web-pay-guest]", JSON.stringify({ outcome: res.code, tab_id: tabId, card_payment_id: cardPaymentId }));
        return json({ ok: false, code: res.code, error: res.error, tab_id: tabId, ...res.detail }, res.status);
      }
      cardStep = res.step;
    }

    // Never the token in a log line.
    console.log("[consumer-web-pay-guest]", JSON.stringify({
      outcome: r.outcome,
      tab_id: tabId,
      place_id: pay.placeId,
      status: r.status,
      bill_cents: pay.billCents,
      credit_cents: pay.creditCents,
      cash_bill_cents: pay.cashBillCents,
      cash_tip_cents: pay.cashTipCents,
      card_bill_cents: pay.cardBillCents,
      card_tip_cents: pay.cardTipCents,
      card: cardStep?.status ?? null,
    }));
    return json({
      ok: true,
      outcome: r.outcome,
      tab_id: tabId,
      status: r.status,
      token,
      qr_url: tabUrl(token),
      expires_at: r.expires_at ?? null,
      card_payment_id: cardPaymentId,
      test_mode: !livemode,
      cashback_on_sign_cents: bps(pay.cardBillCents, cardBackBps) + bps(pay.cashBillCents, Math.max(0, cashMoney.cash_cashback_bps))
        // MESITA-3827: the credit part's Credits Payments Cashback, also at the signature.
        + bps(pay.creditCents, Math.max(0, cashMoney.credit_cashback_bps)),
      ...(cardStep ? { card: cardStep } : {}),
    });
  } catch (err) {
    return failWithRequestId("consumer-web-pay-guest", "Couldn't pay. Try again with the same tap.", err);
  }
});
