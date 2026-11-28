// Cashback (MESITA-4698). ONE LINE SINCE MESITA-5124 (Pato, 2026-11-28: "Just
// one cashback. and the welcome thing is the voucher, not the visit"). Two
// lines, Welcome and Returning, from MESITA-5072. Docs › Credits.
//
// A paid bill earns credit at the place at ONE rate, the first bill here
// like every later one: Off · 5 %, and 10 % only where the Small voucher's
// bonus is +20 %, so every voucher bonus beats Cashback. The rate lives in
// `returning_bps` and a new bill's line is "returning" (a renamed key resets
// live config). `welcome_bps` and the VIP columns stay (old receipts name
// welcome / welcome_vip / returning_vip) and hold 0; every save writes 0.
// The Welcome offer is the Welcome voucher (money.ts), its bonus the place's
// pick in `welcome_bonus_bps`. Earned on the part not paid with credit (never the tip), Pending
// 1 hour (3 until MESITA-4717), only where Loyalty Cards is On. At most MX$1,000
// a bill (MESITA-4831) and no once-a-day rule (MESITA-4728): a bill earns once, on every peso paid by card or cash. The SQL trigger pay_tabs_grant_cashback
// (20261123010000_cashback_mvp) is the one writer; this file reads and
// validates the owner's lines and says what a bill would earn.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { VOUCHER_BONUS_STEPS_BPS, type VoucherBonusBps } from "./money.ts";

/** The rates an owner can pick, in basis points (0 = Off). TWO PICKS EACH
 *  (Pato, 2026-11-23, MESITA-4762: "welcome: 10% back or 20% back ·
 *  returning: 5% back or 10% back"). */
/** Retired (MESITA-5124): Welcome is a voucher, so its cashback line is 0. */
export const WELCOME_STEPS_BPS = [0] as const;
/** The one Cashback rate (MESITA-5124), stored as returning_bps. */
export const RETURNING_STEPS_BPS = [0, 500, 1000] as const;
/** MESITA-5072: Returning's 10 % step needs the Small bonus at this rate. */
export const RETURNING_TOP_BPS = 1000;
export const RETURNING_TOP_NEEDS_SMALL_BPS = 2000;

export const CASHBACK_WAIT_SEC = 60 * 60;
/** MESITA-4831: the most one bill earns (SQL: visit_cashback_cap_cents). */
export const CASHBACK_CAP_CENTS = 100_000;

/** The line a bill falls in. The VIP two are retired (MESITA-5072): no new
 *  bill falls in them; a receipt from before still names them. */
export type CashbackLine = "welcome" | "welcome_vip" | "returning" | "returning_vip";

export type CashbackRates = {
  /** Retired (MESITA-5124): always 0; kept so old readers still parse. */
  welcome_bps: number;
  /** The one Cashback rate, every bill (MESITA-5124). */
  returning_bps: number;
  /** Retired (MESITA-5072): always 0; kept so old readers still parse. */
  returning_vip_bps: number;
  /** Retired (MESITA-5072): always 0. */
  welcome_vip_bps: number;
  /** MESITA-4762: the bonus each prepaid voucher gives here, in basis points:
   *  Small 10 · 20 %, Medium 20 · 40 %, Big 30 · 60 % (VOUCHER_BONUS_STEPS_BPS,
   *  Big's default 30% since MESITA-4980). */
  small_bonus_bps: number;
  medium_bonus_bps: number;
  big_bonus_bps: number;
  /** MESITA-5124: the Welcome voucher's bonus here, 30 · 60 %. */
  welcome_bonus_bps: number;
};

/** MESITA-4762: each voucher bonus field and its voucher. */
export const VOUCHER_BONUS_FIELDS = {
  welcome_bonus_bps: "voucher_welcome",
  small_bonus_bps: "voucher_200",
  medium_bonus_bps: "voucher_1000",
  big_bonus_bps: "voucher_5000",
} as const;
type VoucherBonusField = keyof typeof VOUCHER_BONUS_FIELDS;

