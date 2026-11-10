// Business › Payments (MESITA-3296): the place's Stripe Connect account and
// its money switches. Account layer only: no charge, voucher sale or cashback
// is written anywhere yet (MESITA-3272 holds that for the owner talks, the
// lawyer and the hand pilot).
//
// The posture (Main § 7, gate 2026-08-29): a PLATFORM, not a marketplace. The
// place is the merchant of record, pays Stripe's fees and gets the Express
// dashboard; Stripe bears losses and collects the requirements; Mesita never
// holds the money. Stripe allows Express with the place paying and Stripe
// liable only from API version 2026-06-24.preview (its Dahlia changelog), so
// the account create carries that version, env-overridable. If Stripe still
// refuses the pair, the account is created with no dashboard instead: the
// money posture is the law, the dashboard is a convenience.
//
// Test mode until Pato flips PAYMENTS_STRIPE_MODE (paymentsStripeKey); agents never do.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { paymentsLivemode, type StripeCall } from "./boost.ts";
import { moneyState, type MoneyVoucherKey } from "./money-state.ts";
import { vouchersUpToPct } from "./money.ts";

// ── Settings ───────────────────────────────────────────────────────────────

/** The owner's on/off switches, in Main §10's order (MESITA-3589).
 *  `pay_cards` is Mesita Payments (MESITA-3396; the key is never renamed:
 *  renaming resets live config). `house_credits` is House Credits (On only
 *  while a signed House Credits Contract exists: SQL refuses otherwise).
 *  `cash_payments` is Cash Payments (the waiter's Received; the set EF
 *  refuses On without the place code). `prepayments` is Mesita Prepayments
 *  (MESITA-3597): its own On/Off, needing House Credits (SQL) and a Stripe
 *  Account taking cards (the set EF). The six vouchers are its sub-switches
 *  (which vouchers it sells) and need House Credits On (SQL refuses
 *  otherwise). The old `cashback` switch moved into the two rates below. */
export const PAYMENT_KEYS = [
  "house_credits",
  "cash_payments",
  "pay_cards",
  "prepayments",
  "voucher_200",
  "voucher_1000",
  "voucher_5000",
  "voucher_welcome",
  "voucher_story",
  "voucher_vip",
] as const;
export type PaymentKey = (typeof PAYMENT_KEYS)[number];

/** The settings that need the place's Stripe account to take cards before
 *  they turn On (MESITA-3599): Mesita Payments, its Cashback-as-Credits,
 *  Mesita Prepayments (MESITA-3597) and its six vouchers. House Credits and Cash Payments never do. */
export const NEEDS_STRIPE_KEYS = [
  "pay_cards",
  "card_cashback_bps",
  "prepayments",
  "voucher_200",
  "voucher_1000",
  "voucher_5000",
  "voucher_welcome",
  "voucher_story",
  "voucher_vip",
] as const;
export function needsStripe(key: string): boolean {
  return (NEEDS_STRIPE_KEYS as readonly string[]).includes(key);
}

export function isPaymentKey(v: unknown): v is PaymentKey {
  return typeof v === "string" && (PAYMENT_KEYS as readonly string[]).includes(v);
}

/** The place's own cashback rates in bps (MESITA-3589): null = Off.
 *  Card: Mesita Payments Cashback. Cash: Cash Payments Cashback. */
export const RATE_KEYS = ["card_cashback_bps", "cash_cashback_bps"] as const;
export type RateKey = (typeof RATE_KEYS)[number];

export function isRateKey(v: unknown): v is RateKey {
  return typeof v === "string" && (RATE_KEYS as readonly string[]).includes(v);
}

/** The one rate each cashback may take when on (MESITA-3596, Pato: "OFF or
 *  2% and OFF or 5%"): Mesita Payments 5%, Cash Payments 2%. Off is null. */
