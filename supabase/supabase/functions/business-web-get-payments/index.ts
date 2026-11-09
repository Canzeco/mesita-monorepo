// Supabase Edge Function — business-web-get-payments
//
// MESITA-3296: Business › Payments. The place's Stripe account as Stripe last
// said it stands (re-read on every call: there is no webhook yet), and the
// money switches the owner has on. Any manager may read; the owner and Mesita
// staff may change (can_edit).
//
// Body: { place_id: uuid }
// Response: { ok: true, can_edit, test_mode,
//             account: { state: none|onboarding|ready|restricted, ... },
//             settings: { cashback, voucher_200, ..., voucher_vip },
//             code_set,    whether the place code is set: the waiter's charge
//                          (MESITA-3306) needs it, so Payments says so
//             fee: { hold, invoice } }  Mesita's fee invoice (MESITA-3461):
//                          hold = cards are off until it is paid; invoice =
//                          the one to pay (amount, due, Stripe's page)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "../_shared/boost.ts";
import { accountView, readAccount, readSettings, refreshAccount } from "../_shared/payments.ts";
import { FEE_INVOICE_COLUMNS, type FeeInvoiceRow, feeView } from "../_shared/fee-billing.ts";

serveJson("business-web-get-payments", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  let account = await readAccount(admin, placeId);
  const key = boostStripeKey();
  if (account && key) {
    try {
      account = await refreshAccount(admin, stripeClient(key), account, boostLivemode());
    } catch (err) {
      // Stripe unreachable, or the account gone from this universe: answer
      // what the row last said rather than nothing.
      console.error(`[business-web-get-payments] refresh: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const settings = await readSettings(admin, placeId);
  const { data: code, error: codeErr } = await admin.from("place_codes").select("place_id").eq("place_id", placeId).maybeSingle();
  if (codeErr) return json({ ok: false, error: `place_codes: ${codeErr.message}` }, 500);
  const { data: invoices, error: feeErr } = await admin
    .from("place_fee_invoices")
    .select(FEE_INVOICE_COLUMNS)
    .eq("place_id", placeId)
    .eq("livemode", boostLivemode())
    .in("status", ["open", "uncollectible"])
    .order("created_at", { ascending: true })
    .limit(10);
  if (feeErr) return json({ ok: false, error: `place_fee_invoices: ${feeErr.message}` }, 500);
  const hold = account?.livemode === boostLivemode() && account?.fee_hold === true;
  return json({
    ok: true,
    can_edit: canManage(access.role),
    test_mode: !boostLivemode(),
    account: accountView(account),
    settings,
    code_set: !!code,
    fee: feeView(hold, (invoices ?? []) as FeeInvoiceRow[], Date.now()),
  });
});