/** The place's picks as the voucher catalog reads them. */
export function voucherBonusFrom(r: Partial<Pick<CashbackRates, VoucherBonusField>> | null | undefined): VoucherBonusBps {
  const out: VoucherBonusBps = {};
  if (!r) return out;
  for (const [field, key] of Object.entries(VOUCHER_BONUS_FIELDS) as Array<[VoucherBonusField, keyof typeof VOUCHER_BONUS_STEPS_BPS]>) {
    if (typeof r[field] === "number") out[key] = r[field];
  }
  return out;
}

/** The columns every rates read selects. */
export const CASHBACK_RATE_COLUMNS = "welcome_bps, welcome_vip_bps, returning_bps, returning_vip_bps, small_bonus_bps, medium_bonus_bps, big_bonus_bps, welcome_bonus_bps";

/** The last fallback, 5 %: cashback_defaults' seed and
 *  place_cashback_rates' literal. The live defaults are that row (MESITA-4700). */
export const CASHBACK_DEFAULTS: CashbackRates = {
  welcome_bps: 0,
  returning_bps: 500,
  returning_vip_bps: 0,
  welcome_vip_bps: 0,
  welcome_bonus_bps: VOUCHER_BONUS_STEPS_BPS.voucher_welcome[0],
  small_bonus_bps: VOUCHER_BONUS_STEPS_BPS.voucher_200[0],
  medium_bonus_bps: VOUCHER_BONUS_STEPS_BPS.voucher_1000[0],
  big_bonus_bps: VOUCHER_BONUS_STEPS_BPS.voucher_5000[0],
};

const isIn = (steps: readonly number[], v: unknown): v is number => typeof v === "number" && steps.includes(v);

/** The owner's save: the one Cashback rate (`returning_bps`) present and
 *  allowed, or why not. Pure. The voucher bonuses (MESITA-4762, Welcome's
 *  since MESITA-5124) are optional; absent, the saved value stays as it is.
 *  Cashback 10 % needs Small at +20 % (this save's, else `saved`'s;
 *  MESITA-5072). A `welcome_bps` an older console still sends is ignored:
 *  every save writes Welcome 0 (MESITA-5124). A VIP rate is refused unless
 *  0, and every save writes both VIP columns 0. A `cap_cents` or
 *  `story_reward_cents` an older console still sends is ignored
 *  (MESITA-4728, MESITA-4766), and so is a `visit_mechanism`: the visit
 *  lines pay out as Cashback only (MESITA-5076). */
export function readCashbackInput(
  body: Record<string, unknown>,
  saved?: Pick<CashbackRates, "small_bonus_bps"> | null,
): { ok: true; rates: Pick<CashbackRates, "welcome_bps" | "returning_bps"> & Partial<CashbackRates> } | { ok: false; error: string } {
  const { returning_bps, returning_vip_bps, welcome_vip_bps } = body;
  if (!isIn(RETURNING_STEPS_BPS, returning_bps)) return { ok: false, error: "Cashback must be Off, 5% or 10%" };
  if ((returning_vip_bps !== undefined && returning_vip_bps !== 0) || (welcome_vip_bps !== undefined && welcome_vip_bps !== 0)) {
    return { ok: false, error: "VIP cashback is gone: a VIP guest earns Cashback like everyone" };
  }
  const rates: Pick<CashbackRates, "welcome_bps" | "returning_bps"> & Partial<CashbackRates> = {
    welcome_bps: 0,
    returning_bps,
    returning_vip_bps: 0,
    welcome_vip_bps: 0,
  };
  for (const [field, key] of Object.entries(VOUCHER_BONUS_FIELDS) as Array<[VoucherBonusField, keyof typeof VOUCHER_BONUS_STEPS_BPS]>) {
    const v = body[field];
    if (v === undefined) continue;
    if (!isIn(VOUCHER_BONUS_STEPS_BPS[key], v)) {
      return { ok: false, error: `${field} must be ${VOUCHER_BONUS_STEPS_BPS[key].map((b) => `${b / 100}%`).join(" or ")}` };
    }
    rates[field] = v;
  }
  if (!returningAllowed(returning_bps, rates.small_bonus_bps ?? saved?.small_bonus_bps)) {
    return { ok: false, error: "Cashback can be 10% only where the Small voucher's bonus is +20%" };
  }
  return { ok: true, rates };
}

/** MESITA-5072: Returning's 10 % step only where Small gives +20 %, so every
 *  voucher bonus beats Returning. An unknown Small never allows it. Pure. */