export const CASHBACK_BPS: Record<RateKey, number> = { card_cashback_bps: 500, cash_cashback_bps: 200 };
export function isValidCashbackBps(key: RateKey, v: unknown): v is number {
  return v === CASHBACK_BPS[key];
}

/** Every column a settings read selects. */
export const SETTINGS_COLUMNS = [...PAYMENT_KEYS, ...RATE_KEYS].join(", ");

export type PaymentSettings = Record<PaymentKey, boolean> & Record<RateKey, number | null>;

/** No row = everything Off (MESITA-3599, Pato: "neither Mesita Pay nor
 *  Mesita Payments can be enabled without the Stripe Account"): Mesita Pay
 *  is On only when the row says `true`, which the set EF and SQL allow only
 *  once the place's Stripe account takes cards. */
export function settingsFromRow(row: Partial<Record<PaymentKey | RateKey, unknown>> | null): PaymentSettings {
  const out = {} as PaymentSettings;
  for (const k of PAYMENT_KEYS) out[k] = row?.[k] === true;
  for (const k of RATE_KEYS) {
    const v = row?.[k];
    out[k] = typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
  }
  return out;
}

export async function readSettings(admin: SupabaseClient, placeId: string): Promise<PaymentSettings> {
  const { data, error } = await admin.from("place_payment_settings").select(SETTINGS_COLUMNS)
    .eq("place_id", placeId).maybeSingle();
  if (error) throw new Error(`place_payment_settings: ${error.message}`);
  return settingsFromRow(data as Partial<Record<PaymentKey | RateKey, unknown>> | null);
}

/** The place's House Credits Contract, live or none (MESITA-3589). */
export const HOUSE_CREDITS_TERMS_VERSION = "draft-2026-11";
/** The exact text the owner is shown and agrees to (Pato, 2026-11-09: "JUST
 *  MAKE AN AGREE MODAL EXPLAINING NOTHING"); a lawyer's text replaces it and
 *  bumps the version before launch. Its sha256 is stored with the signature. */
export const HOUSE_CREDITS_TERMS_TEXT = "The full agreement will be added before launch.";

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export type ContractView = { signed: boolean; signed_at: string | null; terms_version: string | null };

export async function readContract(admin: SupabaseClient, placeId: string): Promise<ContractView> {
  const { data, error } = await admin.from("house_credits_contracts").select("signed_at, terms_version")
    .eq("place_id", placeId).is("ended_at", null).maybeSingle();
  if (error) throw new Error(`house_credits_contracts: ${error.message}`);
  const row = data as { signed_at?: string; terms_version?: string } | null;
  return { signed: !!row, signed_at: row?.signed_at ?? null, terms_version: row?.terms_version ?? null };
}

/** A place's Stripe state for the admin console (MESITA-3395), three values:
 *  `none` (no `place_payment_accounts` row, or only a row from the other
 *  Stripe mode, which this server cannot charge through), `onboarding` (a
 *  row in the server's mode that cannot charge yet, restricted included) and
 *  `charging` (`charges_enabled` in the server's mode). `charging` is the one
 *  rule the voucher sale and the guest Pay mark read (`offerFrom` in
 *  vouchers.ts, chargesEnabledByPlace below), so the admin filter, the
 *  "Stripe" general state and the guest list can never disagree. */
export type StripeState = "none" | "onboarding" | "charging";

export function stripeStateOf(
  row: { charges_enabled?: unknown; livemode?: unknown } | null | undefined,
  livemode: boolean,
): StripeState {
  if (!row || row.livemode !== livemode) return "none";
  return row.charges_enabled === true ? "charging" : "onboarding";
}

/** Every requested place's StripeState, from one read for all the ids, no
 *  chunking: the caller chunks when its page can be large. `null` when the
 *  read fails, so a caller can say "unknown" instead of a false "none". The
 *  row is a snapshot: only Business › Payments refreshes it until the
 *  Connect receiver (MESITA-3305) lands. */
