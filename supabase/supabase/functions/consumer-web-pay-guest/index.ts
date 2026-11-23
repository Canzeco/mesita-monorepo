// Supabase Edge Function — consumer-web-pay-guest
//
// MESITA-3707 (guest pays, waiter verifies): the guest's one tap. The guest
// picked the place, typed the amount they are paying (before tip) and the
// tip, and chose how to pay: credit first, then cash for the rest; the tip in
// cash (credits never pay a tip). pay_guest_begin opens one ticket under the
// (guest, place) lock: the parts must add up to the bill, the credit must be
// spendable. Any refusal leaves nothing (the SQL raises). Every ticket ends
// with the waiter scanning its QR and tapping Confirm (visit-web-verify-tab),
// within its window (MESITA-3843, MESITA-4048).
//
// MESITA-4708: NO CARD FOR A BILL. The card tender (a saved card, MESITA-3856,
// and Apple Pay / Google Pay, MESITA-4386) is gone: cards buy vouchers only.
// A card part, `card_pm_id` or `express` answers 409 cards_off.
//
// Body: { place_id, bill_cents, credit_cents, cash_bill_cents,
//         cash_tip_cents, request_id (one per tap; a retry after a lost
//         answer carries the same), ticket? (MESITA-3776: the number on the
//         restaurant's ticket, 1-16 letters, digits, spaces, dashes or
//         slashes; null = none), repeat_ok? ("Yes, my share": resend the
//         SAME request_id with true after ticket_paid) }
// Response: { ok: true, outcome: opened | replayed, tab_id, attempt_id,
//             status: paying | paid, token, qr_url, expires_at, test_mode }
//   MESITA-3772: one open guest payment per guest at any place; a second
//   tap answers 409 too_many_open with open_tab_id and open_place_id.
//   MESITA-3776: a ticket another guest paid here in the last 12 hours
//   answers 409 ticket_paid (no time, no amount) unless repeat_ok; one the
//   guest paid themselves answers 409 ticket_paid_by_you with paid_tab_id
//   (repeat_ok never overrides it); a bad ticket answers 400 ticket_invalid.
//   400 bad_request | amount_required | parts | tip_by_credit |
//   ticket_invalid · 401 sign_in · 404 gone · 409 parts | insufficient
//   (+spendable_cents) | too_many_open | ticket_paid | ticket_paid_by_you
//   (+paid_tab_id) | cash_off | cards_off | discount_changed (MESITA-4770:
//   the parts must add up to bill - discount; + discount_cents, to_pay_cents)

// MESITA-4524 (no zombie tickets): the tap opens a TICKET (guest_pay_attempts)
// that always ends: closed (paid) or released with one reason. Cash and
// credits wait for the waiter's Confirm (visit-web-verify-tab,
// _shared/guest-attempt.ts). The answer's `tab_id` is the attempt id: the bill
// page reads it through consumer-web-get-tab until it closes. `release: true`
// ends the guest's own attempt (a Cancel before Confirm). An open attempt
// past its window ends here before a new one begins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { readSettings } from "../_shared/payments.ts";
import { moneyState } from "../_shared/money-state.ts";
import { MONEY_CURRENCY } from "../_shared/money.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { callTabRpc, hashTabToken, mintTabToken, readGuestPayBody, rpcRefusal, tabUrl } from "../_shared/tab.ts";
import { readMoneyConfig } from "../_shared/money-config.ts";
import { endAttempt } from "../_shared/guest-attempt.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("consumer-web-pay-guest", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  // A Cancel retires this tap. No ticket.
  if (bodyRes.body.release === true && typeof bodyRes.body.request_id === "string") {
    const { data: own, error: ownErr } = await admin.from("guest_pay_attempts").select("id")
      .eq("consumer_id", user.id).eq("request_id", bodyRes.body.request_id).maybeSingle();
    if (ownErr) throw new Error(`attempt_read: ${ownErr.message}`);
    if (!own) return json({ ok: true, released: "none", tab_id: null });
    const k = paymentsStripeKey();
    const ended = await endAttempt(admin, k ? stripeClient(k) : null, String((own as { id: string }).id), "cancelled", { consumerId: user.id, source: "consumer-web-pay-guest" });
    if (!ended.ok && ended.code === "charging") {
      return json({ ok: false, code: "charging", error: "The waiter already confirmed this payment." }, 409);
    }
    return json({ ok: true, released: ended.ok ? ended.outcome : ended.code, tab_id: ended.ok ? null : ended.tabId ?? null });
  }
  const parsed = readGuestPayBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error, ...parsed.detail }, parsed.status);
  const pay = parsed.input;
  const userId = user.id;

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
      return json({ ok: false, code: "cash_off", error: "This place doesn't take cash through Mesita. Pay with credit." }, 409);
    }

    // An open attempt past its window may still hold an older card hold
    // (MESITA-4524): endAttempt lets it go with Stripe.
    const key = paymentsStripeKey();
    const stripe = key ? stripeClient(key) : null;

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
      // MESITA-4708: no card part; the SQL keeps its card columns at 0.
      p_card_bill_cents: 0,
      p_card_tip_cents: 0,
      p_request_id: pay.requestId,
      p_stripe_account_id: null,
      p_card_fee_cents: 0,
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
    const tabId = typeof r.tab_id === "string" ? r.tab_id : null;

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
      // MESITA-4770: the visit discount the server took off the bill.
      visit_mechanism: r.visit_mechanism ?? null,
      discount_bps: typeof r.discount_bps === "number" ? r.discount_bps : 0,
      discount_cents: typeof r.discount_cents === "number" ? r.discount_cents : 0,
      test_mode: !livemode,
    });
  } catch (err) {
    return failWithRequestId("consumer-web-pay-guest", "Couldn't pay. Try again with the same tap.", err);
  }
});
