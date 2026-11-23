// Cashback (MESITA-4698; two lines since MESITA-4709, Pato 2026-11-22: "no
// more VIP"). Docs › Credits, the MESITA-4698 section.
//
// A paid bill earns credit at the place: Welcome (the guest's first paid bill
// here, Off · 10 · 20 %) or Returning (every later bill, Off · 5 · 10 %;
// MESITA-4762), on the part not paid with credit (never the tip), Pending
// 1 hour (3 until MESITA-4717), only where Loyalty Cards is On. No ceiling and
// no once-a-day rule (Pato, 2026-11-23, MESITA-4728: "there is no ceiling for
// the cashback amount"): a bill earns once, on every peso paid by card or cash. The SQL trigger pay_tabs_grant_cashback
// (20261123010000_cashback_mvp) is the one writer; this file reads and
// validates the owner's lines and says what a bill would earn.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { VOUCHER_BONUS_STEPS_BPS, type VoucherBonusBps } from "./money.ts";

/** The rates an owner can pick, in basis points (0 = Off). TWO PICKS EACH
 *  (Pato, 2026-11-23, MESITA-4762: "welcome: 10% back or 20% back ·
 *  returning: 5% back or 10% back"). */
export const WELCOME_STEPS_BPS = [0, 1000, 2000] as const;
export const RETURNING_STEPS_BPS = [0, 500, 1000] as const;

export const CASHBACK_WAIT_SEC = 60 * 60;

export type CashbackLine = "welcome" | "returning";

/** MESITA-4770 (Pato, 2026-11-23: "SAME TIERS ... YOU JUST SET THE TIER. AND
 *  THEN THE MECHANISM FOR ALL YOUR VISIT TIERS"): how the Welcome / Returning
 *  lines pay out. "cashback" = credit for the next visit (needs Loyalty Cards
 *  On); "discount" = off this bill, worked out by pay_guest_begin. */
export const VISIT_MECHANISMS = ["cashback", "discount"] as const;
export type VisitMechanism = (typeof VISIT_MECHANISMS)[number];
export function isVisitMechanism(v: unknown): v is VisitMechanism {
  return typeof v === "string" && (VISIT_MECHANISMS as readonly string[]).includes(v);
}

/** What a printed bill's discount is, rounded down (mirrors pay_guest_begin;
 *  the tip is never part of the bill). Pure. */
export function discountCents(billCents: number, bps: number): number {
  if (bps <= 0 || billCents <= 0) return 0;
  return Math.floor((billCents * bps) / 10000);
}

export type CashbackRates = {
  welcome_bps: number;
  returning_bps: number;
  /** MESITA-4770: Discount or Cashback, for both lines. */
  visit_mechanism: VisitMechanism;
  /** MESITA-4714: what a verified Instagram story pays (Post), in cents:
   *  0 (Off) · 2000 · 4000. Lives beside the cashback lines. */
  story_reward_cents: number;
  /** MESITA-4762: the bonus each prepaid voucher gives here, in basis points:
   *  Small 10 · 20 %, Medium 20 · 40 %, Big 40 · 60 % (VOUCHER_BONUS_STEPS_BPS). */
  small_bonus_bps: number;
  medium_bonus_bps: number;
  big_bonus_bps: number;
};

/** MESITA-4714: the story rewards an owner can pick, in cents (0 = Off);
 *  MX$20 or MX$40 since MESITA-4762 (20 or 50 before). */
export const STORY_REWARD_STEPS_CENTS = [0, 2000, 4000] as const;

