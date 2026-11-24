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
//             settings: { loyalty_cards, cash_payments, pay_cards, voucher_200,
//                         ..., voucher_vip },
//             contract: { signed, signed_at, terms_version },  the Loyalty
//                          Cards Agreement (MESITA-3589), independent of Stripe
//             account.stage: none|onboarding|in_review|connected|action_needed|
//                          payouts_paused|restricted (Main §10's Place Stripe)
//             code_set,    whether a waiter has a code
//             waiters: [{ id, name, removed, tips_24h_cents, bills_24h,
//                          tips_7d_cents, bills_7d, code }]  MESITA-4871
//             fee: { hold, invoice },
//             cashback: { welcome_bps, returning_bps, returning_vip_bps, … } }
//                          MESITA-4698: the owner's two cashback lines and
//                          the cap per bill (defaults when never saved)  Mesita's fee invoice (MESITA-3461):
//                          hold = cards are off until it is paid; invoice =
//                          the one to pay (amount, due, Stripe's page)
//             credit_limit: { limit_cents, outstanding_cents, currency,
//                          tier: none|credits|stripe|custom|default,
//                          next: { step: credits|stripe, limit_cents } | null }
//                          MESITA-4732: the Credit Limit box on Offers. The
//                          tiers are place_credit_limit_info's (one source,
//                          in this server's Stripe universe); outstanding is
//                          wallet_place_outstanding, the voucher buy's read.
//                          null when either read fails.
//             instagram_url: the place profile's Instagram link, or null

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { accountView, LOYALTY_CARDS_TERMS_TEXT, readAccount, readContract, readSettings, refreshAccount } from "../_shared/payments.ts";
import { FEE_INVOICE_COLUMNS, type FeeInvoiceRow, feeView } from "../_shared/fee-billing.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";
import { errorMessage } from "../_shared/errors.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { CASHBACK_DEFAULTS, readCashbackRates } from "../_shared/cashback.ts";
import { readPlaceOutstanding } from "../_shared/vouchers.ts";

type CreditLimitStep = { step: "credits" | "stripe"; limit_cents: number };
type CreditLimitView = {
  limit_cents: number | null;
  outstanding_cents: number;
  currency: string;
  tier: "none" | "credits" | "stripe" | "custom" | "default";
  next: CreditLimitStep | null;
};

const CREDIT_LIMIT_TIERS = new Set(["none", "credits", "stripe", "custom", "default"]);

/** MESITA-4732: place_credit_limit_info's jsonb as the Offers page reads it;
 *  null when the place has none (no such place). */
