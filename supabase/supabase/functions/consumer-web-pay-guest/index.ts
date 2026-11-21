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
// for the waiter's Verify (visit-web-verify-tab); a card
// part → charged inside the app as on the waiter's tab (_shared/tab-card.ts).
// Every guest tab ends with the waiter scanning its QR and tapping Verify,
// within an hour (MESITA-3843, MESITA-4048).
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
//                      stripe_account?, publishable_key? } }
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
//
// MESITA-4386: APPLE PAY / GOOGLE PAY. `express: true` instead of
// `card_pm_id` pays the card part with the phone's wallet (Stripe's Express
// Checkout Element; never a Connect Express account). The bill opens exactly
// as with a card; the card part's row reads pay_source 'express' and gets a
// MANUAL-CAPTURE PaymentIntent with no payment method, which the browser
// confirms with Face ID / Google: that is the hold. The waiter's code
// captures it like a held card (MESITA-3856); expiry, X or Reject cancel it
// and give the credit back. A replay of the same request_id answers the same
// PaymentIntent's state and never cancels one still waiting for the wallet.
//   Example: { "place_id": "…", "bill_cents": 50000, "request_id": "…",
//     "credit_cents": 0, "card_bill_cents": 50000, "card_tip_cents": 5000,
//     "cash_bill_cents": 0, "cash_tip_cents": 0, "express": true }
//   Answer adds express: { status: requires_payment_method, express: true,
//     payment_intent_id, client_secret, stripe_account, publishable_key,
//     amount_cents } — or held / processing once confirmed.
//   Refusals beyond the card's: 400 bad_body field=express (with
//   card_pm_id, or with no card part) · 409 disabled (the kill switch
//   app_config.money_config.express_wallets is []).

