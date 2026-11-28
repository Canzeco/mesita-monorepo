// Business › Payments (MESITA-3296): the place's Stripe Connect account and
// its money switches. Account layer only: no charge or voucher sale is
// written anywhere yet (MESITA-3272 holds that for the owner talks, the
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
import { moneyState, type MoneyVoucherKey } from "./money-state.ts";
import { readMoneyConfig } from "./money-config.ts";
import { type CashbackRates, maxCashbackBps, readCashbackRatesMany, voucherBonusFrom } from "./cashback.ts";
import { errorMessage } from "./errors.ts";
import { voucherBonusBps, vouchersUpToPct } from "./money.ts";
import { chunked, ID_CHUNK } from "./postgrest.ts";
import { paymentsLivemode, type StripeCall } from "./stripe.ts";

// ── Settings ───────────────────────────────────────────────────────────────

/** The owner's on/off switches, in Main §10's order (MESITA-3589).
 *  `pay_cards` is Mesita Payments (MESITA-3396; the key is never renamed:
 *  renaming resets live config). `loyalty_cards` is Loyalty Cards (On only
 *  while a signed Loyalty Cards Agreement exists: SQL refuses otherwise).
 *  `cash_payments` is Cash Payments (the waiter's Received; the set EF
 *  refuses On without the place code). `prepayments` is Mesita Prepayments
 *  (MESITA-3597): its own On/Off, needing Loyalty Cards (SQL) and a Stripe
 *  Account taking cards (the set EF). The six vouchers are its sub-switches
 *  (which vouchers it sells) and need Loyalty Cards On (SQL refuses
 *  otherwise). */
export const PAYMENT_KEYS = [
  // MESITA-3946: Accept Stripe Payments, over pay_cards and prepayments.
  "stripe_payments",
  "loyalty_cards",
  "cash_payments",
  "pay_cards",
  "prepayments",
  "voucher_welcome",
  "voucher_200",
  "voucher_1000",
  "voucher_5000",
  "voucher_vip",
] as const;
export type PaymentKey = (typeof PAYMENT_KEYS)[number];

/** The settings that need the place's Stripe account to take cards before
 *  they turn On (MESITA-3599): Mesita Payments,
 *  Mesita Prepayments (MESITA-3597) and its six vouchers. Loyalty Cards and Cash Payments never do. */
export const NEEDS_STRIPE_KEYS = [
  "pay_cards",
  "prepayments",
  "voucher_welcome",
  "voucher_200",
  "voucher_1000",
  "voucher_5000",
  "voucher_vip",
] as const;
export function needsStripe(key: string): boolean {
  return (NEEDS_STRIPE_KEYS as readonly string[]).includes(key);
}

export function isPaymentKey(v: unknown): v is PaymentKey {
  return typeof v === "string" && (PAYMENT_KEYS as readonly string[]).includes(v);
}

/** Every column a settings read selects. */
export const SETTINGS_COLUMNS = [...PAYMENT_KEYS].join(", ");

export type PaymentSettings = Record<PaymentKey, boolean>;

/** No row = everything Off (MESITA-3599, Pato: "neither Mesita Pay nor
 *  Mesita Payments can be enabled without the Stripe Account"): Mesita Payments
 *  is On only when the row says `true`, which the set EF and SQL allow only
 *  once the place's Stripe account takes cards. */
export function settingsFromRow(row: Partial<Record<PaymentKey, unknown>> | null): PaymentSettings {
  const out = {} as PaymentSettings;
  for (const k of PAYMENT_KEYS) out[k] = row?.[k] === true;
  // Accept Stripe Payments defaults On, as its column (MESITA-3946): only an
  // explicit false turns it off. The card switches under it still read Off.
  out.stripe_payments = row?.stripe_payments !== false;
  return out;
}