export async function stripeStateByPlace(
  admin: SupabaseClient,
  ids: string[],
  livemode: boolean,
): Promise<Map<string, StripeState> | null> {
  const out = new Map<string, StripeState>();
  if (ids.length === 0) return out;
  const { data, error } = await admin.from("place_payment_accounts").select("place_id, charges_enabled, livemode").in("place_id", ids);
  if (error) {
    console.error(`[payments] accounts read (${ids.length} ids): ${error.message}`);
    return null;
  }
  const rows = new Map<string, { charges_enabled?: unknown; livemode?: unknown }>();
  for (const row of (data ?? []) as { place_id: string; charges_enabled?: unknown; livemode?: unknown }[]) rows.set(row.place_id, row);
  for (const id of ids) out.set(id, stripeStateOf(rows.get(id), livemode));
  return out;
}

/** Which of these places can take payments now (MESITA-3394): the places
 *  stripeStateByPlace reads `charging`. `null` when the read fails. Readers:
 *  the guest list rows (withVouchersUpTo) and the Wallet. */
export async function chargesEnabledByPlace(
  admin: SupabaseClient,
  ids: string[],
  livemode: boolean,
): Promise<Set<string> | null> {
  const states = await stripeStateByPlace(admin, ids, livemode);
  if (!states) return null;
  const out = new Set<string>();
  for (const [id, state] of states) if (state === "charging") out.add(id);
  return out;
}

/** THE OFFER BUTTON'S SLIDES (MESITA-3467, Pato: "a carousel of offers ...
 *  whatever offers the place is offering"): cashback on a card payment and
 *  the vouchers the place sells now, in moneyState's words. */
export type ListRowOffers = { cashback: boolean; card_cashback_bps: number; sell: MoneyVoucherKey[] };

/** THE HOME TILE'S VOUCHER LINE (MESITA-3312, Pato: "if the place offers
 *  voucher, draw the ... voucher icon at the bottom of the buttons") AND
 *  THE MESITA PAY MARK (MESITA-3321, Pato: "if the product is mesita pay
 *  ... put an extra icon in green"): on each row of a page,
 *  `vouchers_up_to_pct`, the best bonus among the vouchers moneyState says
 *  the place sells now, or null, `mesita_pay`, moneyState's mark
 *  (MESITA-3408), and `offers`, the offer button's slides (MESITA-3467). Two batched reads for the whole page (the switches and the
 *  accounts by id), never one per tile; a failed settings read reads as no
 *  row (nothing for sale; the mark follows the account), is logged, and the
 *  page still answers. */
export async function withVouchersUpTo<T extends { id: string }>(
  admin: SupabaseClient | null,
  places: T[],
): Promise<(T & { vouchers_up_to_pct: number | null; mesita_pay: boolean; offers: ListRowOffers })[]> {
  const ids = places.map((p) => p.id);
  if (ids.length === 0) return [];
  // No admin client (a run with no service key): nothing for sale, no line.
  if (!admin) return places.map((p) => ({ ...p, vouchers_up_to_pct: null, mesita_pay: false, offers: { cashback: false, card_cashback_bps: 0, sell: [] } }));
  // One list page of ids, so no chunking. The account read is the shared
  // in-mode rule (MESITA-3394); a failed read reads as no Pay, as before.
  const [settingsRes, charging] = await Promise.all([
    admin.from("place_payment_settings").select(`place_id, ${SETTINGS_COLUMNS}`).in("place_id", ids),
    chargesEnabledByPlace(admin, ids, paymentsLivemode()),
  ]);
  if (settingsRes.error) {
    console.error("[payments] settings_read_failed", JSON.stringify({ code: settingsRes.error.code, message: settingsRes.error.message, places: ids.length }));
  }
  // via unknown: a template-string select widens `data` to supabase-js's
  // GenericStringError union, as in get-place.
  const settingRows = (settingsRes.error ? [] : settingsRes.data ?? []) as unknown as ({ place_id: string } & Partial<Record<PaymentKey | RateKey, unknown>>)[];
  const settings = new Map<string, PaymentSettings>();
  for (const row of settingRows) settings.set(row.place_id, settingsFromRow(row));
  const charges = charging ?? new Set<string>();
  return places.map((p) => {
    const { sell, mesita_pay, cashback, card_cashback_bps } = listRowMoney(settings.get(p.id), charges.has(p.id));
    return { ...p, vouchers_up_to_pct: vouchersUpToPct(sell), mesita_pay, offers: { cashback, card_cashback_bps, sell } };
  });
}

