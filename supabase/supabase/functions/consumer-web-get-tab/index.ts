// Supabase Edge Function — consumer-web-get-tab
//
// MESITA-3562 (Pay at the table, _shared/tab.ts): the guest's poll of their
// tab. One tab row, its payment rows, the guest's spendable credit here and
// the place's Cashback switch. Cheap on purpose: the Pay screen polls it
// about every 1.5 s while waiting for the bill, backing off, and stops when
// hidden or the tab is final (paid, expired, cancelled).
//
// Body: { tab_id: uuid }
// Response: { ok: true, tab: { tab_id, place, status, currency, bill_cents,
//             tip_suggested_cents, bill_version, ticket, waiter_name,
//             spendable_cents, rates, credit_cents, cash_bill_cents,
//             cash_tip_cents, cash_due_cents, cash_received_cents,
//             card_bill_cents, card_tip_cents, cashback_cents, parts,
//             paid_at, expires_at, updated_at, test_mode } }
//   400 (a malformed call) · 401 sign_in · 404 not_found (no such tab of
//   this guest)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readSettings } from "../_shared/payments.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { readPlaceBalance } from "../_shared/vouchers.ts";
import { guestTabView, readTabById, readTabParts } from "../_shared/tab.ts";
import { errorMessage } from "../_shared/errors.ts";

serveJson("consumer-web-get-tab", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return json({ ok: false, code: "sign_in", error: "Sign in to pay" }, 401);
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const tabId = bodyRes.body.tab_id;
  if (!isUuid(tabId)) return json({ ok: false, error: "tab_id must be a tab id" }, 400);

  try {
    const admin = adminClient(envRes.env);
    const tab = await readTabById(admin, tabId);
    if (!tab || tab.consumer_id !== authRes.user.id) {
      return json({ ok: false, code: "not_found", error: "This tab is gone" }, 404);
    }
    const [parts, settings, placeRes, balance] = await Promise.all([
      readTabParts(admin, tab.id),
      readSettings(admin, tab.place_id),
      readVoucherPlace(admin, tab.place_id),
      readPlaceBalance(admin, authRes.user.id, tab.place_id, tab.currency, tab.livemode),
    ]);
    if (!placeRes.ok) throw new Error(placeRes.error);
    return json({
      ok: true,
      tab: guestTabView(tab, parts, {
        placeName: placeRes.place?.name ?? null,
        spendableCents: Math.max(balance?.spendable_cents ?? 0, 0),
        cashbackOn: settings.cashback,
        nowMs: Date.now(),
      }),
    });
  } catch (err) {
    const request_id = crypto.randomUUID();
    console.error("[consumer-web-get-tab]", JSON.stringify({ request_id, error: errorMessage(err) }));
    return json({ ok: false, error: "Couldn't read the tab. Try again.", request_id }, 500);
  }
});
