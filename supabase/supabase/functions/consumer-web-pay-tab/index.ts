// Supabase Edge Function — consumer-web-pay-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the guest's one tap.
// The guest says how to pay the bill (credits, cash) and the tip (cash;
// credits never pay a tip); pay_tab_open_parts does it in one transaction
// under the (guest, place) lock: the bill version the guest read must be
// the tab's (else stale), the parts must add up to the bill, the credit must
// be spendable. Credits for the whole bill and no cash tip → paid now; any
// cash part → one outside row holding the credit until the waiter's
// Received (visit-web-cash-tab), 2% back on the cash bill part when the
// place's Cashback switch is on. A card part waits for T2 (MESITA-3563).
//
// Body: { tab_id, bill_version, credit_cents, cash_bill_cents,
//         cash_tip_cents, card_bill_cents?, card_tip_cents?, request_id
//         (one per tap; a retry after a lost answer carries the same) }
// Response: { ok: true, outcome: opened | replayed, status: paying | paid,
//             payment_id?, credit_cents, cash_bill_cents, cash_tip_cents }
//   400 (a malformed call) · 400 parts | tip_by_credit · 401 sign_in ·
//   404 not_found · 409 stale (+bill_version) | parts | insufficient
//   (+spendable_cents) | outside_limit | card_unavailable | not_billed |
//   paying | expired | cancelled | closed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { readSettings } from "../_shared/payments.ts";
import { callTabRpc, readSplitBody, readTabById, rpcRefusal, splitArgs } from "../_shared/tab.ts";
import { errorMessage } from "../_shared/errors.ts";

serveJson("consumer-web-pay-tab", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return json({ ok: false, code: "sign_in", error: "Sign in to pay" }, 401);
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readSplitBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error, ...parsed.detail }, parsed.status);
  const split = parsed.input;

  try {
    const admin = adminClient(envRes.env);
    const tab = await readTabById(admin, split.tabId);
    if (!tab || tab.consumer_id !== authRes.user.id) {
      return json({ ok: false, code: "not_found", error: "This tab is gone" }, 404);
    }
    const settings = await readSettings(admin, tab.place_id);
    const r = await callTabRpc(admin, "pay_tab_open_parts", splitArgs(authRes.user.id, split, settings.cashback));
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[consumer-web-pay-tab]", JSON.stringify({ outcome: refusal.code, tab_id: tab.id }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    console.log("[consumer-web-pay-tab]", JSON.stringify({
      outcome: r.outcome,
      tab_id: tab.id,
      status: r.status,
      credit_cents: split.creditCents,
      cash_bill_cents: split.cashBillCents,
      cash_tip_cents: split.cashTipCents,
    }));
    return json({
      ok: true,
      outcome: r.outcome,
      status: r.status,
      payment_id: r.payment_id ?? null,
      credit_cents: split.creditCents,
      cash_bill_cents: split.cashBillCents,
      cash_tip_cents: split.cashTipCents,
    });
  } catch (err) {
    const request_id = crypto.randomUUID();
    console.error("[consumer-web-pay-tab]", JSON.stringify({ request_id, error: errorMessage(err) }));
    return json({ ok: false, error: "Couldn't pay. Try again with the same tap.", request_id }, 500);
  }
});