/** One list row's money, pure: what sells and whether the mark shows. A
 *  place with no settings row reads as `settingsFromRow(null)`. */
export function listRowMoney(
  settings: PaymentSettings | undefined,
  charges: boolean,
): { sell: MoneyVoucherKey[]; mesita_pay: boolean; cashback: boolean; card_cashback_bps: number } {
  const state = moneyState(settings ?? settingsFromRow(null), charges ? { charges_enabled: true } : null, null);
  return { sell: state.sell, mesita_pay: state.mesita_pay, cashback: state.cashback, card_cashback_bps: state.card_cashback_bps };
}

// ── The account ────────────────────────────────────────────────────────────

/** The controller Stripe keeps on the account for good. Frozen by payments.test.ts. */
export const CONNECT_CONTROLLER = {
  stripe_dashboard: { type: "express" },
  fees: { payer: "account" },
  losses: { payments: "stripe" },
  requirement_collection: "stripe",
} as const;

/** The same posture with no dashboard: Stripe's GA pair when the preview
 *  version above is refused. */
export const CONNECT_CONTROLLER_NO_DASHBOARD = { ...CONNECT_CONTROLLER, stripe_dashboard: { type: "none" } } as const;

export const CONNECT_CAPABILITIES = { card_payments: { requested: true }, transfers: { requested: true } } as const;

/** The first API version that takes Express + fees.payer=account + losses.payments=stripe. */
export const CONNECT_API_VERSION = "2026-06-24.preview";

export function connectApiVersion(read: (name: string) => string | undefined = (n) => Deno.env.get(n)): string {
  const override = (read("STRIPE_CONNECT_API_VERSION") ?? "").trim();
  return override || CONNECT_API_VERSION;
}

/** Stripe's refusal of the Express pair reads like this; anything else is not retried. */
export function isDashboardPairRefusal(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("stripe_dashboard") || m.includes("liable") || m.includes("collect fees");
}

export const CONNECT_COUNTRIES = ["MX", "US"] as const;
export type ConnectCountry = (typeof CONNECT_COUNTRIES)[number];
export function isConnectCountry(v: unknown): v is ConnectCountry {
  return typeof v === "string" && (CONNECT_COUNTRIES as readonly string[]).includes(v);
}

export type AccountRow = {
  place_id: string;
  stripe_account_id: string;
  livemode: boolean;
  account_country: string | null;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  requirements_due: string[];
  disabled_reason: string | null;
  /** MESITA-3461: Mesita's fee invoice is unpaid: card payments are off
   *  here until it is paid (never the owner's pay_cards switch). */
  fee_hold?: boolean;
};

export const ACCOUNT_COLUMNS =
  "place_id, stripe_account_id, livemode, account_country, charges_enabled, details_submitted, payouts_enabled, requirements_due, disabled_reason, fee_hold";

/** What Stripe's Account object says, as the row stores it. */
export function snapshotFromStripe(account: Record<string, unknown>, livemode: boolean): Omit<AccountRow, "place_id" | "stripe_account_id"> {
  const req = (account.requirements ?? {}) as { currently_due?: unknown; disabled_reason?: unknown };
  return {
    livemode,
    account_country: typeof account.country === "string" ? account.country : null,
    charges_enabled: account.charges_enabled === true,
    details_submitted: account.details_submitted === true,
    payouts_enabled: account.payouts_enabled === true,
    requirements_due: Array.isArray(req.currently_due) ? req.currently_due.filter((r): r is string => typeof r === "string") : [],
    disabled_reason: typeof req.disabled_reason === "string" ? req.disabled_reason : null,
  };
}

