// Money constants and arithmetic (MESITA-3302). Server only: clients never
// compute a price, a bonus or a fee; they show what an EF answered.
//
// Mesita's fee is 5% of each direct charge on the place's connected account,
// billed to the place apart on a Stripe invoice (charge model d5a,
// MESITA-3461; the charge carries no application fee); the place pays Stripe.
// Every number is integer centavos; a rate is basis points,
// rounded down.

import type { MoneyVoucherKey } from "./money-state.ts";

/** Mesita's fee on a voucher purchase and on the card part of a payment,
 *  in basis points. 5% each [estimated: open with owners, MESITA-3273];
 *  changing one is a PR, never a knob. */
export const MESITA_FEE_BPS_VOUCHER = 500;
export const MESITA_FEE_BPS_PAYMENT = 500;

/** Outside bills one guest may open at one place in a rolling day (open,
 *  paid or refunded; cancelled and expired ones do not count). Estimated:
 *  Pato sets the number (MESITA-3545, folds MESITA-3553). The RPC
 *  wallet_open_outside_capped takes it as p_max_per_day. */
export const OUTSIDE_MAX_PER_DAY = 2;

/** The fallback currency when a place's is unknown. Each place's own is
 *  places.currency, set from its country (MESITA-3913). */
export const MONEY_CURRENCY = "mxn";

/** Stripe's minimum for a direct charge, per currency, in the ledger's
 *  hundredths [MX$10 estimated, confirm on MESITA-3280; the rest are
 *  Stripe's own floors, roughly half a US dollar]. */
export const MIN_CHARGE_CENTS: Record<string, number> = {
  mxn: 10_00, usd: 50, cad: 50, eur: 50, gbp: 30, brl: 50, jpy: 50_00, cop: 2_000_00, clp: 500_00, pen: 2_00,
};

/** EVERY LEDGER AMOUNT IS IN HUNDREDTHS (MESITA-3923), even for a currency
 *  with no cents: ¥1,000 is 100000 here, so every screen formats the same.
 *  Stripe wants yen and Chilean pesos in whole units, so the amount is
 *  converted only at the Stripe boundary, both ways. */
const ZERO_DECIMAL = new Set(["jpy", "clp"]);
export function isZeroDecimal(currency: string | null | undefined): boolean {
  return ZERO_DECIMAL.has((currency ?? "").toLowerCase());
}
/** A ledger amount as Stripe's `amount` (whole units for yen, rounded). */
export function toStripeAmount(cents: number, currency: string | null | undefined): number {
  return isZeroDecimal(currency) ? Math.round(cents / 100) : Math.round(cents);
}
/** Stripe's `amount` back in the ledger's hundredths. */
export function fromStripeAmount(amount: number, currency: string | null | undefined): number {
  return isZeroDecimal(currency) ? amount * 100 : amount;
}

/** A country's currency (MESITA-3913, all ten since MESITA-3923),
 *  lowercase as the ledger stores it. TWIN of public.currency_for_country. */
export const EUROZONE = ["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"] as const;
const COUNTRY_CURRENCY: Record<string, string> = {
  MX: "mxn", US: "usd", CA: "cad", GB: "gbp", BR: "brl", CO: "cop", CL: "clp", PE: "pen", JP: "jpy",
  ...Object.fromEntries(EUROZONE.map((c) => [c, "eur"])),
};
export function currencyForCountry(country: string | null | undefined): string | null {
  return country ? COUNTRY_CURRENCY[country.toUpperCase()] ?? null : null;
}

/** The Stripe Connect country for a place: its own country when it uses
 *  this currency, else the currency's home (EUR: Spain). */
const CURRENCY_HOME: Record<string, string> = {
  mxn: "MX", usd: "US", cad: "CA", gbp: "GB", brl: "BR", cop: "CO", clp: "CL", pen: "PE", jpy: "JP", eur: "ES",
};
export function countryForCurrency(currency: string | null | undefined, placeCountry?: string | null): string {
  const cur = (currency ?? "").toLowerCase();
  if (placeCountry && currencyForCountry(placeCountry) === cur) return placeCountry.toUpperCase();
  return CURRENCY_HOME[cur] ?? "MX";
}

/** The most one credit-only payment may ask for (MESITA-3304), MX$100,000
 *  [estimated]. An input guard against a typo, never a product limit: a
 *  guest cannot hold more credit than was bought, and the RPC refuses more
 *  than spendable anyway. Above it the EF answers 400 above_cap. */
export const MAX_PAYMENT_INPUT_CENTS = 100_000_00;