export async function readSettings(admin: SupabaseClient, placeId: string): Promise<PaymentSettings> {
  const { data, error } = await admin.from("place_payment_settings").select(SETTINGS_COLUMNS)
    .eq("place_id", placeId).maybeSingle();
  if (error) throw new Error(`place_payment_settings: ${error.message}`);
  return settingsFromRow(data as Partial<Record<PaymentKey, unknown>> | null);
}

/** The place's Loyalty Cards Agreement, live or none (MESITA-3589). */
export const LOYALTY_CARDS_TERMS_VERSION = "draft-2026-11";
/** The exact text the owner is shown and agrees to (Pato, 2026-11-09: "JUST
 *  MAKE AN AGREE MODAL EXPLAINING NOTHING"); a lawyer's text replaces it and
 *  bumps the version before launch. Its sha256 is stored with the signature. */
export const LOYALTY_CARDS_TERMS_TEXT = "The full agreement will be added before launch.";

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export type ContractView = { signed: boolean; signed_at: string | null; terms_version: string | null };

export async function readContract(admin: SupabaseClient, placeId: string): Promise<ContractView> {
  const { data, error } = await admin.from("loyalty_cards_contracts").select("signed_at, terms_version")
    .eq("place_id", placeId).is("ended_at", null).maybeSingle();
  if (error) throw new Error(`loyalty_cards_contracts: ${error.message}`);
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
 *  whatever offers the place is offering"): the vouchers the place sells
 *  now, in moneyState's words. */
/** MESITA-4702: cashback_pct is the place's highest cashback line where
 *  Loyalty Cards is On (null = none earned); cashback_flat says every line
 *  is that rate. The carousel's green "Pay · Up to N% Cashback" slide. */
/** ONE LINE SINCE MESITA-5124: cashback_pct and returning_pct are the place's
 *  one Cashback rate (null = none), cashback_flat is true wherever there is
 *  one, and welcome_pct is always null like the VIP two (MESITA-5072); the
 *  three are kept for older guest apps. */
export type ListRowOffers = {
  sell: MoneyVoucherKey[];
  cashback_pct: number | null;
  cashback_flat: boolean;
  welcome_pct: number | null;
  returning_pct: number | null;
  returning_vip_pct: number | null;
  /** Retired (MESITA-5072): always null. */
  welcome_vip_pct: number | null;
  /** MESITA-4764: each voucher sold here and its bonus in whole percent (the
   *  owner's pick: Small 10 · 20, Medium 20 · 40, Big 40 · 60). */
  voucher_pct: Partial<Record<MoneyVoucherKey, number>>;
};
/** A row with nothing on offer. */
export const NO_LIST_ROW_OFFERS: ListRowOffers = { sell: [], cashback_pct: null, cashback_flat: false, welcome_pct: null, returning_pct: null, returning_vip_pct: null, welcome_vip_pct: null, voucher_pct: {} };

/** A place's visit lines as list rows read them (MESITA-4702, MESITA-4766):
 *  each line in whole percent (null = gives nothing), the highest, and
 *  whether all of them are the same rate. No rates (Loyalty Cards Off, or a
 *  failed read) = none. */
export function cashbackOffer(r: CashbackRates | undefined | null): Pick<ListRowOffers, "cashback_pct" | "cashback_flat" | "welcome_pct" | "returning_pct" | "returning_vip_pct" | "welcome_vip_pct"> {
  const pct = (bps: number | undefined) => (bps && bps > 0 ? bps / 100 : null);
  const top = r ? maxCashbackBps(r) : 0;
  return {
    cashback_pct: top > 0 ? top / 100 : null,
    cashback_flat: !!r,
    // Retired (MESITA-5124): Welcome is a voucher, never a cashback line.
    welcome_pct: null,
    returning_pct: pct(r?.returning_bps),
    // Retired (MESITA-5072): no VIP line earns; null keeps older guest apps reading.
    returning_vip_pct: null,
    welcome_vip_pct: null,
  };
}

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
  // The account read is one URL. The wallet list is the whole catalog
  // (MESITA-4986), so a long page is read a chunk at a time.
  if (places.length > ID_CHUNK) {
    const out: (T & { vouchers_up_to_pct: number | null; mesita_pay: boolean; offers: ListRowOffers })[] = [];
    for (const some of chunked(places, ID_CHUNK)) out.push(...await withVouchersUpTo(admin, some));
    return out;
  }
  const ids = places.map((p) => p.id);
  if (ids.length === 0) return [];
  // No admin client (a run with no service key): nothing for sale, no line.
  if (!admin) return places.map((p) => ({ ...p, vouchers_up_to_pct: null, mesita_pay: false, offers: NO_LIST_ROW_OFFERS }));
  // One list page of ids, so no chunking. The account read is the shared
  // in-mode rule (MESITA-3394); a failed read reads as no Pay, as before.
  // BUYING PAUSED SELLS NOTHING (autoplan eng E3, MESITA-4207): the admin
  // console's kill switch empties every row's offers, as offerFrom does.
  const [settingsRes, charging, config] = await Promise.all([
    admin.from("place_payment_settings").select(`place_id, ${SETTINGS_COLUMNS}`).in("place_id", ids),
    chargesEnabledByPlace(admin, ids, paymentsLivemode()),
    readMoneyConfig(admin),
  ]);
  if (settingsRes.error) {
    console.error("[payments] settings_read_failed", JSON.stringify({ code: settingsRes.error.code, message: settingsRes.error.message, places: ids.length }));
  }
  // via unknown: a template-string select widens `data` to supabase-js's
  // GenericStringError union, as in get-place.
  const settingRows = (settingsRes.error ? [] : settingsRes.data ?? []) as unknown as ({ place_id: string } & Partial<Record<PaymentKey, unknown>>)[];
  const settings = new Map<string, PaymentSettings>();
  for (const row of settingRows) settings.set(row.place_id, settingsFromRow(row));
  const charges = charging ?? new Set<string>();
  // MESITA-4702: the visit lines of every place, shown only where credit
  // can be born. A failed read shows no visit slide rather than a wrong rate.
  const rates = await readCashbackRatesMany(admin, ids).catch((err) => {
    console.error("[payments] cashback_read_failed", errorMessage(err));
    return new Map<string, CashbackRates>();
  });
  return places.map((p) => {
    const money = listRowMoney(settings.get(p.id), charges.has(p.id));
    const sell = config.buying_paused ? [] : money.sell;
    const all = rates.get(p.id);
    const credits = settings.get(p.id)?.loyalty_cards === true;
    // Cashback and the voucher bonuses only where credit can be born.
    const cashback = cashbackOffer(credits ? all : undefined);
    const bonus = voucherBonusFrom(credits ? all : undefined);
    const voucher_pct = Object.fromEntries(sell.map((k) => [k, Math.floor(voucherBonusBps(k, bonus) / 100)]));
    return {
      ...p,
      vouchers_up_to_pct: vouchersUpToPct(sell, bonus),
      mesita_pay: money.mesita_pay,
      offers: { sell, ...cashback, voucher_pct },
    };
  });
}

/** One list row's money, pure: what sells and whether the mark shows. A
 *  place with no settings row reads as `settingsFromRow(null)`. */
export function listRowMoney(
  settings: PaymentSettings | undefined,
  charges: boolean,
): { sell: MoneyVoucherKey[]; mesita_pay: boolean } {
  const state = moneyState(settings ?? settingsFromRow(null), charges ? { charges_enabled: true } : null, null);
  return { sell: state.sell, mesita_pay: state.mesita_pay };
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

/** Where a place's Stripe account can live: Mexico, the US and Canada
 *  (MESITA-3943, the launch countries). Anywhere else a place runs Loyalty
 *  Cards and cash, never cards. */
export const CONNECT_COUNTRIES = ["MX", "US", "CA"] as const;
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
