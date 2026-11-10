// Supabase Edge Function — visit-web-bill-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the waiter sends the bill
// to the guest's screen. No sign-in on visit.mesita.ai: the waiter is staff
// by the place code (once per device; it answers MESITA-3462's 12-hour staff
// token, which every later call carries) for the tab's place. The bill and
// the tip suggestion may change until the guest pays (409 paying); each
// change needs the bill_version the screen read (409 stale).
//
// Body: { token, place_code | staff_token, bill_cents, tip_cents?,
//         ticket?, waiter_name?, bill_version }
// Response: { ok: true, bill_version, bill_cents, tip_cents,
//             staff_token?, staff_expires_at? (when the place code minted one) }
//   400 (a malformed call) · 400 amount_required | tip_invalid |
//   ticket_too_long · 403 staff_only (no key, a wrong code, a stale token) ·
//   404 not_found · 409 place_code_required | locked (+retry_after_s) |
//   stale (+bill_version) | paying | expired | cancelled

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { callTabRpc, hashTabStaffKey, hashTabToken, readBillBody, readTabByToken, rpcRefusal, tabStaffAccess } from "../_shared/tab.ts";

serveJson("visit-web-bill-tab", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readBillBody(bodyRes.body);
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
      console.log("[visit-web-bill-tab]", JSON.stringify({ outcome: staff.code, place_id: tab.place_id }));
      return json({ ok: false, code: staff.code, error: staff.error, ...staff.detail }, staff.status);
    }
    // Staff of this place may bill from any device: the key that billed last
    // is the tab's (rekey), and Received checks staff the same way.
    const r = await callTabRpc(admin, "pay_tab_bill", {
      p_token_hash: await hashTabToken(input.token),
      p_staff_key_hash: await hashTabStaffKey(staff.staffToken),
      p_rekey: true,
      p_bill_version: input.billVersion,
      p_bill_cents: input.billCents,
      p_tip_cents: input.tipCents,
      p_ticket: input.ticket,
      p_waiter_name: input.waiterName,
    });
    const minted = staff.minted ? { staff_token: staff.minted.token, staff_expires_at: staff.minted.expiresAt } : {};
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      console.log("[visit-web-bill-tab]", JSON.stringify({ outcome: refusal.code, tab_id: tab.id }));
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail, ...minted }, refusal.status);
    }
    // Never the token in a log line.
    console.log("[visit-web-bill-tab]", JSON.stringify({ outcome: "billed", tab_id: tab.id, bill_cents: input.billCents, tip_cents: input.tipCents }));
    return json({ ok: true, bill_version: r.bill_version, bill_cents: r.bill_cents, tip_cents: r.tip_cents, ...minted });
  } catch (err) {
    return failWithRequestId("visit-web-bill-tab", "Couldn't send the bill. Try again.", err);
  }
});
