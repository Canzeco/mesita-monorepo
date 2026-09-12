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
import type { ConnectBusinessProfilePrefill } from "./stripe-connect-prefill.ts";

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

/**
 * The API version the controller above REQUIRES.
 *
 * THIS CONSTANT EXISTS BECAUSE THE PAIRING IS ONE FACT (MESITA-1643). The
 * controller and the API version were two facts in two files, and MESITA-1532
 * moved one of them. Stripe's 2026-06-24 Dahlia changelog files the Express +
 * `fees.payer=account` + `losses.payments=stripe` combination under its PUBLIC
 * PREVIEW channel, not GA, and says so on the account-create page: "Use the
 * current preview version string in your Stripe SDK configuration when you
 * create connected accounts." The platform-wide `STRIPE_API_VERSION` is GA, so
 * `accounts.create` answered:
 *
 *   "When stripe_dashboard[type]=express, your platform must collect fees and
 *    be liable for negative balances or refunds and chargebacks."
 *
 * Every existing test passed, because the controller test asserted the literal
 * against itself and never imported the version. Now they live together and
 * `connectPairingHolds` below is what a test can actually fail.
 */
export const CONNECT_API_VERSION = "2026-08-26.preview";

/** The version at or past which Express tolerates Stripe-owned pricing and
 *  loss liability. Separate name because one is "what we send" and the other
 *  is "what Stripe requires", and they drift for different reasons. They have
 *  now drifted: the docs say to send the CURRENT preview string, and Stripe
 *  publishes a new `<date>.preview` alongside each `<date>.<codename>` GA
 *  release, so what we send moves while the floor stays where the feature
 *  landed. */
export const EXPRESS_STRIPE_LOSSES_MIN_VERSION = "2026-06-24.preview";

/**
 * What the client actually sends, env-overridable.
 *
 * The preview channel ROLLS FORWARD on Stripe's release schedule and the docs
 * say to send the current string, not the one the feature shipped under. A
 * rolled version should cost one secret, not a redeploy — this door was shut
 * for two days over a version string, and the recovery path should not be
 * "wait for an agent". An unset or blank value is not an override.
 */
export function connectApiVersion(
  read: (name: string) => string | undefined = (n) => Deno.env.get(n),
): string {
  const override = (read("STRIPE_CONNECT_API_VERSION") ?? "").trim();
  return override || CONNECT_API_VERSION;
}

/**
 * Does the controller/version pair Stripe will actually accept?
 *
 * The implication, stated once: Express dashboard AND the place paying fees AND
 * Stripe eating losses REQUIRES a version at or past the preview that unblocked
 * it. Vacuously true for any other dashboard type — which is the point, because
 * it keeps holding if the controller ever goes back to `full`.
 *
 * Dates sort lexicographically in `YYYY-MM-DD.channel` form, which is why this
 * is a string compare and not a parse.
 */
export function connectPairingHolds(
  controller: { stripe_dashboard: { type: string }; fees: { payer: string }; losses: { payments: string } },
  apiVersion: string,
): boolean {
  const needsPreview = controller.stripe_dashboard.type === "express" &&
    controller.fees.payer === "account" &&
    controller.losses.payments === "stripe";
  if (!needsPreview) return true;
  return apiVersion >= EXPRESS_STRIPE_LOSSES_MIN_VERSION;
}

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
/**
 * The `accounts.create` argument object, assembled in ONE place.
 *
 * It used to be an inline literal in business-web-start-payment-onboarding, so
 * nothing could test it without a network call — and the params are exactly
 * where the MESITA-1623 outage lived. Building them here means
 * `stripe-connect.test.ts` can assert the shape Stripe will actually receive,
 * offline, on every CI run.
 */
export type { ConnectBusinessProfilePrefill };

export type ConnectAccountCreateInput = {
  orgId: string;
  country: string;
  /** null when the caller is resuming an account that already carries it. */
  entityType: MesitaConnectEntityType | null;
  /** The organization's legal name, for company prefill. Empty string = none. */
  legalName: string;
  /** Account email — Stripe's login + receipts, from a place email when we have one. */
  email?: string;
  /** Mexican RFC, only when shaped. Lands on company.tax_id (persona moral). */
  taxId?: string;
  /** Hosted onboarding Business details (MCC / url / description). Empty keys omitted. */
  businessProfile?: ConnectBusinessProfilePrefill;
};

function companyParams(
  input: ConnectAccountCreateInput,
): Stripe.AccountCreateParams.Company | undefined {
  if (input.entityType === "individual") return undefined;
  const company: Stripe.AccountCreateParams.Company = {};
  if (input.legalName) company.name = input.legalName;
  if (input.taxId) company.tax_id = input.taxId;
  return Object.keys(company).length > 0 ? company : undefined;
}

