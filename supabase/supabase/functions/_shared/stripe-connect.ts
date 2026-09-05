// Stripe Connect — PLATFORM, not marketplace (Pato directive + gate 2026-08-29).
//
// The law, executable: every Mesita connected account is created with the
// EXPRESS-dashboard controller configuration below plus explicitly requested
// capabilities, and future table payments are DIRECT charges on the connected
// account (optional application_fee_amount). The place is merchant of record;
// funds settle to the place; Mesita never enters the funds flow beyond the
// app fee — which keeps "Mesita moves no money at the table" true after the
// rail goes live, and keeps Mesita outside Ley Fintech IFPE territory
// (never holds funds). NO destination charges, NO separate charges &
// transfers, Mesita never MoR for table payments.
//
// Controller properties are PER-ACCOUNT PERMANENT. The Express pivot
// (MESITA-1532) was taken at the only moment it was free: ZERO connected
// accounts existed, so the "new accounts + full re-KYC" cost MESITA-1422
// warned about was exactly zero. It rises with every onboarding from here.
//
// Express is legal with THIS funds posture only because of Stripe's
// 2026-06-24 (Dahlia) changelog, which added Express support for
// fees.payer=account (previously blocked) and losses.payments=stripe
// (previously private preview) — and requires them set together. So the
// 2026-08-29 gate survives byte-for-byte; only the DASHBOARD changed.
// Never pass `type: "express"`: the legacy type forces
// fees.payer=application_express and platform loss liability, which is the
// one thing this configuration exists to avoid.
//
// Recorded trade-off, honestly: under Standard the place owned a PORTABLE
// Stripe account that survived leaving Mesita, plus invoices, Terminal, API
// keys and accountant exports. Under Express the account is Mesita's and
// none of that is theirs, and Mesita becomes first-line payouts support.
// The justification is that these restaurants will never log into Stripe
// anyway — not that nothing changed. The Standard upside was unreachable
// regardless: accounts.create + Account Links mints a NEW account either
// way, and adopting a merchant's existing Stripe needs OAuth.
//
// Companion premise (gate 2026-08-29): discounts stay restaurant-funded bill
// reductions, never platform-funded settlements — the reason direct charges
// beat destination charges for Mesita.

import type Stripe from "npm:stripe@17";

/** The Express-dashboard "platform" controller. Frozen by stripe-connect.test.ts. */
export const MESITA_CONNECT_CONTROLLER = {
  // The place gets the Express Dashboard — balance, payouts, payments,
  // disputes, refunds, reports. It has NO public login for sandbox accounts,
  // so the only entrance is a platform-minted login link
  // (business-web-get-payment-dashboard-link). Shipping Express without that
  // EF hands a restaurant an account it cannot open.
  stripe_dashboard: { type: "express" },
  // The place pays Stripe's processing fees, not Mesita.
  fees: { payer: "account" },
  // Stripe bears negative-balance/loss risk, not Mesita.
  losses: { payments: "stripe" },
  // Stripe collects onboarding requirements (hosted Account Links flow).
  requirement_collection: "stripe",
} as const satisfies Stripe.AccountCreateParams.Controller;

/** Typeless creation requests NOTHING implicitly — without these, hosted
 *  onboarding has nothing to collect toward charging and charges_enabled
 *  never flips. Frozen by stripe-connect.test.ts. */
export const MESITA_CONNECT_CAPABILITIES = {
  card_payments: { requested: true },
  transfers: { requested: true },
} as const satisfies Stripe.AccountCreateParams.Capabilities;

/**
 * Countries a Mesita connected account may be created in.
 *
 * An ALLOWLIST, not a passthrough: `country` reaches Stripe's accounts.create
 * and is PER-ACCOUNT PERMANENT, so an unvalidated string is a permanent
 * mistake one typo away. It used to be hardcoded "MX", which stopped being
 * merely narrow and started being wrong when the platform became Canzeco,
 * Inc. (US) — Stripe enables cross-country onboarding per country in Connect
 * Settings, so the platform's country and the account's country are now two
 * different questions.
 */
export const MESITA_CONNECT_COUNTRIES = ["MX", "US"] as const;

export type MesitaConnectCountry = typeof MESITA_CONNECT_COUNTRIES[number];

