"use server";

// Admin › Payments (MESITA-3918): a thin wrapper over admin-web-get-voucher-prices.
// Read-only: the voucher catalog changes only in code (_shared/money.ts).
// The cashback defaults are the one editable part (MESITA-4700).

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

export type VoucherPriceRow = {
  key: string;
  kind: "open" | "earned";
  bonus_bps: number;
  available_after_sec: number;
  on_sale: boolean;
  prices: Record<string, { price_cents: number; credit_cents: number }>;
};

export type CurrencyRow = { code: string; country: string; small: number; big: number; selling: boolean };

/** MESITA-4700: the cashback defaults (basis points; no cap since MESITA-4728).
 *  MESITA-4766: and the Returning VIP rate (0 Off · 1000 · 2000). */
export type CashbackDefaults = {
  welcome_bps: number;
  returning_bps: number;
  returning_vip_bps: number;
  /** MESITA-4775 (MESITA-4770): how the three lines pay out by default:
   *  discount (off the bill, no Credits Agreement) or cashback (credit back). */
  visit_mechanism: "discount" | "cashback";
};

/** A read from before Returning VIP carries none: Off. Anything else the server sends is dropped. */
function readDefaults(d: Partial<CashbackDefaults> | null | undefined): CashbackDefaults | null {
  if (!d) return null;
  return {
    welcome_bps: Number(d.welcome_bps ?? 0),
    returning_bps: Number(d.returning_bps ?? 0),
    returning_vip_bps: typeof d.returning_vip_bps === "number" ? d.returning_vip_bps : 0,
    visit_mechanism: d.visit_mechanism === "discount" ? "discount" : "cashback",
  };
}

export type VoucherPrices = {
  currencies: string[];
  fee_bps: number;
  vouchers: VoucherPriceRow[];
  currency_list: CurrencyRow[];
  unsupported: { region: string; why: string }[];
  /** Null when the server couldn't read them. */
  cashback_defaults: CashbackDefaults | null;
};

export async function getVoucherPrices(): Promise<ActionResult<VoucherPrices>> {
  const r = await efInvoke<VoucherPrices>("admin-web-get-voucher-prices", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, currencies: r.data.currencies ?? [], fee_bps: r.data.fee_bps ?? 0, vouchers: r.data.vouchers ?? [], currency_list: r.data.currency_list ?? [], unsupported: r.data.unsupported ?? [], cashback_defaults: readDefaults(r.data.cashback_defaults) };
}

/** MESITA-4700: save the cashback defaults every place without its own lines reads. */
export async function saveCashbackDefaults(d: CashbackDefaults): Promise<ActionResult<{ cashback_defaults: CashbackDefaults }>> {
  const r = await efInvoke<{ cashback_defaults: CashbackDefaults }>("admin-web-save-cashback-defaults", d);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, cashback_defaults: readDefaults(r.data.cashback_defaults)! };
}
