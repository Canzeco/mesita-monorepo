// Supabase Edge Function — consumer-web-pay-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the guest's one tap.
// The guest says how to pay the bill (credits, cash) and the tip (cash;
// credits never pay a tip); pay_tab_open_parts does it in one transaction
// under the (guest, place) lock: the bill version the guest read must be the
// tab's (else stale), the parts must add up to the bill, the credit must be
// spendable. Credits for the whole bill and no cash tip → paid now; a cash
// part → one outside row, collected by the waiter's Received
// (visit-web-cash-tab).
//
// MESITA-4708: NO CARD FOR A BILL. The card part (MESITA-3563) is gone:
// cards buy vouchers only. A card part or `card_pm_id` answers 409 cards_off.
//
// Body: { tab_id, bill_version, credit_cents, cash_bill_cents,
//         cash_tip_cents, request_id (one per tap; a retry after a lost
//         answer carries the same) }
// Response: { ok: true, outcome: opened | replayed, status: paying | paid,
//             payment_id?, credit_cents, cash_bill_cents, cash_tip_cents }
//   400 (a malformed call) · 400 parts | tip_by_credit · 401 sign_in ·
//   404 not_found · 409 stale (+bill_version) | parts | insufficient
//   (+spendable_cents) | outside_limit | cash_off | cards_off | not_billed |
//   paying | expired | cancelled | closed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { readSettings } from "../_shared/payments.ts";
import { moneyState } from "../_shared/money-state.ts";
import { callTabRpc, readSplitBody, readTabById, rpcRefusal, splitArgs } from "../_shared/tab.ts";

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
      return json({ ok: false, code: "cash_off", error: "This place doesn't take cash through Mesita. Pay with credits." }, 409);
    }

    const r = await callTabRpc(admin, "pay_tab_open_parts", splitArgs(userId, split));
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[consumer-web-pay-tab]", JSON.stringify({ outcome: refusal.code, tab_id: tab.id }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }

    const after = await readTabById(admin, tab.id);
    console.log("[consumer-web-pay-tab]", JSON.stringify({
      outcome: r.outcome,
      tab_id: tab.id,
      status: after?.status ?? r.status,
      credit_cents: split.creditCents,
      cash_bill_cents: split.cashBillCents,
      cash_tip_cents: split.cashTipCents,
    }));
    return json({
      ok: true,
      outcome: r.outcome,
      status: after?.status ?? r.status,
      payment_id: r.payment_id ?? null,
      credit_cents: split.creditCents,
      cash_bill_cents: split.cashBillCents,
      cash_tip_cents: split.cashTipCents,
    });
  } catch (err) {
    return failWithRequestId("consumer-web-pay-tab", "Couldn't pay. Try again with the same tap.", err);
  }
});