/** The one word the page shows for the account. */
export type AccountState = "none" | "onboarding" | "ready" | "restricted";

export function accountState(row: Pick<AccountRow, "charges_enabled" | "details_submitted" | "disabled_reason"> | null): AccountState {
  if (!row) return "none";
  if (row.charges_enabled) return "ready";
  if (row.details_submitted || row.disabled_reason) return "restricted";
  return "onboarding";
}

/** Place Stripe, the seven values of Main §10 (MESITA-3589), from the row
 *  alone: None · Onboarding · In review · Connected · Action needed ·
 *  Payouts paused · Restricted. Cards work in connected, action_needed and
 *  payouts_paused. */
export type StripeStage = "none" | "onboarding" | "in_review" | "connected" | "action_needed" | "payouts_paused" | "restricted";

export function stripeStage(
  row: Pick<AccountRow, "charges_enabled" | "details_submitted" | "disabled_reason" | "payouts_enabled" | "requirements_due"> | null,
): StripeStage {
  if (!row) return "none";
  if (!row.charges_enabled) {
    if (!row.details_submitted) return "onboarding";
    // Stripe is still checking what the owner sent: nothing to do but wait.
    const r = row.disabled_reason;
    if (!r || r === "requirements.pending_verification" || r === "under_review") return "in_review";
    return "restricted";
  }
  if (!row.payouts_enabled) return "payouts_paused";
  if ((row.requirements_due ?? []).length > 0) return "action_needed";
  return "connected";
}

/** What the page gets: never the account id, never Stripe's own words. */
export function accountView(row: AccountRow | null) {
  return {
    state: accountState(row),
    stage: stripeStage(row),
    livemode: row?.livemode ?? false,
    country: row?.account_country ?? null,
    charges_enabled: row?.charges_enabled ?? false,
    payouts_enabled: row?.payouts_enabled ?? false,
    details_submitted: row?.details_submitted ?? false,
    requirements_due: row?.requirements_due.length ?? 0,
  };
}
export type AccountView = ReturnType<typeof accountView>;

export async function readAccount(admin: SupabaseClient, placeId: string): Promise<AccountRow | null> {
  const { data, error } = await admin.from("place_payment_accounts").select(ACCOUNT_COLUMNS).eq("place_id", placeId).maybeSingle();
  if (error) throw new Error(`place_payment_accounts: ${error.message}`);
  return (data as AccountRow | null) ?? null;
}

/** Re-reads the account from Stripe and stores what it says. A row from the
 *  other universe (the key flipped) is left as it is and reported as it was. */
export async function refreshAccount(admin: SupabaseClient, stripe: StripeCall, row: AccountRow, livemode: boolean): Promise<AccountRow> {
  if (row.livemode !== livemode) return row;
  const account = await stripe("GET", `accounts/${row.stripe_account_id}`);
  const snapshot = snapshotFromStripe(account, livemode);
  const { error } = await admin.from("place_payment_accounts").update(snapshot).eq("place_id", row.place_id);
  if (error) throw new Error(`place_payment_accounts: ${error.message}`);
  return { ...row, ...snapshot };
}

/** What the hosted onboarding is told before the owner types anything. */
export function accountCreateParams(args: { placeId: string; country: ConnectCountry; name: string | null; website: string | null; email: string | null }) {
  const profile: Record<string, unknown> = { mcc: "5812" };
  if (args.name) profile.name = args.name.slice(0, 100);
  if (args.website && /^https:\/\//i.test(args.website)) profile.url = args.website;
  return {
    country: args.country,
    capabilities: CONNECT_CAPABILITIES,
    business_profile: profile,
    ...(args.email ? { email: args.email } : {}),
    metadata: { place_id: args.placeId },
  };
}
