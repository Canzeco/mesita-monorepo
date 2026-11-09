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
//             cashback_cents, paid_at, expires_at, updated_at, test_mode } }
//   400 (not a token) · 404 not_found

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { readSettings } from "../_shared/payments.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { isTabToken, readTabByToken, readTabParts, staffTabView } from "../_shared/tab.ts";
import { errorMessage } from "../_shared/errors.ts";

serveJson("visit-web-get-tab", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isTabToken(token)) return json({ ok: false, error: "That is not a tab" }, 400);

  try {
    const admin = adminClient(envRes.env);
    const tab = await readTabByToken(admin, token);
    if (!tab) return json({ ok: false, code: "not_found", error: "This tab is gone" }, 404);
    const [parts, settings, placeRes] = await Promise.all([
      readTabParts(admin, tab.id),
      readSettings(admin, tab.place_id),
      readVoucherPlace(admin, tab.place_id),
    ]);
    if (!placeRes.ok) throw new Error(placeRes.error);
    return json({
      ok: true,
      tab: staffTabView(tab, parts, { placeName: placeRes.place?.name ?? null, cashbackOn: settings.cashback, nowMs: Date.now() }),
    });
  } catch (err) {
    const request_id = crypto.randomUUID();
    console.error("[visit-web-get-tab]", JSON.stringify({ request_id, error: errorMessage(err) }));
    return json({ ok: false, error: "Couldn't read the tab. Try again.", request_id }, 500);
  }
});