/** `cents * bps / 10000`, rounded down to the cent. */
export function bps(cents: number, rateBps: number): number {
  return Math.floor((cents * rateBps) / 10000);
}

/** The bonus's wait, every voucher (MESITA-4214). */
export const BONUS_WAIT_SEC = 3 * 60 * 60;

export type VoucherEntry = {
  /** What the guest pays, in centavos. */
  price_cents: number;
  /** The bonus on top, in basis points of the price. */
  bonus_bps: number;
  /** Open vouchers are bought in advance; earned ones are given on a rule. */
  kind: "open" | "earned";
  /** How long after the charge the BONUS turns Available; what the guest
   *  paid is Available at once (MESITA-4214). */
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
 *  before); voucher_5000 and Story stayed in this catalog for purchases already
 *  made but were off sale (money-state's NOT_YET_SELLABLE). WELCOME AND VIP
 *  ARE MX$100 +100% (Pato, MESITA-3835: "Welcome Voucher: $100 MX. 100%
 *  Bonus ... VIP Voucher: $100 MX. 100% Bonus."): pay MX$100, get MX$200.
 *  THE WAIT STAYS ONE HOUR for every voucher but Story (Pato, MESITA-3835:
 *  "they should actually land 1hr after payment"; 30 minutes was asked and
 *  taken back before merge). THREE SIZES (Pato, 2026-11-15, MESITA-4056:
 *  "$200MX +10% Small · $500MX +20% Medium · $1000MX +30% Big"): Small is
 *  2× the currency's base, Medium 5× and back on sale under the old
 *  voucher_5000 key (never bought), Big 10× at +30%. EACH KEY ITS OWN PRICE
 *  (Pato, 2026-11-16, MESITA-4152: "$200MX 10% Small · $1,000MX 20% Medium ·
 *  $5,000MX 30% Big"): Medium is voucher_1000 (MX$1,000 +20%, 10×), Big is
 *  voucher_5000 (MX$5,000 +30%, 50×). Purchases keep their stored amounts.
 *  YOUR MONEY NOW, THE BONUS IN 3 HOURS (Pato, 2026-11-17, MESITA-4214:
 *  "Pay now, get X right now, get Y in [3] hours"; Notion Main §8): every
 *  voucher, Welcome and Story included. What the guest paid is Available the
 *  moment it is credited (wallet_credit_purchase); available_after_sec is
 *  now the bonus's wait. A meal is shorter, so a bonus never pays the bill
 *  it was bought at. */
export const VOUCHER_CATALOG: Record<MoneyVoucherKey, VoucherEntry> = {
  voucher_200: { price_cents: 200_00, bonus_bps: 1000, kind: "open", available_after_sec: BONUS_WAIT_SEC },
  voucher_1000: { price_cents: 1_000_00, bonus_bps: 2000, kind: "open", available_after_sec: BONUS_WAIT_SEC },
  // THE OWNER PICKS THE BONUS (Pato, 2026-11-23, MESITA-4762: "small: 10%
  // 20% · mid 20 40 · big 40 60"): bonus_bps here is each size's default;
  // the place's pick lives on place_cashback_settings (VOUCHER_BONUS_STEPS_BPS).
  voucher_5000: { price_cents: 5_000_00, bonus_bps: 4000, kind: "open", available_after_sec: BONUS_WAIT_SEC },
  // WELCOME IS BACK (Pato, 2026-11-22, MESITA-4645: "RETURN THE WELCOME
  // BONUS"; gone 2026-11-21, MESITA-4636). Welcome's MX$100 lands with
  // its bonus in 3 hours (MESITA-4717); once per guest per place.
  voucher_welcome: { price_cents: 100_00, bonus_bps: 10000, kind: "earned", available_after_sec: BONUS_WAIT_SEC },
  // THE STORY VOUCHER IS GONE (Pato, 2026-11-22, MESITA-4641/4642); its
  // purchases keep their stored amounts.
  // VIP IS BACK (Pato, 2026-11-22, MESITA-4640): MESITA-4249's line, pay
  // MX$100, get MX$200; the bonus in 3 hours like every voucher.
  voucher_vip: { price_cents: 100_00, bonus_bps: 10000, kind: "earned", available_after_sec: BONUS_WAIT_SEC },
};

/** VOUCHERS IN TWO CURRENCIES (Pato, 2026-11-14, MESITA-3914: "100 MX
 *  10% · 1000 MX 20% · 10 USD 10% · 100 USD 20% ... all small must start
 *  with 1 and big be 10X that"). Each place sells in its own currency
 *  (places.currency, MESITA-3913); a currency missing here sells none. The
 *  bonus and the wait are the catalog's, the same everywhere. The Small
 *  voucher's key stays voucher_200 (a renamed key resets live config). */
export const VOUCHER_PRICE_CENTS: Record<string, Record<MoneyVoucherKey, number>> = {};
// Filled from VOUCHER_CURRENCY_LIST below (MESITA-3923; the three of MESITA-3943): Small
// 2× the base, Medium (voucher_5000) 5×, Big 10×, Welcome and VIP at the base
// (MESITA-4056, MESITA-4645).

/** THE TEN CURRENCIES (Pato, 2026-11-14, MESITA-3919: "make a list of all
 *  the currencies"): Small starts with 1, near half an inexpensive meal for
 *  one in that country; Big is 10× Small; VIP costs the
 *  Small price. Amounts in whole units (¥1,000, not cents). All ten sell
 *  (MESITA-3923), each only at places whose currency it is. */
// THREE SINCE MESITA-3943 (Pato, 2026-11-14: "just leave mex and usa and
// canada"): the launch countries. Europe, the UK and Japan wait (tax work:
// reverse-charge fee invoices, DAC7, voucher VAT); Brazil is outside Stripe's
// Managed Risk; Colombia, Chile and Peru have no Stripe accounts.
export const VOUCHER_CURRENCY_LIST: readonly { code: string; country: string; small: number }[] = [
  { code: "MXN", country: "Mexico", small: 100 },
  { code: "USD", country: "United States", small: 10 },
  { code: "CAD", country: "Canada", small: 10 },
];

/** Where vouchers and cards are not offered, and why (Admin › Payments). */
export const UNSUPPORTED_COUNTRIES: readonly { region: string; why: string }[] = [
  { region: "Euro countries, United Kingdom", why: "Not yet: VAT and platform-reporting work first" },
  { region: "Japan", why: "Not yet: consumption-tax work first" },
  { region: "Brazil", why: "Stripe's Managed Risk doesn't cover it" },
  { region: "Colombia, Chile, Peru, the rest of Latin America", why: "Stripe opens no accounts there" },
];
for (const r of VOUCHER_CURRENCY_LIST) {
  const s = r.small * 100;
  VOUCHER_PRICE_CENTS[r.code.toLowerCase()] = {
    voucher_welcome: s, voucher_200: s * 2, voucher_1000: s * 10, voucher_5000: s * 50, voucher_vip: s,
  };
}

/** The voucher's price in this currency, null where vouchers aren't sold. */
export function voucherPriceCents(key: MoneyVoucherKey, currency: string = MONEY_CURRENCY): number | null {
  return VOUCHER_PRICE_CENTS[currency.toLowerCase()]?.[key] ?? null;
}

/** MESITA-4762: the two bonuses an owner can pick per size, in basis points;
 *  the first is the default (VOUCHER_CATALOG's bonus_bps). */
export const VOUCHER_BONUS_STEPS_BPS = {
  voucher_200: [1000, 2000],
  voucher_1000: [2000, 4000],
  voucher_5000: [4000, 6000],
} as const;
export type PickedVoucherKey = keyof typeof VOUCHER_BONUS_STEPS_BPS;

/** A place's picked bonus per voucher, in basis points; a missing key reads
 *  the catalog's default. */
export type VoucherBonusBps = Partial<Record<MoneyVoucherKey, number>>;

/** The bonus this place gives on this voucher, in basis points. */
export function voucherBonusBps(key: MoneyVoucherKey, bonus?: VoucherBonusBps | null): number {
  return bonus?.[key] ?? VOUCHER_CATALOG[key].bonus_bps;
}

export function voucherBonusCents(key: MoneyVoucherKey, currency: string = MONEY_CURRENCY, bonus?: VoucherBonusBps | null): number {
  return bps(voucherPriceCents(key, currency) ?? 0, voucherBonusBps(key, bonus));
}

export function voucherFeeCents(key: MoneyVoucherKey, currency: string = MONEY_CURRENCY): number {
  return bps(voucherPriceCents(key, currency) ?? 0, MESITA_FEE_BPS_VOUCHER);
}

/** The best bonus among the vouchers a place sells now, as a whole percent
 *  for the Home tile's one line ("Up to 30% extra credit", MESITA-3312);
 *  null when it sells none. The client prints it, never computes it. */
export function vouchersUpToPct(sell: readonly MoneyVoucherKey[], bonus?: VoucherBonusBps | null): number | null {
  let best = 0;
  for (const key of sell) best = Math.max(best, voucherBonusBps(key, bonus));
  return best > 0 ? Math.floor(best / 100) : null;
}
