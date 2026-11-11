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
//             settings: { house_credits, cash_payments, pay_cards, voucher_200,
//                         ..., voucher_vip, card_cashback_bps, cash_cashback_bps },
//             contract: { signed, signed_at, terms_version },  the House
//                          Credits Contract (MESITA-3589), independent of Stripe
//             account.stage: none|onboarding|in_review|connected|action_needed|
//                          payouts_paused|restricted (Main §10's Place Stripe)
//             code_set,    whether the place code is set: the waiter's charge
//                          (MESITA-3306) needs it, so Payments says so
//             staff_qr,    the Staff QR (MESITA-3696): { secret, made_at,
//                          used_at, place_name } to the owner and Mesita staff, null when
//                          none is made or to an editor (it is a staff key)
//             fee: { hold, invoice } }  Mesita's fee invoice (MESITA-3461):
//                          hold = cards are off until it is paid; invoice =
//                          the one to pay (amount, due, Stripe's page)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { accountView, HOUSE_CREDITS_TERMS_TEXT, readAccount, readContract, readSettings, refreshAccount } from "../_shared/payments.ts";
import { FEE_INVOICE_COLUMNS, type FeeInvoiceRow, feeView } from "../_shared/fee-billing.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";
import { errorMessage } from "../_shared/errors.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";

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
  const key = paymentsStripeKey();
  if (account && key) {
    try {
      account = await refreshAccount(admin, stripeClient(key), account, paymentsLivemode());
    } catch (err) {
      // Stripe unreachable, or the account gone from this universe: answer
      // what the row last said rather than nothing.
      console.error(`[business-web-get-payments] refresh: ${errorMessage(err)}`);
    }
  }
  const [settings, contract] = await Promise.all([readSettings(admin, placeId), readContract(admin, placeId)]);
  const { data: code, error: codeErr } = await admin.from("place_codes").select("place_id, staff_qr, staff_qr_made_at, staff_qr_used_at").eq("place_id", placeId).maybeSingle();
  if (codeErr) return json({ ok: false, error: `place_codes: ${codeErr.message}` }, 500);
  const { data: invoices, error: feeErr } = await admin
    .from("place_fee_invoices")
    .select(FEE_INVOICE_COLUMNS)
    .eq("place_id", placeId)
    .eq("livemode", paymentsLivemode())
    .in("status", ["open", "uncollectible"])
    .order("created_at", { ascending: true })
    .limit(10);
  if (feeErr) return json({ ok: false, error: `place_fee_invoices: ${feeErr.message}` }, 500);
  // The Staff QR (MESITA-3696) is a staff key: the owner and Mesita staff only.
  let staffQr: { secret: string; made_at: string | null; used_at: string | null; place_name: string | null } | null = null;
  if (code?.staff_qr && canManage(access.role)) {
    const placeRes = await readVoucherPlace(admin, placeId);
    staffQr = {
      secret: code.staff_qr,
      made_at: code.staff_qr_made_at,
      used_at: code.staff_qr_used_at,
      place_name: placeRes.ok ? placeRes.place?.name ?? null : null,
    };
  }
  const hold = account?.livemode === paymentsLivemode() && account?.fee_hold === true;
  return json({
    ok: true,
    can_edit: canManage(access.role),
    test_mode: !paymentsLivemode(),
    account: accountView(account),
    settings,
    contract: { ...contract, text: HOUSE_CREDITS_TERMS_TEXT },
    code_set: !!code,
    staff_qr: staffQr,
    fee: feeView(hold, (invoices ?? []) as FeeInvoiceRow[], Date.now()),
  });
});