// MESITA-4524 (no zombie tickets): the tap opens a TICKET (guest_pay_attempts)
// that always ends: closed (paid) or released with one reason. The card part
// is a HOLD now (manual capture), placed on "Show the waiter"; the waiter's
// Confirm captures it (visit-web-verify-tab, _shared/guest-attempt.ts).
// Cash and credits wait for the same Confirm. The answer's `tab_id` is the
// attempt id: the bill page reads it through consumer-web-get-tab until it
// closes. `release: true` ends the guest's own attempt (a dismissed wallet
// sheet, a Cancel before Confirm). An open attempt past its window ends here
// before a new one begins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { readAccount, readSettings } from "../_shared/payments.ts";
import { moneyState } from "../_shared/money-state.ts";
import { readCustomer } from "../_shared/boost.ts";
import { bps, MESITA_FEE_BPS_PAYMENT, MONEY_CURRENCY } from "../_shared/money.ts";
import { cardRefusal } from "../_shared/pay-card.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { callTabRpc, hashTabToken, mintTabToken, readGuestPayBody, rpcRefusal, tabUrl } from "../_shared/tab.ts";
import { ownCard, runTabCard, tabCardRates } from "../_shared/tab-card.ts";
import { readMoneyConfig } from "../_shared/money-config.ts";
import { endAttempt } from "../_shared/guest-attempt.ts";
import { paymentsLivemode, paymentsPublishableKey, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("consumer-web-pay-guest", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  // A dismissed sheet retires this tap. No ticket.
  if (bodyRes.body.release === true && typeof bodyRes.body.request_id === "string") {
    const { data: own, error: ownErr } = await admin.from("guest_pay_attempts").select("id")
      .eq("consumer_id", user.id).eq("request_id", bodyRes.body.request_id).maybeSingle();
    if (ownErr) throw new Error(`attempt_read: ${ownErr.message}`);
    if (!own) return json({ ok: true, released: "none", tab_id: null });
    const k = paymentsStripeKey();
    const ended = await endAttempt(admin, k ? stripeClient(k) : null, String((own as { id: string }).id), "cancelled", { consumerId: user.id, source: "consumer-web-pay-guest" });
    if (!ended.ok && ended.code === "charging") {
      return json({ ok: false, code: "charging", error: "The waiter already confirmed. Your card is being charged." }, 409);
    }
    return json({ ok: true, released: ended.ok ? ended.outcome : ended.code, tab_id: ended.ok ? null : ended.tabId ?? null });
  }
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
    if (hasCard) {
      const account = await readAccount(admin, pay.placeId);
      const rates = tabCardRates({ account, settings, livemode, currency, stripeReady: !!stripe });
      if (!rates.card_available || !account) {
        return json({ ok: false, code: "card_unavailable", error: "This place isn't taking cards right now. Pay with credit or cash." }, 409);
      }
      const gate = cardRefusal({ account, settings, livemode, currency, cardCents: pay.cardBillCents, tipCents: pay.cardTipCents });
      if (gate) return json({ ok: false, code: gate.code, error: gate.error, ...gate.detail }, gate.status);
      if (pay.express) {
        // MESITA-4386: the kill switch stops a Pay screen already open too.
        if ((await readMoneyConfig(admin)).express_wallets.length === 0) {
          return json({ ok: false, code: "disabled", error: "Apple Pay and Google Pay are off right now. Pay with a card." }, 409);
        }
      } else {
        customer = await readCustomer(admin, userId, livemode);
        if (!(await ownCard(stripe!, customer, pay.cardPmId as string))) {
          return json({ ok: false, code: "card_not_found", error: "That card is not saved on your account" }, 404);
        }
      }
      cardArgs = {
        p_stripe_account_id: account.stripe_account_id,
        p_card_fee_cents: bps(pay.cardBillCents, MESITA_FEE_BPS_PAYMENT),
      };
    }

    const token = mintTabToken();
    const windowMinutes = (await readMoneyConfig(admin)).guest_pay_window_minutes;
    // MESITA-4502: no pay_tabs row until the money is done.
    const beginArgs = {
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
      p_stripe_account_id: (cardArgs.p_stripe_account_id as string | undefined) ?? null,
      p_card_fee_cents: (cardArgs.p_card_fee_cents as number | undefined) ?? 0,
      p_window_minutes: windowMinutes,
    };
    let r = await callTabRpc(admin, "pay_guest_begin", beginArgs);
    // MESITA-4524: an attempt of this guest past its window holding a card
    // PaymentIntent ends first (its hold let go), then this one begins.
    if (r.ok !== true && r.code === "too_many_open" && r.open_expired === true && typeof r.open_attempt_id === "string") {
      await endAttempt(admin, stripe, r.open_attempt_id, "expired", { consumerId: userId, source: "consumer-web-pay-guest" });
      r = await callTabRpc(admin, "pay_guest_begin", beginArgs);
    }
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[consumer-web-pay-guest]", JSON.stringify({ outcome: refusal.code, place_id: pay.placeId }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    const attemptId = String(r.attempt_id);
    let tabId = typeof r.tab_id === "string" ? r.tab_id : null;

    // The card part, charged inside the app on the place's account. A
    // replay of a tap whose card already started reads its state from
    // consumer-web-get-tab instead.
    const cardPaymentId = typeof r.card_payment_id === "string" ? r.card_payment_id : null;
    let cardStep: Record<string, unknown> | null = null;
    // MESITA-4386: an express part is marked before its PaymentIntent opens
    // (a freshly opened row only); its replay reads the same PaymentIntent.
    if (pay.express && hasCard && cardPaymentId && r.outcome === "opened") {
      const { error: markErr } = await admin.from("wallet_payments")
        .update({ pay_source: "express", pay_with: "express" })
        .eq("id", cardPaymentId).eq("status", "opening").is("stripe_payment_intent_id", null);
      if (markErr) throw new Error(`express_mark: ${markErr.message}`);
    }
    const runCard = hasCard && cardPaymentId && stripe && (pay.express || (customer && r.outcome === "opened"));
    if (runCard) {
      const res = await runTabCard(admin, stripe, {
        paymentId: cardPaymentId,
        ...(customer ? { customer, platformPm: pay.cardPmId as string } : {}),
        currency,
        placeId: pay.placeId,
        placeName: place.name ?? null,
        consumerId: userId,
        tabId: attemptId,
        publishableKey: paymentsPublishableKey(livemode),
        // MESITA-4524: a hold; the waiter's Confirm captures it.
        hold: true,
        attemptId,
      });
      if (!res.ok) {
        console.log("[consumer-web-pay-guest]", JSON.stringify({ outcome: res.code, attempt_id: attemptId, card_payment_id: cardPaymentId }));
        // A refused hold: the ticket ends declined at once (nothing held).
        await callTabRpc(admin, "pay_guest_release", { p_consumer_id: userId, p_request_id: pay.requestId, p_reason: "declined" });
        return json({ ok: false, code: res.code, error: res.error, ...res.detail }, res.status);
      }
      cardStep = res.step;
    }

    // The hold landed: the ticket is live (the QR shows).
    if (cardStep?.status === "held") {
      await callTabRpc(admin, "pay_guest_mark_held", { p_attempt_id: attemptId });
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
      // MESITA-4524: the bill page reads the attempt by this id until it closes.
      tab_id: tabId ?? attemptId,
      attempt_id: attemptId,
      status: r.status === "closed" ? "paid" : "paying",
      token,
      qr_url: tabUrl(token),
      expires_at: r.expires_at ?? null,
      card_payment_id: cardPaymentId,
      test_mode: !livemode,
      ...(cardStep ? (pay.express ? { express: cardStep } : { card: cardStep }) : {}),
    });
  } catch (err) {
    return failWithRequestId("consumer-web-pay-guest", "Couldn't pay. Try again with the same tap.", err);
  }
});
