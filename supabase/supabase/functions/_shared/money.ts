// Money constants and arithmetic (MESITA-3302). Server only: clients never
// compute a price, a bonus, a fee or cashback; they show what an EF answered.
//
// Mesita's fee is the application fee on a direct charge on the place's
// connected account; the place pays Stripe. Cashback is credit at the place,
// never cash. Every number is integer centavos; a rate is basis points,
// rounded down.

import type { MoneyVoucherKey } from "./money-state.ts";

/** Mesita's fee on a voucher purchase and on the card part of a payment,
 *  in basis points. 5% each [estimated: open with owners, MESITA-3273];
 *  changing one is a PR, never a knob. */
export const MESITA_FEE_BPS_VOUCHER = 500;
export const MESITA_FEE_BPS_PAYMENT = 500;

/** Payments Cashback: one standard rate (Pato, 2026-11-06), on the card part
 *  of a payment, never on credit spent, tips or voucher purchases. */
export const CASHBACK_BPS = 500;

/** The one currency the ledger sells in today. */
export const MONEY_CURRENCY = "mxn";

/** Stripe's minimum for a direct charge, per currency [estimated MX$10,
 *  confirm on MESITA-3280]. */
export const MIN_CHARGE_CENTS: Record<string, number> = { mxn: 10_00 };

/** `cents * bps / 10000`, rounded down to the cent. */
export function bps(cents: number, rateBps: number): number {
  return Math.floor((cents * rateBps) / 10000);
}

export type VoucherEntry = {
  /** What the guest pays, in centavos. */
  price_cents: number;
  /** The bonus on top, in basis points of the price. */
  bonus_bps: number;
  /** Open vouchers are bought in advance; earned ones are given on a rule. */
  kind: "open" | "earned";
  /** How long after the charge the credit turns Available. */
  available_after_sec: number;
};

/** The catalog, versioned by PR (MESITA-3272 gate: MX$200 +10%, MX$1,000
 *  +20%, MX$5,000 +30%; Welcome, Story and VIP at MX$100 +30%). Every
 *  voucher's credit turns Available one hour after the charge except Story,
 *  ready at once (Pato, MESITA-3323: "Prepayments must be one [hour] before
 *  the bill. All but the Instagram one"; Welcome and VIP were instant from
 *  MESITA-3302 until then). */
export const VOUCHER_CATALOG: Record<MoneyVoucherKey, VoucherEntry> = {
  voucher_200: { price_cents: 200_00, bonus_bps: 1000, kind: "open", available_after_sec: 3600 },
  voucher_1000: { price_cents: 1_000_00, bonus_bps: 2000, kind: "open", available_after_sec: 3600 },
  voucher_5000: { price_cents: 5_000_00, bonus_bps: 3000, kind: "open", available_after_sec: 3600 },
  voucher_welcome: { price_cents: 100_00, bonus_bps: 3000, kind: "earned", available_after_sec: 3600 },
  voucher_story: { price_cents: 100_00, bonus_bps: 3000, kind: "earned", available_after_sec: 0 },
  voucher_vip: { price_cents: 100_00, bonus_bps: 3000, kind: "earned", available_after_sec: 3600 },
};

export function voucherBonusCents(key: MoneyVoucherKey): number {
  const v = VOUCHER_CATALOG[key];
  return bps(v.price_cents, v.bonus_bps);
}

export function voucherFeeCents(key: MoneyVoucherKey): number {
  return bps(VOUCHER_CATALOG[key].price_cents, MESITA_FEE_BPS_VOUCHER);
}

/** The best bonus among the vouchers a place sells now, as a whole percent
 *  for the Home tile's one line ("Up to 30% extra credit", MESITA-3312);
 *  null when it sells none. The client prints it, never computes it. */
export function vouchersUpToPct(sell: readonly MoneyVoucherKey[]): number | null {
  let best = 0;
  for (const key of sell) best = Math.max(best, VOUCHER_CATALOG[key].bonus_bps);
  return best > 0 ? Math.floor(best / 100) : null;
}
