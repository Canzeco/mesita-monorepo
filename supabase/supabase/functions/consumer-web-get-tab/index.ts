// Supabase Edge Function — consumer-web-get-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the guest's poll of their
// tab. One tab row, its payment rows, the guest's spendable credit here and
// the place's Cash Payments switch. Cheap on purpose: the Pay screen polls it
// about every 1.5 s while waiting for the bill, backing off, and stops when
// hidden or the tab is final (paid, expired, cancelled).
//
// MESITA-4708: no card part for a bill. `rates` is cash_available only; the
// saved cards (`with_cards`), the card part's poll (`card_action`,
// `express_action`, `card_error`) and the card rates are gone. A Stripe
// object an older bill still holds is settled by the receiver and the cron.
//
// MESITA-4524: `tab_id` may be a guest pay ATTEMPT id (a ticket not yet
// closed). It reads as a guest bill (attemptAsTab); once closed it reads its
// real ticket. The read moves the ticket on: a hold that landed goes live,
// a live ticket past its window ends (expired; the hold let go first).
// `remint: true` reissues the attempt's QR (the old one works 60 s more).
// `server_now` lets the countdown run on the server's clock.
// Body: { tab_id: uuid, remint?: boolean }
// MESITA-3707: a guest tab's QR lives on the guest's phone; `remint: true`
// (sent only when the phone lost it) answers `token` and `qr_url` for the
// guest's own guest tab before its window ends, and the older QR stops
// working. A plain read never re-mints.
// Response: { ok: true, tab: { tab_id, place, status, currency, bill_cents,
//             tip_suggested_cents, bill_version, ticket, waiter_name,
//             spendable_cents, rates: { cash_available }, credit_cents,
//             cash_bill_cents, cash_tip_cents, cash_due_cents,
//             cash_received_cents, card_bill_cents, card_tip_cents (0 since
//             MESITA-4708), parts, paid_at, expires_at, updated_at,
//             test_mode }, server_now }
//   MESITA-3695: `tab.table` is the split table a share belongs to (its bill,
//   what is paid and left, the shares by id); on a split table it is the table
//   itself and `tab.my_share_tab_id` names the guest's own share.
//   `table.mine`: this guest split it (only they can show the friends' QR).
//   MESITA-4747: `back` is the Back this paid bill earned (Pato: "Visit
//   1. Pay 2. Wait 1 hour 3. Get Back"): the sum of its cashback lines, when
//   the last one lands, and whether it is still Pending; null when the bill
//   earned none (or is not paid). The Visit ticket draws its three steps.
//   400 (a malformed call) · 401 sign_in · 404 not_found (no such tab of
//   this guest)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readSettings } from "../_shared/payments.ts";
import { moneyState } from "../_shared/money-state.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { readPlaceBalance } from "../_shared/vouchers.ts";
import { callTabRpc, guestTabView, hashTabToken, mintTabToken, readShares, readTabById, readTabParts, tableView, tabUrl } from "../_shared/tab.ts";
import { paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";
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

    const tabNow = tab;
    const parts = attemptView ? attemptView.parts : await readTabParts(admin, tab.id);

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

    const [settings, placeRes, balance, backRes] = await Promise.all([
      readSettings(admin, tab.place_id),
      readVoucherPlace(admin, tab.place_id),
      readPlaceBalance(admin, user.id, tab.place_id, tab.currency, tab.livemode),
      // MESITA-4747: the Back this bill earned (pay_tab_grant_cashback writes
      // it at the payment, Available one hour later). Only a paid bill has one.
      !attemptView && tabNow.status === "paid"
        ? admin
          .from("wallet_entries")
          .select("amount_cents, currency, available_at")
          .eq("consumer_id", user.id)
          .eq("tab_id", tabNow.id)
          .eq("kind", "cashback")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (backRes.error) throw new Error(`wallet_entries: ${backRes.error.message}`);
    if (!placeRes.ok) throw new Error(placeRes.error);
    // Cash Payments (MESITA-3589).
    const cashMoney = moneyState({ ...settings, has_place_code: true }, null, null);

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
      }),
      back: backOf((backRes.data ?? []) as BackLine[], nowMs),
      ...(reminted ?? {}),
      server_now: new Date(nowMs).toISOString(),
    });
  } catch (err) {
    return failWithRequestId("consumer-web-get-tab", "Couldn't read the tab. Try again.", err);
  }
});

type BackLine = { amount_cents: number; currency: string | null; available_at: string | null };

/** The bill's Back, its lines summed; it lands when the last line does. */
function backOf(lines: BackLine[], nowMs: number) {
  const cents = lines.reduce((n, l) => n + (l.amount_cents > 0 ? l.amount_cents : 0), 0);
  if (cents <= 0) return null;
  const at = lines.map((l) => l.available_at).filter((x): x is string => !!x).sort().at(-1) ?? null;
  return {
    amount_cents: cents,
    currency: (lines[0]?.currency ?? "mxn").toLowerCase(),
    available_at: at,
    pending: at != null && Date.parse(at) > nowMs,
  };
}
