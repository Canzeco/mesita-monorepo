// Cashback (MESITA-4698; two lines since MESITA-4709, Pato 2026-11-22: "no
// more VIP"). Docs › Credits, the MESITA-4698 section.
//
// A paid bill earns credit at the place: Welcome (the guest's first paid bill
// here) or Returning (every later bill), each Off · 5 ·
// 10 · 15 · 20 %, on the part not paid with credit (never the tip), capped
// per bill, Pending 3 hours, one per guest per place per Monterrey day, only
// where Loyalty Cards is On. The SQL trigger pay_tabs_grant_cashback
// (20261123010000_cashback_mvp) is the one writer; this file reads and
// validates the owner's lines and says what a bill would earn.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** The rates an owner can pick, in basis points (0 = Off). */
export const CASHBACK_STEPS_BPS = [0, 500, 1000, 1500, 2000] as const;
export type CashbackBps = (typeof CASHBACK_STEPS_BPS)[number];

/** The cap per bill an owner can type, in cents (MX$0 to MX$10,000). */
export const CASHBACK_CAP_MAX_CENTS = 1_000_000;

export const CASHBACK_WAIT_SEC = 3 * 60 * 60;

export type CashbackLine = "welcome" | "returning";

export type CashbackRates = {
  welcome_bps: number;
  returning_bps: number;
  cap_cents: number;
  /** MESITA-4714: what a verified Instagram story pays (Post), in cents:
   *  0 (Off) · 2000 · 5000. Lives beside the cashback lines. */
  story_reward_cents: number;
};

/** MESITA-4714: the story rewards an owner can pick, in cents (0 = Off). */
export const STORY_REWARD_STEPS_CENTS = [0, 2000, 5000] as const;

export function isStoryRewardCents(v: unknown): v is (typeof STORY_REWARD_STEPS_CENTS)[number] {
  return typeof v === "number" && (STORY_REWARD_STEPS_CENTS as readonly number[]).includes(v);
}

/** The columns every rates read selects. */
export const CASHBACK_RATE_COLUMNS = "welcome_bps, returning_bps, cap_cents, story_reward_cents";

/** The last fallback, 10 / 5 %, MX$200: cashback_defaults' seed and
 *  place_cashback_rates' literals. The live defaults are that row (MESITA-4700). */
export const CASHBACK_DEFAULTS: CashbackRates = {
  welcome_bps: 1000,
  returning_bps: 500,
  cap_cents: 20000,
  story_reward_cents: 2000,
};

export function isCashbackBps(v: unknown): v is CashbackBps {
  return typeof v === "number" && (CASHBACK_STEPS_BPS as readonly number[]).includes(v);
}

/** The owner's save: every field present and allowed, or why not. Pure.
 *  `story_reward_cents` (MESITA-4714) is optional, so a build from before
 *  Post still saves its lines; absent, the saved reward stays as it is. */
export function readCashbackInput(
  body: Record<string, unknown>,
): { ok: true; rates: Omit<CashbackRates, "story_reward_cents"> & { story_reward_cents?: number } } | { ok: false; error: string } {
  const { welcome_bps, returning_bps, cap_cents, story_reward_cents } = body;
  if (!isCashbackBps(welcome_bps) || !isCashbackBps(returning_bps)) {
    return { ok: false, error: "Each rate must be Off, 5%, 10%, 15% or 20%" };
  }
  if (typeof cap_cents !== "number" || !Number.isInteger(cap_cents) || cap_cents < 0 || cap_cents > CASHBACK_CAP_MAX_CENTS) {
    return { ok: false, error: "The cap must be a whole amount from 0 to 10,000" };
  }
  if (story_reward_cents !== undefined && !isStoryRewardCents(story_reward_cents)) {
    return { ok: false, error: "The story reward must be Off, 20 or 50" };
  }
  return {
    ok: true,
    rates: { welcome_bps, returning_bps, cap_cents, ...(story_reward_cents !== undefined ? { story_reward_cents } : {}) },
  };
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
 *  rounded down, capped. Pure (mirrors pay_tab_grant_cashback). */
export function cashbackCents(rates: CashbackRates, line: CashbackLine, earnCents: number): number {
  const bps = rateFor(rates, line);
  if (bps <= 0 || rates.cap_cents <= 0 || earnCents <= 0) return 0;
  return Math.min(Math.floor((earnCents * bps) / 10000), rates.cap_cents);
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
    out.set(r.place_id, { welcome_bps: r.welcome_bps, returning_bps: r.returning_bps, cap_cents: r.cap_cents, story_reward_cents: r.story_reward_cents });
  }
  return out;
}

/** A place's cashback as the guest screens read it (MESITA-4698, MESITA-4702):
 *  the two lines and the cap, and the line this caller's next bill falls in
 *  (null signed out). Null where Loyalty Cards is Off (no cashback is earned
 *  there) or the read fails (logged): no rate beats a wrong one. */
export async function placeCashbackFor(
  admin: SupabaseClient,
  args: { placeId: string; consumerId: string | null; livemode: boolean; loyaltyCards: boolean; who: string },
): Promise<(CashbackRates & { line: CashbackLine | null }) | null> {
  if (!args.loyaltyCards) return null;
  try {
    const [rates, firstBill] = await Promise.all([
      readCashbackRates(admin, args.placeId),
      args.consumerId ? readHasPaidBill(admin, args.consumerId, args.placeId, args.livemode).then((paid) => !paid) : Promise.resolve(null),
    ]);
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
