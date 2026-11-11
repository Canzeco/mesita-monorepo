// Supabase Edge Function — visit-web-get-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the waiter's poll of a
// tab at visit.mesita.ai/tab/<token>. No sign-in: the QR token is the key,
// and it reads only the bill's state (never who the guest is): waiting for
// the bill, billed, paying (with the cash to collect), paid.
//
// Body: { token: 22 base64url chars }
// Response: { ok: true, tab: { place, status, currency, bill_cents,
//             tip_suggested_cents, bill_version, ticket, waiter_name, billed,
//             credit_cents, cash_bill_cents, cash_tip_cents, cash_due_cents,
//             cash_received_cents, card_bill_cents, card_tip_cents,
//             cashback_cents, paid_at, expires_at, updated_at, test_mode,
//             table } }
//   MESITA-3695: `table` on a split bill: bill, paid, left and each share by
//   id (status, share, tip, cash due, cash received), never who holds it.
//   400 (not a token) · 404 not_found

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { readSettings } from "../_shared/payments.ts";
import { moneyState } from "../_shared/money-state.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { isTabToken, readTabByToken, readTabParts, readShares, staffTabView, tableView } from "../_shared/tab.ts";

serveJson("visit-web-get-tab", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isTabToken(token)) return json({ ok: false, error: "That is not a tab" }, 400);

  try {
    const tab = await readTabByToken(admin, token);
    if (!tab) return json({ ok: false, code: "not_found", error: "This tab is gone" }, 404);
    const [parts, settings, placeRes] = await Promise.all([
      readTabParts(admin, tab.id),
      readSettings(admin, tab.place_id),
      readVoucherPlace(admin, tab.place_id),
    ]);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const nowMs = Date.now();
    const table = tab.split_at ? tableView(tab, await readShares(admin, tab.id), nowMs) : null;
    return json({
      ok: true,
      tab: staffTabView(tab, parts, { table, placeName: placeRes.place?.name ?? null, cashBackBps: moneyState({ ...settings, has_place_code: true }, null, null).cash_cashback_bps, nowMs }),
    });
  } catch (err) {
    return failWithRequestId("visit-web-get-tab", "Couldn't read the tab. Try again.", err);
  }
});