export function isSupportedConnectCountry(
  value: unknown,
): value is MesitaConnectCountry {
  return typeof value === "string" &&
    (MESITA_CONNECT_COUNTRIES as readonly string[]).includes(value);
}

// ⚠️ DEMO MOCK — Connect edition. Unlike MOCK_SUBSCRIPTION this defaults OFF:
// with the TEST key present the onboarding EF creates REAL test-universe
// connected accounts (inert, deletable) so "infrastructure prepared" is
// provable. Mock kicks in only when explicitly requested or when no key is
// configured. Live charges stay behind liveChargesBlocked (MESITA-37);
// agents never flip envs.
export function isMockConnect(stripeKey: string | undefined | null): boolean {
  const flag = (Deno.env.get("MOCK_CONNECT") ?? "").toLowerCase() === "true";
  return flag || !stripeKey;
}

/** Stable synthetic account id for mock mode — one per place, recognizable
 *  by prefix everywhere (the mock_ prefix convention from subscriptions). */
export function mockConnectAccountId(placeId: string): string {
  return `mock_acct_${placeId}`;
}

export function isMockConnectAccountId(accountId: string): boolean {
  return accountId.startsWith("mock_");
}

/** Which Stripe universe the configured key talks to. `Stripe.Account` has NO
 *  livemode field on stripe@17 — the universe comes from the key prefix (at
 *  create/refresh) or from `event.livemode` (in the webhook), never from the
 *  account object. */
export function keyIsLive(stripeKey: string): boolean {
  return stripeKey.startsWith("sk_live_");
}

export type ConnectAccountSnapshot = {
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  requirements_due: string[];
  disabled_reason: string | null;
  livemode: boolean;
  /** Stripe's own answer, never our request — the two can differ, and the
   *  one that matters for KYC and payouts is Stripe's. */
  country: string | null;
};

/** Mirror-row patch from a Stripe Account object. `livemode` is passed
 *  explicitly (see keyIsLive). `requirements` is optional and its
 *  currently_due is nullable on the v17 types — both default safe. */
export function accountSnapshotFromStripe(
  account: Stripe.Account,
  livemode: boolean,
): ConnectAccountSnapshot {
  return {
    country: typeof account.country === "string" ? account.country : null,
    charges_enabled: account.charges_enabled === true,
    details_submitted: account.details_submitted === true,
    payouts_enabled: account.payouts_enabled === true,
    requirements_due: (account.requirements?.currently_due ?? []).filter(
      (r): r is string => typeof r === "string",
    ),
    disabled_reason: account.requirements?.disabled_reason ?? null,
    livemode,
  };
}

/**
 * The mock/real/universe transition law (gate 2026-08-29, eng findings 2+3).
 * One row per place, so mock and real CANNOT coexist:
 *   - mock mode NEVER overwrites a real row (return it untouched);
 *   - real mode treats a mock row as absent (replace it);
 *   - a row whose universe mismatches the current key is replaceable
 *     (the resolvePlanPrice self-heal posture for rotated sandboxes);
 *   - a row whose COUNTRY mismatches the request is NOT replaceable
 *     (MESITA-1532).
 *
 * That last clause is the odd one out on purpose. Universe mismatch means the
 * account is unreachable with the current key, so replacing it costs nothing.
 * Country is per-account PERMANENT, and the existing account is real, may
 * already hold KYC, and may already be taking money — so "you asked for US,
 * this place is MX" must never silently mint a second account and orphan the
 * first. It returns the existing row under its own name so the caller can say
 * WHY, instead of handing back a fresh link that looks like success.
 */
export function classifyExistingAccount(
  row: { stripe_account_id: string; livemode: boolean; country?: string | null } | null,
  ctx: { mockMode: boolean; keyLive: boolean; country?: string | null },
): "create" | "use" | "use_country_mismatch" | "replace" | "return_untouched" {
  if (!row) return "create";
  const mockRow = isMockConnectAccountId(row.stripe_account_id);
  if (ctx.mockMode) return mockRow ? "use" : "return_untouched";
  if (mockRow) return "replace";
  if (row.livemode !== ctx.keyLive) return "replace";
  // Only a row that actually KNOWS its country can mismatch: rows written
  // before the column existed are null and must not be treated as wrong.
  if (row.country && ctx.country && row.country !== ctx.country) {
    return "use_country_mismatch";
  }
  return "use";
}
