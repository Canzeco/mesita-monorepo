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
// Test mode until Pato flips STRIPE_MODE (boostStripeKey); agents never do.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { StripeCall } from "./boost.ts";

// ── Settings ───────────────────────────────────────────────────────────────

/** The switches an owner has, in the order the page shows them. */
export const PAYMENT_KEYS = [
  "cashback",
  "voucher_200",
  "voucher_1000",
  "voucher_5000",
  "voucher_welcome",
  "voucher_story",
  "voucher_vip",
] as const;
export type PaymentKey = (typeof PAYMENT_KEYS)[number];

export function isPaymentKey(v: unknown): v is PaymentKey {
  return typeof v === "string" && (PAYMENT_KEYS as readonly string[]).includes(v);
}

export type PaymentSettings = Record<PaymentKey, boolean>;

/** No row = everything off. */
export function settingsFromRow(row: Partial<Record<PaymentKey, unknown>> | null): PaymentSettings {
  const out = {} as PaymentSettings;
  for (const k of PAYMENT_KEYS) out[k] = row?.[k] === true;
  return out;
}

export async function readSettings(admin: SupabaseClient, placeId: string): Promise<PaymentSettings> {
  const { data, error } = await admin.from("place_payment_settings").select(PAYMENT_KEYS.join(", "))
    .eq("place_id", placeId).maybeSingle();
  if (error) throw new Error(`place_payment_settings: ${error.message}`);
  return settingsFromRow(data as Partial<Record<PaymentKey, unknown>> | null);
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
};

export const ACCOUNT_COLUMNS =
  "place_id, stripe_account_id, livemode, account_country, charges_enabled, details_submitted, payouts_enabled, requirements_due, disabled_reason";

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

/** What the page gets: never the account id, never Stripe's own words. */
export function accountView(row: AccountRow | null) {
  return {
    state: accountState(row),
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