/** MESITA-4762: each voucher bonus field and its voucher. */
export const VOUCHER_BONUS_FIELDS = {
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

export function isStoryRewardCents(v: unknown): v is (typeof STORY_REWARD_STEPS_CENTS)[number] {
  return typeof v === "number" && (STORY_REWARD_STEPS_CENTS as readonly number[]).includes(v);
}

/** The columns every rates read selects. */
export const CASHBACK_RATE_COLUMNS = "welcome_bps, returning_bps, visit_mechanism, story_reward_cents, small_bonus_bps, medium_bonus_bps, big_bonus_bps";

/** The last fallback, 10 / 5 %: cashback_defaults' seed and
 *  place_cashback_rates' literals. The live defaults are that row (MESITA-4700). */
export const CASHBACK_DEFAULTS: CashbackRates = {
  welcome_bps: 1000,
  returning_bps: 500,
  visit_mechanism: "cashback",
  story_reward_cents: 2000,
  small_bonus_bps: VOUCHER_BONUS_STEPS_BPS.voucher_200[0],
  medium_bonus_bps: VOUCHER_BONUS_STEPS_BPS.voucher_1000[0],
  big_bonus_bps: VOUCHER_BONUS_STEPS_BPS.voucher_5000[0],
};

const isIn = (steps: readonly number[], v: unknown): v is number => typeof v === "number" && steps.includes(v);

/** The owner's save: the two visit rates present and allowed, or why not.
 *  Pure. `story_reward_cents` (MESITA-4714) and the voucher bonuses
 *  (MESITA-4762) are optional; absent, the saved value stays as it is. A
 *  `cap_cents` an older console still sends is ignored (MESITA-4728). */
export function readCashbackInput(
  body: Record<string, unknown>,
): { ok: true; rates: Pick<CashbackRates, "welcome_bps" | "returning_bps"> & Partial<CashbackRates> } | { ok: false; error: string } {
  const { welcome_bps, returning_bps, story_reward_cents, visit_mechanism } = body;
  if (!isIn(WELCOME_STEPS_BPS, welcome_bps)) return { ok: false, error: "Welcome must be Off, 10% or 20%" };
  if (!isIn(RETURNING_STEPS_BPS, returning_bps)) return { ok: false, error: "Returning must be Off, 5% or 10%" };
  if (story_reward_cents !== undefined && !isStoryRewardCents(story_reward_cents)) {
    return { ok: false, error: "The story reward must be Off, 20 or 40" };
  }
  if (visit_mechanism !== undefined && !isVisitMechanism(visit_mechanism)) {
    return { ok: false, error: "The visit offer must be Discount or Cashback" };
  }
  const rates: Pick<CashbackRates, "welcome_bps" | "returning_bps"> & Partial<CashbackRates> = {
    welcome_bps,
    returning_bps,
    ...(story_reward_cents !== undefined ? { story_reward_cents } : {}),
    ...(visit_mechanism !== undefined ? { visit_mechanism } : {}),
  };
  for (const [field, key] of Object.entries(VOUCHER_BONUS_FIELDS) as Array<[VoucherBonusField, keyof typeof VOUCHER_BONUS_STEPS_BPS]>) {
    const v = body[field];
    if (v === undefined) continue;
    if (!isIn(VOUCHER_BONUS_STEPS_BPS[key], v)) {
      return { ok: false, error: `${field} must be ${VOUCHER_BONUS_STEPS_BPS[key].map((b) => `${b / 100}%`).join(" or ")}` };
    }
    rates[field] = v;
  }
  return { ok: true, rates };
}

/** Which line a bill falls in: Welcome when the guest has no earlier paid
 *  bill here, else Returning. Pure (mirrors the SQL). */
export function cashbackLine(firstBill: boolean): CashbackLine {
  return firstBill ? "welcome" : "returning";
}

export function rateFor(rates: CashbackRates, line: CashbackLine): number {
  return line === "welcome" ? rates.welcome_bps : rates.returning_bps;
}

/** What a bill earns: the rate on the part not paid with credit (no tip),
 *  rounded down, no ceiling (MESITA-4728). Pure (mirrors pay_tab_grant_cashback). */
export function cashbackCents(rates: CashbackRates, line: CashbackLine, earnCents: number): number {
  const bps = rateFor(rates, line);
  if (bps <= 0 || earnCents <= 0) return 0;
  return Math.floor((earnCents * bps) / 10000);
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
 *  MESITA-4702, MESITA-4770): the two lines, the mechanism (Discount or
 *  Cashback), and the line this caller's next bill falls in (null signed
 *  out). Null where the read fails (logged; no rate beats a wrong one) or
 *  where Loyalty Cards is Off and the mechanism is cashback (no credit is
 *  born there); a discount needs no Credits Agreement. */
export async function placeCashbackFor(
  admin: SupabaseClient,
  args: { placeId: string; consumerId: string | null; livemode: boolean; loyaltyCards: boolean; who: string },
): Promise<(CashbackRates & { line: CashbackLine | null }) | null> {
  try {
    const [rates, firstBill] = await Promise.all([
      readCashbackRates(admin, args.placeId),
      args.consumerId ? readHasPaidBill(admin, args.consumerId, args.placeId, args.livemode).then((paid) => !paid) : Promise.resolve(null),
    ]);
    if (!args.loyaltyCards && rates.visit_mechanism !== "discount") return null;
    return { ...rates, line: firstBill === null ? null : cashbackLine(firstBill) };
  } catch (err) {
    console.error(`[${args.who}] cashback`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Whether this guest has a paid bill at this place (so Welcome is spent). */
export async function readHasPaidBill(admin: SupabaseClient, consumerId: string, placeId: string, livemode: boolean): Promise<boolean> {
  const { count, error } = await admin
    .from("pay_tabs")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .eq("place_id", placeId)
    .eq("livemode", livemode)
    .eq("status", "paid");
  if (error) throw new Error(`pay_tabs: ${error.message}`);
  return (count ?? 0) > 0;
}
