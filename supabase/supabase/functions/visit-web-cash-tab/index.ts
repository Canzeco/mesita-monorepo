// Supabase Edge Function — visit-web-cash-tab
//
// Any phone signed in with the waiter code confirms cash (MESITA-3734: there
// is no Staff QR; MESITA-3708 had required one).
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the waiter's Received.
// The guest chose to pay part of the tab in cash; the waiter types what they
// received (or nothing: exactly what is owed). Staff only: a staff token or
// the place code of the tab's place (the guest's QR token alone never
// confirms cash). Less than the cash bill part writes nothing and answers
// short with what is missing; a shortfall within the tip comes off the tip.
// Received spends the held credit and writes the cashback (2% of the cash
// bill part when the place's Cashback switch was on), Pending one hour.
// Idempotent: a second tap answers already_paid.
//
// Body: { token, staff_token | place_code, cash_received_cents?,
//         share_tab_id? }
//   MESITA-3695: on a split bill, `share_tab_id` names the share whose cash
//   the waiter received (a share of the table this token opens).
// Response: { ok: true, outcome: paid | already_paid, cash_received_cents,
//             cash_tip_cents, cashback_cents, staff_token? }
//   400 (a malformed call) · 403 staff_only · 404 not_found ·
//   409 short (+missing_cents, cash_bill_cents) | no_cash | expired |
//   closed | place_code_required | locked

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isUuid } from "../_shared/place-id.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { callTabRpc, hashTabToken, readCashBody, readTabByToken, rpcRefusal, tabStaffAccess, readShareTokenHash } from "../_shared/tab.ts";

serveJson("visit-web-cash-tab", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readCashBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error, ...parsed.detail }, parsed.status);
  const input = parsed.input;

  try {
    const tab = await readTabByToken(admin, input.token);
    if (!tab) return json({ ok: false, code: "not_found", error: "This tab is gone" }, 404);
    const staff = await tabStaffAccess(admin, {
      serviceKey: env.serviceKey,
      headers: req.headers,
      placeId: tab.place_id,
      key: input,
      nowMs: Date.now(),
    });
    if (!staff.ok) {
      console.log("[visit-web-cash-tab]", JSON.stringify({ outcome: staff.code, place_id: tab.place_id }));
      return json({ ok: false, code: staff.code, error: staff.error, ...staff.detail }, staff.status);
    }
    // Staff access above is the waiter code's (MESITA-3734: there is no Staff
    // QR); MESITA-3708 had confirmed cash only from a Staff-QR phone.
    if (!tab.staff_key_hash) return json({ ok: false, code: "not_billed", error: "The bill was never sent" }, 409);
    // Any staff of the tab's place may confirm (checked above): the RPC's key
    // check is the tab's own key.
    let tokenHash = await hashTabToken(input.token);
    const shareId = bodyRes.body.share_tab_id;
    if (shareId !== undefined && shareId !== null) {
      if (!isUuid(shareId)) return json({ ok: false, error: "share_tab_id must be a share of this bill" }, 400);
      const shareHash = await readShareTokenHash(admin, tab.id, shareId);
      if (!shareHash) return json({ ok: false, code: "not_found", error: "This share is gone" }, 404);
      tokenHash = shareHash;
    }
    const r = await callTabRpc(admin, "pay_tab_cash", {
      p_token_hash: tokenHash,
      p_staff_key_hash: tab.staff_key_hash,
      p_received_cents: input.receivedCents,
    });
    const minted = staff.minted ? { staff_token: staff.minted.token, staff_expires_at: staff.minted.expiresAt } : {};
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[visit-web-cash-tab]", JSON.stringify({ outcome: refusal.code, tab_id: tab.id }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail, ...minted }, refusal.status);
    }
    console.log("[visit-web-cash-tab]", JSON.stringify({
      outcome: r.outcome,
      tab_id: tab.id,
      cash_received_cents: r.cash_received_cents,
      cashback_cents: r.cashback_cents ?? 0,
    }));
    return json({
      ok: true,
      outcome: r.outcome,
      cash_received_cents: r.cash_received_cents ?? null,
      cash_tip_cents: r.cash_tip_cents ?? null,
      cashback_cents: r.cashback_cents ?? 0,
      ...minted,
    });
  } catch (err) {
    return failWithRequestId("visit-web-cash-tab", "Couldn't confirm. Try again.", err);
  }
});
