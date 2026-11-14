// admin-web-get-voucher-prices — the voucher catalog, read-only, for Admin ›
// Payments › Vouchers (MESITA-3918, Pato: "must not be directly configurable
// but must be visible"). One row per voucher: its bonus, its wait, whether it
// is on sale, and its price in every currency that sells vouchers
// (VOUCHER_PRICE_CENTS, MESITA-3917). The numbers change only in code.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { MESITA_FEE_BPS_VOUCHER, UNSUPPORTED_COUNTRIES, VOUCHER_CATALOG, VOUCHER_CURRENCY_LIST, VOUCHER_PRICE_CENTS, voucherBonusCents } from "../_shared/money.ts";
import { MONEY_VOUCHER_KEYS, NOT_YET_SELLABLE } from "../_shared/money-state.ts";

serveJson("admin-web-get-voucher-prices", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const currencies = Object.keys(VOUCHER_PRICE_CENTS).map((c) => c.toUpperCase());
  const vouchers = MONEY_VOUCHER_KEYS.map((key) => ({
    key,
    kind: VOUCHER_CATALOG[key].kind,
    bonus_bps: VOUCHER_CATALOG[key].bonus_bps,
    available_after_sec: VOUCHER_CATALOG[key].available_after_sec,
    on_sale: !NOT_YET_SELLABLE[key],
    prices: Object.fromEntries(
      Object.entries(VOUCHER_PRICE_CENTS).map(([cur, table]) => [
        cur.toUpperCase(),
        { price_cents: table[key], credit_cents: table[key] + voucherBonusCents(key, cur) },
      ]),
    ),
  }));
  // MESITA-3919: the ten currencies, and which of them sell today.
  const currency_list = VOUCHER_CURRENCY_LIST.map((r) => ({
    code: r.code,
    country: r.country,
    small: r.small,
    big: r.small * 10,
    selling: r.code.toLowerCase() in VOUCHER_PRICE_CENTS,
  }));
  return json({ ok: true, currencies, fee_bps: MESITA_FEE_BPS_VOUCHER, vouchers, currency_list, unsupported: UNSUPPORTED_COUNTRIES });
});
