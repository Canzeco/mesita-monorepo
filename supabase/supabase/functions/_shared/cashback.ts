// Cashback (MESITA-4698, Pato 2026-11-22: "Welcome Universal · Returning
// Regular · Returning VIP ... EASY PEASY"). Docs › Credits, the MESITA-4698
// section.
//
// A paid bill earns credit at the place: one of three lines, each Off · 5 ·
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

export type CashbackLine = "welcome" | "regular" | "vip";

export type CashbackRates = {
  welcome_bps: number;
  regular_bps: number;
  vip_bps: number;
  cap_cents: number;
};

/** No row: the defaults 10 / 5 / 10 %, MX$200 (the SQL defaults too). */
export const CASHBACK_DEFAULTS: CashbackRates = {
  welcome_bps: 1000,
  regular_bps: 500,
  vip_bps: 1000,
  cap_cents: 20000,
};

export function isCashbackBps(v: unknown): v is CashbackBps {
  return typeof v === "number" && (CASHBACK_STEPS_BPS as readonly number[]).includes(v);
}

/** The owner's save: every field present and allowed, or why not. Pure. */
export function readCashbackInput(body: Record<string, unknown>): { ok: true; rates: CashbackRates } | { ok: false; error: string } {
  const { welcome_bps, regular_bps, vip_bps, cap_cents } = body;
  if (!isCashbackBps(welcome_bps) || !isCashbackBps(regular_bps) || !isCashbackBps(vip_bps)) {
    return { ok: false, error: "Each rate must be Off, 5%, 10%, 15% or 20%" };
  }
  if (typeof cap_cents !== "number" || !Number.isInteger(cap_cents) || cap_cents < 0 || cap_cents > CASHBACK_CAP_MAX_CENTS) {
    return { ok: false, error: "The cap must be a whole amount from 0 to 10,000" };
  }
  return { ok: true, rates: { welcome_bps, regular_bps, vip_bps, cap_cents } };
}

/** Which line a bill falls in: Welcome when the guest has no earlier paid
 *  bill here, else the guest's Class. Pure (mirrors the SQL). */
export function cashbackLine(args: { firstBill: boolean; guestClass: string | null | undefined }): CashbackLine {
  if (args.firstBill) return "welcome";
  return args.guestClass === "vip" ? "vip" : "regular";
}

export function rateFor(rates: CashbackRates, line: CashbackLine): number {
  return line === "welcome" ? rates.welcome_bps : line === "vip" ? rates.vip_bps : rates.regular_bps;
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
    .select("welcome_bps, regular_bps, vip_bps, cap_cents")
    .eq("place_id", placeId)
    .maybeSingle();
  if (error) throw new Error(`place_cashback_settings: ${error.message}`);
  return data ? (data as CashbackRates) : { ...CASHBACK_DEFAULTS };
}

/** Several places' lines at once, defaults filled in. */
export async function readCashbackRatesMany(admin: SupabaseClient, placeIds: string[]): Promise<Map<string, CashbackRates>> {
  const out = new Map<string, CashbackRates>();
  for (const id of placeIds) out.set(id, { ...CASHBACK_DEFAULTS });
  if (placeIds.length === 0) return out;
  const { data, error } = await admin
    .from("place_cashback_settings")
    .select("place_id, welcome_bps, regular_bps, vip_bps, cap_cents")
    .in("place_id", placeIds);
  if (error) throw new Error(`place_cashback_settings: ${error.message}`);
  for (const r of (data ?? []) as Array<CashbackRates & { place_id: string }>) {
    out.set(r.place_id, { welcome_bps: r.welcome_bps, regular_bps: r.regular_bps, vip_bps: r.vip_bps, cap_cents: r.cap_cents });
  }
  return out;
}

/** The guest's Class (consumers.guest_class), the server's fact; null when
 *  unread. */
export async function readGuestClass(admin: SupabaseClient, consumerId: string): Promise<string | null> {
  const { data, error } = await admin.from("consumers").select("guest_class").eq("id", consumerId).maybeSingle();
  if (error) throw new Error(`consumers: ${error.message}`);
  return (data?.guest_class as string | undefined) ?? null;
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