export function returningAllowed(returningBps: number, smallBonusBps: number | undefined): boolean {
  return returningBps !== RETURNING_TOP_BPS || smallBonusBps === RETURNING_TOP_NEEDS_SMALL_BPS;
}

/** The line a new bill falls in (MESITA-5124, one line): always
 *  "returning", a first bill here included. Pure (mirrors pay_bill_quote and
 *  pay_tab_grant_cashback). */
export function cashbackLine(): CashbackLine {
  return "returning";
}

export function rateFor(rates: CashbackRates, line: CashbackLine): number {
  if (line === "returning") return rates.returning_bps;
  // A retired line (Welcome, the VIP two) earns nothing new.
  return 0;
}

/** The place's one Cashback rate. */
export function maxCashbackBps(rates: Pick<CashbackRates, "returning_bps">): number {
  return Math.max(rates.returning_bps, 0);
}

/** What a bill earns: the rate on the part not paid with credit (no tip),
 *  rounded down, at most CASHBACK_CAP_CENTS a bill (MESITA-4831). Pure (mirrors pay_tab_grant_cashback). */
export function cashbackCents(rates: CashbackRates, line: CashbackLine, earnCents: number): number {
  const bps = rateFor(rates, line);
  if (bps <= 0 || earnCents <= 0) return 0;
  return Math.min(Math.floor((earnCents * bps) / 10000), CASHBACK_CAP_CENTS);
}

/** The place's lines now (its row, else the defaults). */
export async function readCashbackRates(admin: SupabaseClient, placeId: string): Promise<CashbackRates> {
  const { data, error } = await admin
    .from("place_cashback_settings")
    .select(CASHBACK_RATE_COLUMNS)
    .eq("place_id", placeId)
    .maybeSingle();
  if (error) throw new Error(`place_cashback_settings: ${error.message}`);
  return data ? (data as unknown as CashbackRates) : await readCashbackDefaults(admin);
}

/** MESITA-4700: the defaults an admin set (cashback_defaults, one row), what
 *  every place without its own lines reads; the code's literals when the row
 *  is missing (the same fallback as place_cashback_rates). */
export async function readCashbackDefaults(admin: SupabaseClient): Promise<CashbackRates> {
  const { data, error } = await admin
    .from("cashback_defaults")
    .select(CASHBACK_RATE_COLUMNS)
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(`cashback_defaults: ${error.message}`);
  return data ? (data as unknown as CashbackRates) : { ...CASHBACK_DEFAULTS };
}

/** Several places' lines at once, defaults filled in. */
export async function readCashbackRatesMany(admin: SupabaseClient, placeIds: string[]): Promise<Map<string, CashbackRates>> {
  const out = new Map<string, CashbackRates>();
  if (placeIds.length === 0) return out;
  const defaults = await readCashbackDefaults(admin);
  for (const id of placeIds) out.set(id, { ...defaults });
  const { data, error } = await admin
    .from("place_cashback_settings")
    .select(`place_id, ${CASHBACK_RATE_COLUMNS}`)
    .in("place_id", placeIds);
  if (error) throw new Error(`place_cashback_settings: ${error.message}`);
  for (const r of (data ?? []) as unknown as Array<CashbackRates & { place_id: string }>) {
    const { place_id, ...rates } = r;
    out.set(place_id, rates);
  }
  return out;
}

/** A place's visit offer as the guest screens read it (MESITA-4698,
 *  MESITA-4702): the rates and the line this caller's next bill falls in
 *  ("returning" for every signed-in guest since MESITA-5124; null signed
 *  out). Null where the read fails (logged; no rate beats a wrong one) or
 *  where Loyalty Cards is Off (no credit is born there). */
export async function placeCashbackFor(
  admin: SupabaseClient,
  args: { placeId: string; consumerId: string | null; livemode: boolean; loyaltyCards: boolean; who: string },
): Promise<(CashbackRates & { line: CashbackLine | null }) | null> {
  try {
    const rates = await readCashbackRates(admin, args.placeId);
    if (!args.loyaltyCards) return null;
    return { ...rates, line: args.consumerId ? cashbackLine() : null };
  } catch (err) {
    console.error(`[${args.who}] cashback`, err instanceof Error ? err.message : String(err));
    return null;
  }
}
