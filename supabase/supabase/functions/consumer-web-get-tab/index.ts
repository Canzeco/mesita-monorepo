// Supabase Edge Function — consumer-web-get-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the guest's poll of their
// tab. One tab row, its payment rows, the guest's spendable credit here and
// the place's Cash Payments switch. Cheap on purpose: the Pay screen polls it
// about every 1.5 s while waiting for the bill, backing off, and stops when
// hidden or the tab is final (paid, expired, cancelled).
//
// The card part (MESITA-3563, _shared/tab-card.ts): `rates` says whether
// cards work here (card_available, card_unavailable_code,
// card_minimum_cents); `with_cards: true` (ask once, when the bill arrives)
// adds the guest's saved cards; while a card part is in flight the poll
// reads its PaymentIntent: `card_action` carries what Stripe.js needs to
// finish a 3-D Secure check the guest left (or the app reloaded mid-check),
// a PI that went through settles here (the receiver and the cron are the
// other two callers), and one that failed bills the tab again.
//
// MESITA-4524: `tab_id` may be a guest pay ATTEMPT id (a ticket not yet
// closed). It reads as a guest bill (attemptAsTab); once closed it reads its
// real ticket. The read moves the ticket on: a hold that landed goes live,
// a live ticket past its window ends (expired; the hold let go first).
// `remint: true` reissues the attempt's QR (the old one works 60 s more).
// `server_now` lets the countdown run on the server's clock.
// Body: { tab_id: uuid, with_cards?: boolean, remint?: boolean }
// MESITA-3707: a guest tab's QR lives on the guest's phone; `remint: true`
// (sent only when the phone lost it) answers `token` and `qr_url` for the
// guest's own guest tab before its window ends, and the older QR stops
// working. A plain read never re-mints.
// Response: { ok: true, tab: { tab_id, place, status, currency, bill_cents,
//             tip_suggested_cents, bill_version, ticket, waiter_name,
//             spendable_cents, rates, credit_cents, cash_bill_cents,
//             cash_tip_cents, cash_due_cents, cash_received_cents,
//             card_bill_cents, card_tip_cents, parts,
//             paid_at, expires_at, updated_at, test_mode },
//             cards?: [{ id, brand, last4, exp_month, exp_year }],
//             card_action?: { status: requires_action | processing,
//               payment_intent_id, client_secret?, stripe_account?,
//               publishable_key? },
//             card_error?: { code, error, decline_code? } }
//   MESITA-3695: `tab.table` is the split table a share belongs to (its bill,
//   what is paid and left, the shares by id); on a split table it is the table
//   itself and `tab.my_share_tab_id` names the guest's own share.
//   `table.mine`: this guest split it (only they can show the friends' QR).
//   400 (a malformed call) · 401 sign_in · 404 not_found (no such tab of
//   this guest)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readAccount, readSettings } from "../_shared/payments.ts";
import { moneyState } from "../_shared/money-state.ts";
import { readCustomer } from "../_shared/boost.ts";
import { listCards } from "../_shared/cards.ts";
import { type CardStep, isExpressStep, pollTabCard, readCardRow, tabCardRates } from "../_shared/tab-card.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { readPlaceBalance } from "../_shared/vouchers.ts";
import { callTabRpc, guestTabView, hashTabToken, mintTabToken, readShares, readTabById, readTabParts, tableView, tabUrl } from "../_shared/tab.ts";
import { errorMessage } from "../_shared/errors.ts";
import { paymentsLivemode, paymentsPublishableKey, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";
import { attemptAsTab, attemptParts, endAttempt, phaseOf, pollPlacingHold, readAttemptById, readAttemptPayment } from "../_shared/guest-attempt.ts";

serveJson("consumer-web-get-tab", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const tabId = bodyRes.body.tab_id;
  if (!isUuid(tabId)) return json({ ok: false, error: "tab_id must be a tab id" }, 400);

  try {
    const key = paymentsStripeKey();
    const livemode = paymentsLivemode();
    const stripe = key ? stripeClient(key) : null;
    const nowMs = Date.now();
    let tab = await readTabById(admin, tabId);
    // MESITA-4524: a ticket not yet closed is an attempt.
    let attemptReminted: { token: string; qr_url: string } | null = null;
    let attemptView: { parts: Awaited<ReturnType<typeof readTabParts>> } | null = null;
    if (!tab) {
      let a = await readAttemptById(admin, tabId);
      if (!a || a.consumer_id !== user.id) {
        return json({ ok: false, code: "not_found", error: "This tab is gone" }, 404);
      }
      if (stripe) await pollPlacingHold(admin, stripe, a, await readAttemptPayment(admin, a));
      a = (await readAttemptById(admin, a.id)) ?? a;
      const phase = phaseOf(a);
      if ((phase === "live" || phase === "placing_hold") && Date.parse(a.expires_at) <= nowMs) {
        await endAttempt(admin, stripe, a.id, phase === "live" ? "expired" : "cancelled", { consumerId: user.id, source: "consumer-web-get-tab" });
        a = (await readAttemptById(admin, a.id)) ?? a;
      }
      if (a.status === "closed" && a.tab_id) {
        tab = await readTabById(admin, a.tab_id);
      }
      if (!tab) {
        if (bodyRes.body.remint === true && (a.status === "opening" || a.status === "due")) {
          const token = mintTabToken();
          const r = await callTabRpc(admin, "pay_guest_reissue_token", { p_attempt_id: a.id, p_consumer_id: user.id, p_token_hash: await hashTabToken(token) });
          if (r.ok === true) attemptReminted = { token, qr_url: tabUrl(token) };
          console.log("[consumer-web-get-tab]", JSON.stringify({ outcome: r.ok === true ? "reissued" : r.code, attempt_id: a.id }));
        }
        tab = attemptAsTab(a);
        attemptView = { parts: attemptParts(a, await readAttemptPayment(admin, a)) };
      }
    }
    if (!tab || tab.consumer_id !== user.id) {
      return json({ ok: false, code: "not_found", error: "This tab is gone" }, 404);
    }

    // A card part in flight: read its PaymentIntent first, so the tab the
    // guest gets back already says what it settled.
    let cardAction: CardStep | null = null;
    // MESITA-4386: an express hold still waiting for Face ID / Google is the
    // Pay screen's to confirm, never a bank check for the bill page.
    let expressAction: CardStep | null = null;
    let cardError: Record<string, unknown> | null = null;
    let tabNow = tab;
    let parts = attemptView ? attemptView.parts : await readTabParts(admin, tab.id);
    const inFlight = attemptView ? undefined : parts.find((p) => p.part === "card" && p.status === "open");
    if (inFlight && stripe) {
      const row = await readCardRow(admin, inFlight.id);
      if (row) {
        const polled = await pollTabCard(admin, stripe, row, paymentsPublishableKey(livemode), nowMs);
        if (polled.step && isExpressStep(polled.step)) expressAction = polled.step;
        else if (polled.step && polled.step.status !== "succeeded") cardAction = polled.step;
        if (polled.refusal) cardError = { code: polled.refusal.code, error: polled.refusal.error, ...polled.refusal.detail };
        if (polled.step?.status === "succeeded" || polled.refusal) {
          tabNow = (await readTabById(admin, tab.id)) ?? tab;
          parts = await readTabParts(admin, tab.id);
        }
      }
    }

    let reminted: { token: string; qr_url: string } | null = attemptReminted;
    if (!attemptView && bodyRes.body.remint === true && tabNow.origin === "guest") {
      const token = mintTabToken();
      const r = await callTabRpc(admin, "pay_tab_guest_remint", {
        p_tab_id: tabNow.id,
        p_consumer_id: user.id,
        p_token_hash: await hashTabToken(token),
      });
      if (r.ok === true) reminted = { token, qr_url: tabUrl(token) };
      console.log("[consumer-web-get-tab]", JSON.stringify({ outcome: r.ok === true ? "reminted" : r.code, tab_id: tabNow.id }));
    }

    const [settings, placeRes, balance, account] = await Promise.all([
      readSettings(admin, tab.place_id),
      readVoucherPlace(admin, tab.place_id),
      readPlaceBalance(admin, user.id, tab.place_id, tab.currency, tab.livemode),
      readAccount(admin, tab.place_id),
    ]);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const rates = tabCardRates({ account, settings, livemode, currency: tab.currency, stripeReady: !!stripe && tab.livemode === livemode });
    // Cash Payments (MESITA-3589).
    const cashMoney = moneyState({ ...settings, has_place_code: true }, null, null);

    let cards: Array<Record<string, unknown>> | undefined;
    if (bodyRes.body.with_cards === true && rates.card_available && stripe) {
      const customer = await readCustomer(admin, user.id, livemode);
      try {
        cards = customer
          ? (await listCards(stripe, customer, new Set())).map((c) => ({ id: c.id, brand: c.brand, last4: c.last4, exp_month: c.exp_month, exp_year: c.exp_year }))
          : [];
      } catch (err) {
        console.error("[consumer-web-get-tab] cards_failed", JSON.stringify({ error: errorMessage(err) }));
        cards = [];
      }
    }

    // Friends split one bill (MESITA-3695).
    let table = null;
    let myShareTabId: string | null = null;
    if (attemptView) {
      // An attempt is never split.
    } else if (tabNow.parent_tab_id) {
      const parent = await readTabById(admin, tabNow.parent_tab_id);
      if (parent) table = { ...tableView(parent, await readShares(admin, parent.id), nowMs), mine: parent.consumer_id === user.id };
    } else if (tabNow.split_at) {
      const shares = await readShares(admin, tabNow.id);
      table = { ...tableView(tabNow, shares, nowMs), mine: true };
      myShareTabId = shares.filter((s) => s.consumer_id === user.id && ["billed", "paying", "paid"].includes(s.status)).at(-1)?.id ?? null;
    }

    return json({
      ok: true,
      tab: guestTabView(tabNow, parts, {
        table,
        myShareTabId,
        placeName: placeRes.place?.name ?? null,
        spendableCents: Math.max(balance?.spendable_cents ?? 0, 0),
        // A billed tab was billed with the place code, so it is set.
        cashOk: cashMoney.cash,
        nowMs,
        card: rates,
      }),
      ...(cards ? { cards } : {}),
      ...(reminted ?? {}),
      ...(cardAction ? { card_action: cardAction } : {}),
      ...(expressAction ? { express_action: expressAction } : {}),
      ...(cardError ? { card_error: cardError } : {}),
      server_now: new Date(nowMs).toISOString(),
    });
  } catch (err) {
    return failWithRequestId("consumer-web-get-tab", "Couldn't read the tab. Try again.", err);
  }
});
