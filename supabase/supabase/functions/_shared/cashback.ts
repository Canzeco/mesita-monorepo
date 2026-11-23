// Cashback (MESITA-4698; three lines since MESITA-4766, Pato 2026-11-23: "NOW
// THE PAY OFFERS ARE Welcome Everyone, Returning Regular, Returning VIP").
// Docs › Credits, the MESITA-4698 section.
//
// A paid bill earns credit at the place: Welcome Everyone (the guest's first
// paid bill here, VIP or not, Off · 10 · 20 %), else Returning VIP for a VIP
// (Off · 10 · 20 %) or Returning Regular (Off · 5 · 10 %; MESITA-4762). Who is
// VIP for money is ONE SQL rule, consumer_is_vip_for_money (an invitation code,
// or a verified Instagram over 5,000 followers; live counts real followers
// only); this file asks it and never re-implements it. on the part not paid with credit (never the tip), Pending
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
/** MESITA-4766: Returning VIP, Off · 10 · 20 %. */
export const RETURNING_VIP_STEPS_BPS = [0, 1000, 2000] as const;

export const CASHBACK_WAIT_SEC = 60 * 60;

export type CashbackLine = "welcome" | "returning" | "returning_vip";

export type CashbackRates = {
  welcome_bps: number;
  returning_bps: number;
  /** MESITA-4766: a later bill by a VIP guest. */
  returning_vip_bps: number;
  /** MESITA-4762: the bonus each prepaid voucher gives here, in basis points:
   *  Small 10 · 20 %, Medium 20 · 40 %, Big 40 · 60 % (VOUCHER_BONUS_STEPS_BPS). */
  small_bonus_bps: number;
  medium_bonus_bps: number;
  big_bonus_bps: number;
};

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

/** The columns every rates read selects. */
export const CASHBACK_RATE_COLUMNS = "welcome_bps, returning_bps, returning_vip_bps, small_bonus_bps, medium_bonus_bps, big_bonus_bps";

/** The last fallback, 10 / 5 / 10 %: cashback_defaults' seed and
 *  place_cashback_rates' literals. The live defaults are that row (MESITA-4700). */
export const CASHBACK_DEFAULTS: CashbackRates = {
  welcome_bps: 1000,
  returning_bps: 500,
  returning_vip_bps: 1000,
  small_bonus_bps: VOUCHER_BONUS_STEPS_BPS.voucher_200[0],
  medium_bonus_bps: VOUCHER_BONUS_STEPS_BPS.voucher_1000[0],
  big_bonus_bps: VOUCHER_BONUS_STEPS_BPS.voucher_5000[0],
};

const isIn = (steps: readonly number[], v: unknown): v is number => typeof v === "number" && steps.includes(v);

/** The owner's save: Welcome and Returning Regular present and allowed, or
 *  why not. Pure. Returning VIP (MESITA-4766) and the voucher bonuses
 *  (MESITA-4762) are optional; absent, the saved value stays as it is. A
 *  `cap_cents` or `story_reward_cents` an older console still sends is
 *  ignored (MESITA-4728, MESITA-4766). */
export function readCashbackInput(
  body: Record<string, unknown>,
): { ok: true; rates: Pick<CashbackRates, "welcome_bps" | "returning_bps"> & Partial<CashbackRates> } | { ok: false; error: string } {
  const { welcome_bps, returning_bps, returning_vip_bps } = body;
  if (!isIn(WELCOME_STEPS_BPS, welcome_bps)) return { ok: false, error: "Welcome Everyone must be Off, 10% or 20%" };
  if (!isIn(RETURNING_STEPS_BPS, returning_bps)) return { ok: false, error: "Returning Regular must be Off, 5% or 10%" };
  if (returning_vip_bps !== undefined && !isIn(RETURNING_VIP_STEPS_BPS, returning_vip_bps)) {
    return { ok: false, error: "Returning VIP must be Off, 10% or 20%" };
  }
  const rates: Pick<CashbackRates, "welcome_bps" | "returning_bps"> & Partial<CashbackRates> = {
    welcome_bps,
    returning_bps,
    ...(returning_vip_bps !== undefined ? { returning_vip_bps } : {}),
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

/** Which line a bill falls in: Welcome Everyone when the guest has no
 *  earlier paid bill here (VIP or not), else Returning VIP for a VIP, else
 *  Returning Regular. Pure (mirrors pay_tab_grant_cashback); `vip` is
 *  consumer_is_vip_for_money's answer. */
export function cashbackLine(firstBill: boolean, vip = false): CashbackLine {
  if (firstBill) return "welcome";
  return vip ? "returning_vip" : "returning";
}

export function rateFor(rates: CashbackRates, line: CashbackLine): number {
  if (line === "welcome") return rates.welcome_bps;
  if (line === "returning_vip") return rates.returning_vip_bps;
  return rates.returning_bps;
}

/** The highest of the three lines ("Up to N% Back"). */
export function maxCashbackBps(rates: Pick<CashbackRates, "welcome_bps" | "returning_bps" | "returning_vip_bps">): number {
  return Math.max(rates.welcome_bps, rates.returning_bps, rates.returning_vip_bps);
}

/** MESITA-4766: whether this guest is paid as VIP, from the one SQL rule. */
export async function readIsVipForMoney(admin: SupabaseClient, consumerId: string, livemode: boolean): Promise<boolean> {
  const { data, error } = await admin.rpc("consumer_is_vip_for_money", { p_consumer: consumerId, p_livemode: livemode });
  if (error) throw new Error(`consumer_is_vip_for_money: ${error.message}`);
  return data === true;
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

/** A place's cashback as the guest screens read it (MESITA-4698, MESITA-4702,
 *  MESITA-4766): the three lines, and the line this caller's next bill falls in
 *  (null signed out). Null where Loyalty Cards is Off (no cashback is earned
 *  there) or the read fails (logged): no rate beats a wrong one. */
export async function placeCashbackFor(
  admin: SupabaseClient,
  args: { placeId: string; consumerId: string | null; livemode: boolean; loyaltyCards: boolean; who: string },
): Promise<(CashbackRates & { line: CashbackLine | null }) | null> {
  if (!args.loyaltyCards) return null;
  try {
    const [rates, firstBill, vip] = await Promise.all([
      readCashbackRates(admin, args.placeId),
      args.consumerId ? readHasPaidBill(admin, args.consumerId, args.placeId, args.livemode).then((paid) => !paid) : Promise.resolve(null),
      args.consumerId ? readIsVipForMoney(admin, args.consumerId, args.livemode) : Promise.resolve(false),
    ]);
    return { ...rates, line: firstBill === null ? null : cashbackLine(firstBill, vip) };
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
