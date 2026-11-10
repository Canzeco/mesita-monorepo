// Supabase Edge Function — consumer-web-pay-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the guest's one tap.
// The guest says how to pay the bill (credits, cash, card) and the tip
// (cash, card; credits never pay a tip); pay_tab_open_parts does it in one
// transaction under the (guest, place) lock: the bill version the guest
// read must be the tab's (else stale), the parts must add up to the bill,
// the credit must be spendable. Credits for the whole bill and no cash tip →
// paid now; a cash part → one outside row (2% back on the cash bill part
// when the place's Cashback switch is on), collected by the waiter's
// Received (visit-web-cash-tab, which waits for a card part first).
//
// A card part (MESITA-3563, _shared/tab-card.ts): the saved card must be on
// the guest's own customer (payments mode); one card row carries the credit
// (held), the card bill part and the card tip; the card is cloned to the
// place's account and charged there inside the app (no Checkout). 5% back on
// the card bill part, never the tip.
//
// Body: { tab_id, bill_version, credit_cents, cash_bill_cents,
//         cash_tip_cents, card_bill_cents?, card_tip_cents?, card_pm_id?
//         (with a card part), request_id (one per tap; a retry after a lost
//         answer carries the same) }
// Response: { ok: true, outcome: opened | replayed, status: paying | paid,
//             payment_id?, card_payment_id?, credit_cents, cash_bill_cents,
//             cash_tip_cents, card_bill_cents, card_tip_cents,
//             card?: { status: succeeded | processing | requires_action,
//                      payment_intent_id, client_secret?, stripe_account?,
//                      publishable_key? } }
//   requires_action: run stripe.handleNextAction({ clientSecret }) with
//   Stripe.js loaded for `stripe_account`, then keep polling
//   consumer-web-get-tab.
//   400 (a malformed call) · 400 parts | tip_by_credit | card_required ·
//   401 sign_in · 404 not_found | card_not_found · 409 stale (+bill_version)
//   | parts | insufficient (+spendable_cents) | outside_limit |
//   card_unavailable | card_tip_alone | below_minimum | cards_off |
//   no_account | currency_mismatch | card_declined (+decline_code) |
//   card_needs_auth | not_billed | paying | expired | cancelled | closed ·
//   502 card_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { readAccount, readSettings } from "../_shared/payments.ts";
import { moneyState } from "../_shared/money-state.ts";
import { readCustomer } from "../_shared/boost.ts";
import { bps, MESITA_FEE_BPS_PAYMENT } from "../_shared/money.ts";
import { cardRefusal } from "../_shared/pay-card.ts";
import { PI_TTL_MS } from "../_shared/settle-payment.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { callTabRpc, type CardSplitArgs, readSplitBody, readTabById, rpcRefusal, splitArgs } from "../_shared/tab.ts";
import { ownCard, runTabCard, tabCardRates } from "../_shared/tab-card.ts";
import { paymentsLivemode, paymentsPublishableKey, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("consumer-web-pay-tab", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readSplitBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error, ...parsed.detail }, parsed.status);
  const split = parsed.input;
  const userId = user.id;
  const hasCard = split.cardBillCents > 0 || split.cardTipCents > 0;

  try {
    const tab = await readTabById(admin, split.tabId);
    if (!tab || tab.consumer_id !== userId) {
      return json({ ok: false, code: "not_found", error: "This tab is gone" }, 404);
    }
    const settings = await readSettings(admin, tab.place_id);
    // Cash Payments (MESITA-3589): a cash part needs the owner's switch. A
    // credit-only bill never does: credit the guest holds stays spendable
    // whatever the switches say.
    const cashMoney = moneyState({ ...settings, has_place_code: true }, null, null);
    if ((split.cashBillCents > 0 || split.cashTipCents > 0) && !cashMoney.cash) {
      return json({ ok: false, code: "cash_off", error: "This place doesn't take cash through Mesita. Pay with credits or card." }, 409);
    }

    // The card part's gates, before anything is held.
    let card: CardSplitArgs | null = null;
    let customer: string | null = null;
    const key = paymentsStripeKey();
    const livemode = paymentsLivemode();
    const stripe = key ? stripeClient(key) : null;
    if (hasCard) {
      const account = await readAccount(admin, tab.place_id);
      const rates = tabCardRates({ account, settings, livemode, currency: tab.currency, stripeReady: !!stripe && tab.livemode === livemode });
      if (!rates.card_available || !account) {
        return json({ ok: false, code: "card_unavailable", error: "This place isn't taking cards right now. Pay with credits or cash." }, 409);
      }
      const gate = cardRefusal({ account, settings, livemode, currency: tab.currency, cardCents: split.cardBillCents, tipCents: split.cardTipCents });
      if (gate) return json({ ok: false, code: gate.code, error: gate.error, ...gate.detail }, gate.status);
      customer = await readCustomer(admin, userId, livemode);
      if (!(await ownCard(stripe!, customer, split.cardPmId as string))) {
        return json({ ok: false, code: "card_not_found", error: "That card is not saved on your account" }, 404);
      }
      card = {
        stripeAccountId: account.stripe_account_id,
        feeCents: bps(split.cardBillCents, MESITA_FEE_BPS_PAYMENT),
        cashbackBps: rates.card_back_bps,
        expiresAt: new Date(Date.now() + PI_TTL_MS).toISOString(),
      };
    }

    const r = await callTabRpc(admin, "pay_tab_open_parts", splitArgs(userId, split, cashMoney.cash_cashback_bps, card));
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[consumer-web-pay-tab]", JSON.stringify({ outcome: refusal.code, tab_id: tab.id }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }

    const cardPaymentId = typeof r.card_payment_id === "string" ? r.card_payment_id : null;
    let cardStep: Record<string, unknown> | null = null;
    if (hasCard && cardPaymentId && stripe && customer) {
      const placeRes = await readVoucherPlace(admin, tab.place_id);
      const res = await runTabCard(admin, stripe, {
        paymentId: cardPaymentId,
        customer,
        platformPm: split.cardPmId as string,
        currency: tab.currency,
        placeId: tab.place_id,
        placeName: placeRes.ok ? placeRes.place?.name ?? null : null,
        consumerId: userId,
        tabId: tab.id,
        publishableKey: paymentsPublishableKey(livemode),
      });
      if (!res.ok) {
        console.log("[consumer-web-pay-tab]", JSON.stringify({ outcome: res.code, tab_id: tab.id, card_payment_id: cardPaymentId }));
        return json({ ok: false, code: res.code, error: res.error, ...res.detail }, res.status);
      }
      cardStep = res.step;
    }

    const after = await readTabById(admin, tab.id);
    console.log("[consumer-web-pay-tab]", JSON.stringify({
      outcome: r.outcome,
      tab_id: tab.id,
      status: after?.status ?? r.status,
      credit_cents: split.creditCents,
      cash_bill_cents: split.cashBillCents,
      cash_tip_cents: split.cashTipCents,
      card_bill_cents: split.cardBillCents,
      card_tip_cents: split.cardTipCents,
      card: cardStep?.status ?? null,
    }));
    return json({
      ok: true,
      outcome: r.outcome,
      status: after?.status ?? r.status,
      payment_id: r.payment_id ?? null,
      card_payment_id: cardPaymentId,
      credit_cents: split.creditCents,
      cash_bill_cents: split.cashBillCents,
      cash_tip_cents: split.cashTipCents,
      card_bill_cents: split.cardBillCents,
      card_tip_cents: split.cardTipCents,
      ...(cardStep ? { card: cardStep } : {}),
    });
  } catch (err) {
    return failWithRequestId("consumer-web-pay-tab", "Couldn't pay. Try again with the same tap.", err);
  }
});
