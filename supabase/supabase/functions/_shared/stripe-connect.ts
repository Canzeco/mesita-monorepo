// Stripe Connect — PLATFORM, not marketplace (Pato directive + gate 2026-08-29).
//
// The law, executable: every Mesita connected account is created with the
// typeless-Standard controller configuration below plus explicitly requested
// capabilities, and future table payments are DIRECT charges on the connected
// account (optional application_fee_amount). The place is merchant of record;
// funds settle to the place; Mesita never enters the funds flow beyond the
// app fee — which keeps "Mesita moves no money at the table" true after the
// rail goes live, and keeps Mesita outside Ley Fintech IFPE territory
// (never holds funds). NO destination charges, NO separate charges &
// transfers, Mesita never MoR for table payments.
//
// Controller properties are PER-ACCOUNT PERMANENT: an Express-style pivot
// later means new accounts + full re-KYC for everyone onboarded. Recorded
// trade-off: Stripe-hosted Standard onboarding converts worse for small
// restaurants than Express — the first real onboardings are a conversion
// experiment, not a formality.
//
// Companion premise (gate 2026-08-29): discounts stay restaurant-funded bill
// reductions, never platform-funded settlements — the reason direct charges
// beat destination charges for Mesita.

import type Stripe from "npm:stripe@17";

/** The typeless-Standard "platform" controller. Frozen by stripe-connect.test.ts. */
export const MESITA_CONNECT_CONTROLLER = {
  // The place uses the real Stripe Dashboard and owns its Stripe relationship.
  stripe_dashboard: { type: "full" },
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
};

/** Mirror-row patch from a Stripe Account object. `livemode` is passed
 *  explicitly (see keyIsLive). `requirements` is optional and its
 *  currently_due is nullable on the v17 types — both default safe. */
export function accountSnapshotFromStripe(
  account: Stripe.Account,
  livemode: boolean,
): ConnectAccountSnapshot {
  return {
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
 *     (the resolvePlanPrice self-heal posture for rotated sandboxes).
 */
export function classifyExistingAccount(
  row: { stripe_account_id: string; livemode: boolean } | null,
  ctx: { mockMode: boolean; keyLive: boolean },
): "create" | "use" | "replace" | "return_untouched" {
  if (!row) return "create";
  const mockRow = isMockConnectAccountId(row.stripe_account_id);
  if (ctx.mockMode) return mockRow ? "use" : "return_untouched";
  if (mockRow) return "replace";
  if (row.livemode !== ctx.keyLive) return "replace";
  return "use";
}