function businessProfileParams(
  profile: ConnectBusinessProfilePrefill | undefined,
): Stripe.AccountCreateParams.BusinessProfile | undefined {
  if (!profile) return undefined;
  const out: Stripe.AccountCreateParams.BusinessProfile = {};
  if (profile.mcc) out.mcc = profile.mcc;
  if (profile.url) out.url = profile.url;
  if (profile.product_description) {
    out.product_description = profile.product_description;
  }
  if (profile.name) out.name = profile.name;
  if (profile.support_phone) out.support_phone = profile.support_phone;
  if (profile.support_email) out.support_email = profile.support_email;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function connectAccountCreateParams(
  input: ConnectAccountCreateInput,
): Stripe.AccountCreateParams {
  const { orgId, country, entityType } = input;
  const company = companyParams(input);
  const businessProfile = businessProfileParams(input.businessProfile);
  return {
    country,
    controller: MESITA_CONNECT_CONTROLLER,
    capabilities: MESITA_CONNECT_CAPABILITIES,
    metadata: { organization_id: orgId },
    ...(entityType ? { business_type: entityType } : {}),
    ...(company ? { company } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(businessProfile ? { business_profile: businessProfile } : {}),
  };
}

/**
 * Idempotency key for `accounts.create`.
 *
 * A lost response — timeout, EF cold-start kill — means Stripe created an
 * account this function never saw. Without a key the owner's next press mints a
 * SECOND permanent connected account, the first orphaned with no mirror row and
 * no cleanup path; controller properties are per-account permanent, so every
 * orphan is forever. Keyed on the two things that identify the intended
 * account. Stripe scopes idempotency per API version, so this key moves with
 * CONNECT_API_VERSION by construction.
 */
export function connectAccountIdempotencyKey(
  orgId: string,
  country: string,
): string {
  return `connect-acct-${orgId}-${country}`;
}

/**
 * Account Link URLs must be ABSOLUTE (MESITA-1643).
 *
 * The EF used to build them from `req.headers.get("origin") ?? ""`, but its
 * caller is a Next server action invoking through supabase-js, where no browser
 * Origin header exists — so the fallback produced the RELATIVE string
 * "/?org=<id>&connect=return" and `accountLinks.create` rejected it. That was
 * the next failure waiting behind the controller bug, in the same rose box.
 *
 * Refusing here, by name, beats letting Stripe refuse in its own words.
 */
export function isAbsoluteHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string" || value === "") return false;
  try {
    const u = new URL(value);
    // http is allowed for local development; Stripe itself requires https in
    // live mode and rejects anything relative in both modes.
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

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

/**
 * Legal entity types a Mesita connected account may be created as —
 * Stripe's `business_type`, asked BEFORE onboarding opens (Pato directive,
 * 2026-09-06: "ask some prev stuff before initializing onboarding — country
 * and type of legal entity").
 *
 * In Mexico this is the persona física / persona moral fork, and it is the
 * single answer that decides WHAT Stripe asks next: an individual is asked
 * for a CURP and a personal RFC, a company for its constitutive act, its
 * legal representative and a company RFC. Sending the person into hosted
 * onboarding without it means Stripe opens on a chooser the owner is least
 * equipped to answer cold — a restaurant owner who picks wrong restarts KYC.
 *
 * Unlike `country`, this is NOT permanent: it is a prefill, and Stripe lets
 * the person change it inside the hosted flow. That asymmetry is deliberate
 * and is why this list may grow cheaply while MESITA_CONNECT_COUNTRIES may
 * not. ALL FOUR of Stripe's values are offered (decision: Pato, 2026-09-08).
 * The earlier list stopped at individual + company on the theory that no
 * Mesita merchant is a non-profit or government entity. Mexico breaks it: an
 * asociación civil running a café is a real persona moral, and a museum or
 * university restaurant is real too. Since Stripe re-asks the prefill anyway,
 * a wrong option costs a dropdown correction while a MISSING one costs an
 * onboarding the operator cannot start.
 */
export const MESITA_CONNECT_ENTITY_TYPES = [
  "individual",
  "company",
  "non_profit",
  "government_entity",
] as const;

export type MesitaConnectEntityType = typeof MESITA_CONNECT_ENTITY_TYPES[number];

export function isSupportedConnectEntityType(
  value: unknown,
): value is MesitaConnectEntityType {
  return typeof value === "string" &&
    (MESITA_CONNECT_ENTITY_TYPES as readonly string[]).includes(value);
}