function creditLimitView(info: unknown, outstandingCents: number, currency: string): CreditLimitView | null {
  if (!info || typeof info !== "object") return null;
  const row = info as { limit_cents?: unknown; currency?: unknown; tier?: unknown; next?: unknown };
  const tier = String(row.tier ?? "");
  if (!CREDIT_LIMIT_TIERS.has(tier)) return null;
  const next = row.next && typeof row.next === "object" ? row.next as { step?: unknown; limit_cents?: unknown } : null;
  return {
    limit_cents: row.limit_cents === null || row.limit_cents === undefined ? null : Number(row.limit_cents),
    outstanding_cents: outstandingCents,
    currency: typeof row.currency === "string" && row.currency ? row.currency : currency,
    tier: tier as CreditLimitView["tier"],
    next: next && (next.step === "credits" || next.step === "stripe")
      ? { step: next.step, limit_cents: Number(next.limit_cents ?? 0) }
      : null,
  };
}

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
  // MESITA-3913: the one currency of this place's Loyalty Cards.
  const placeRes = await readVoucherPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const placeRow = placeRes.place;
  // MESITA-4871: one code per waiter, with their tips; the codes themselves only
  // for who manages the place (MESITA-4886).
  const { data: waiterRows, error: waiterErr } = await admin.rpc("place_waiter_list", { p_place_id: placeId, p_livemode: paymentsLivemode() });
  if (waiterErr) return json({ ok: false, error: `place_waiter_list: ${waiterErr.message}` }, 500);
  const codes = new Map<string, string | null>();
  if (canManage(access.role)) {
    const { data: codeRows, error: codesErr } = await admin.from("place_waiters").select("id, code").eq("place_id", placeId).is("removed_at", null);
    if (codesErr) return json({ ok: false, error: `place_waiters: ${codesErr.message}` }, 500);
    for (const r of (codeRows ?? []) as Array<{ id: string; code: string | null }>) codes.set(r.id, r.code);
  }
  const waiters = ((waiterRows ?? []) as Array<{ id: string; removed: boolean }>).map((w) => ({ ...w, code: codes.get(w.id) ?? null }));
  const { data: invoices, error: feeErr } = await admin
    .from("place_fee_invoices")
    .select(FEE_INVOICE_COLUMNS)
    .eq("place_id", placeId)
    .eq("livemode", paymentsLivemode())
    .in("status", ["open", "uncollectible"])
    .order("created_at", { ascending: true })
    .limit(10);
  if (feeErr) return json({ ok: false, error: `place_fee_invoices: ${feeErr.message}` }, 500);
  // CREDITS BALANCE (MESITA-3946, Pato: "Credits Balance"): the credit guests
  // hold here now, Available + Pending, the sum Operations › Money shows. An
  // empty window keeps place_money_summary to that sum; a failed read is null.
  const now = new Date().toISOString();
  const { data: summary, error: sumErr } = await admin.rpc("place_money_summary", {
    p_place_id: placeId,
    p_from: now,
    p_to: now,
    p_livemode: paymentsLivemode(),
    p_before: null,
    p_before_id: null,
  });
  if (sumErr) console.error(`[business-web-get-payments] place_money_summary: ${sumErr.message}`);
  const sum = (summary ?? null) as { available_cents?: unknown; pending_cents?: unknown } | null;
  const credits_balance = sumErr || !sum
    ? null
    : { available_cents: Number(sum.available_cents ?? 0), pending_cents: Number(sum.pending_cents ?? 0) };
  // No Staff QR any more (MESITA-3734): the waiter code is the one staff key.
  const hold = account?.livemode === paymentsLivemode() && account?.fee_hold === true;
  const { data: dueRows } = await admin.from("guest_pay_attempts")
    .select("id, cash_cents, guest_label, created_at")
    .eq("place_id", placeId)
    .eq("status", "due")
    .order("created_at", { ascending: true });
  // MESITA-4698: a failed read shows the defaults rather than no page.
  const cashback = await readCashbackRates(admin, placeId).catch((err) => {
    console.error(`[business-web-get-payments] cashback: ${errorMessage(err)}`);
    return { ...CASHBACK_DEFAULTS };
  });
  // MESITA-4732: the Credit Limit box and the read-only Place Username.
  const currency = String(placeRow?.currency ?? "MXN").toUpperCase();
  const [limitRes, outstanding, profileRes] = await Promise.all([
    admin.rpc("place_credit_limit_info", { p_place_id: placeId, p_livemode: paymentsLivemode() }),
    readPlaceOutstanding(admin, placeId, currency, paymentsLivemode()).catch((err) => {
      console.error(`[business-web-get-payments] wallet_place_outstanding: ${errorMessage(err)}`);
      return null;
    }),
    admin.from("place_profiles").select("instagram_url").eq("id", placeId).maybeSingle(),
  ]);
  if (limitRes.error) console.error(`[business-web-get-payments] place_credit_limit_info: ${limitRes.error.message}`);
  if (profileRes.error) console.error(`[business-web-get-payments] place_profiles: ${profileRes.error.message}`);
  const credit_limit = limitRes.error || outstanding === null ? null : creditLimitView(limitRes.data, outstanding, currency);
  const igRaw = (profileRes.data as { instagram_url?: unknown } | null)?.instagram_url;
  const instagram_url = typeof igRaw === "string" && igRaw.trim() ? igRaw.trim() : null;
  return json({
    ok: true,
    can_edit: canManage(access.role),
    cashback,
    test_mode: !paymentsLivemode(),
    account: accountView(account),
    settings,
    currency,
    credit_limit,
    instagram_url,
    contract: { ...contract, text: LOYALTY_CARDS_TERMS_TEXT },
    code_set: waiters.some((w) => !w.removed),
    waiters,
    credits_balance,
    fee: feeView(hold, (invoices ?? []) as FeeInvoiceRow[], Date.now()),
    cash_due: (dueRows ?? []).map((row) => ({
      attempt_id: row.id,
      cash_cents: row.cash_cents,
      guest_label: row.guest_label,
      created_at: row.created_at,
    })),
  });
});
