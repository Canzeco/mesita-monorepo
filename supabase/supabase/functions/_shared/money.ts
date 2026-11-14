// Money constants and arithmetic (MESITA-3302). Server only: clients never
// compute a price, a bonus, a fee or cashback; they show what an EF answered.
//
// Mesita's fee is 5% of each direct charge on the place's connected account,
// billed to the place apart on a Stripe invoice (charge model d5a,
// MESITA-3461; the charge carries no application fee); the place pays Stripe. Cashback is credit at the place,
// never cash. Every number is integer centavos; a rate is basis points,
// rounded down.

import type { MoneyVoucherKey } from "./money-state.ts";

/** Mesita's fee on a voucher purchase and on the card part of a payment,
 *  in basis points. 5% each [estimated: open with owners, MESITA-3273];
 *  changing one is a PR, never a knob. */
export const MESITA_FEE_BPS_VOUCHER = 500;
export const MESITA_FEE_BPS_PAYMENT = 500;

// Cashback has no constant here since MESITA-3589: each place switches its
// own (place_payment_settings.card_cashback_bps / cash_cashback_bps, Off or
// 5% card and Off or 2% cash since MESITA-3596, CASHBACK_BPS in payments.ts).
// moneyState turns
// them into what applies now; the EFs store it on the row at start/open and
// settle/Received/refund read the row, never the setting.

/** Outside bills one guest may open at one place in a rolling day (open,
 *  paid or refunded; cancelled and expired ones do not count). Estimated:
 *  Pato sets the number (MESITA-3545, folds MESITA-3553). The RPC
 *  wallet_open_outside_capped takes it as p_max_per_day. */
export const OUTSIDE_MAX_PER_DAY = 2;

/** A place's outside cashback over a rolling day, in centavos ($500MX).
 *  Past it a Received still confirms the bill, with what is left, or no
 *  cashback. Estimated: Pato sets it. TWIN of c_ceiling in
 *  wallet_confirm_outside (20261109130000_charge_tip_outside_path.sql);
 *  changing one is a migration plus this line. */
export const OUTSIDE_CASHBACK_DAILY_CEILING_CENTS = 50_000;

/** The one currency the ledger sells in today. */
export const MONEY_CURRENCY = "mxn";

/** Stripe's minimum for a direct charge, per currency [estimated MX$10,
 *  confirm on MESITA-3280]. */
export const MIN_CHARGE_CENTS: Record<string, number> = { mxn: 10_00 };

/** The most one credit-only payment may ask for (MESITA-3304), MX$100,000
 *  [estimated]. An input guard against a typo, never a product limit: a
 *  guest cannot hold more credit than was bought, and the RPC refuses more
 *  than spendable anyway. Above it the EF answers 400 above_cap. */
export const MAX_PAYMENT_INPUT_CENTS = 100_000_00;

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
 *  MESITA-3302 until then). WELCOME IS +50% (Pato, 2026-11-13, MESITA-3832:
 *  "set Welcome as 50% Bonus"; +30% until then): pay MX$100, get MX$150.
 *  FOUR ON SALE (Pato, 2026-11-13, MESITA-3834: "Welcome Voucher: $100MX.
 *  50% Bonus. Small Voucher: $200MX. 10% Bonus. Big Voucher: $1000MX. 20%
 *  Bonus. VIP Voucher: 50MX. 50% Bonus. KEEP IT LIKE THIS."): VIP is MX$50
 *  +50% (MX$100 +30% before); voucher_1000 is now called Big (Medium
 *  before); voucher_5000 and Story stay in this catalog for purchases already
 *  made but are off sale (money-state's NOT_YET_SELLABLE). WELCOME AND VIP
 *  ARE MX$100 +100% (Pato, MESITA-3835: "Welcome Voucher: $100 MX. 100%
 *  Bonus ... VIP Voucher: $100 MX. 100% Bonus."): pay MX$100, get MX$200.
 *  THE WAIT IS 30 MINUTES (Pato, MESITA-3835: "Update all the money
 *  landing. In 30 minutes, not 1 hr"): every voucher's credit, and every
 *  cashback (the wallet SQL), turns Available 30 minutes after the charge;
 *  Story still at once. */
export const VOUCHER_CATALOG: Record<MoneyVoucherKey, VoucherEntry> = {
  voucher_200: { price_cents: 200_00, bonus_bps: 1000, kind: "open", available_after_sec: 1800 },
  voucher_1000: { price_cents: 1_000_00, bonus_bps: 2000, kind: "open", available_after_sec: 1800 },
  voucher_5000: { price_cents: 5_000_00, bonus_bps: 3000, kind: "open", available_after_sec: 1800 },
  voucher_welcome: { price_cents: 100_00, bonus_bps: 10000, kind: "earned", available_after_sec: 1800 },
  voucher_story: { price_cents: 100_00, bonus_bps: 3000, kind: "earned", available_after_sec: 0 },
  voucher_vip: { price_cents: 100_00, bonus_bps: 10000, kind: "earned", available_after_sec: 1800 },
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
