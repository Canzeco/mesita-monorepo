"use server";

// Admin › Payments (MESITA-3918): a thin wrapper over admin-web-get-voucher-prices.
// Read-only: the voucher catalog changes only in code (_shared/money.ts).

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

export type VoucherPrices = { currencies: string[]; fee_bps: number; vouchers: VoucherPriceRow[]; currency_list: CurrencyRow[] };

export async function getVoucherPrices(): Promise<ActionResult<VoucherPrices>> {
  const r = await efInvoke<VoucherPrices>("admin-web-get-voucher-prices", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, currencies: r.data.currencies ?? [], fee_bps: r.data.fee_bps ?? 0, vouchers: r.data.vouchers ?? [], currency_list: r.data.currency_list ?? [] };
}
