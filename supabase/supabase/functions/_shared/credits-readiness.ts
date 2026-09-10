// Mesita Credits charge-readiness — the ONE place this chain is computed,
// mirroring _shared/mesita-pay-readiness.ts (MESITA-1414) so a future
// consumer-web-get-* balance read and consumer-web-buy-credits' actual charge
// attempt can never disagree about whether a place's organization is
// chargeable (MESITA-1676).
//
//   place_profiles.credits_enabled  (operator intent bit, place-scoped —
//                                     the org has no capability bit of its
//                                     own yet, unlike mesita_pay_enabled)
//   ∧ visits_config.payCredits      (global rail switch)
//   ∧ isConnectChargeReady          (Stripe-derived Connect capability, on
//                                     the place's ORGANIZATION — MESITA-1545)
//
// KEYED BY PLACE, NOT ORGANIZATION, on purpose: a guest reaches Buy from a
// place they know (there is no org-level browsing surface yet — the Wallet's
// own balance list is still an emulator, MESITA-1674), so the client always
// has a placeId, never an organizationId it could be trusted to supply. The
// LOT that results is org-scoped (spendable at any of that organization's
// places), which is a fact about what gets written, not about how the
// request is addressed — same distinction resolveChargeableOrganizationAccount
// draws for the ticket rail.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isConnectChargeReady } from "./payment-account-doc.ts";

export type ChargeableOrganizationForCredits = {
  organizationId: string;
  connectedAccountId: string;
};

/**
 * Resolves the connected Stripe account a Credits purchase at `placeId` would
 * charge through and fund, or null if any leg of the chain is closed.
 * `payCredits` is passed in (from visits_config) rather than read here —
 * mirrors resolveChargeableOrganizationAccount's shape exactly.
 */
export async function resolveChargeableOrganizationForCredits(
  admin: SupabaseClient,
  payCredits: boolean,
  placeId: string | null,
): Promise<ChargeableOrganizationForCredits | null> {
  if (!payCredits || !placeId) return null;
  const [place, org] = await Promise.all([
    admin
      .from("place_profiles")
      .select("credits_enabled")
      .eq("id", placeId)
      .maybeSingle(),
    admin
      .from("places")
      .select("organization_id")
      .eq("id", placeId)
      .maybeSingle(),
  ]);
  const intent =
    (place.data as { credits_enabled?: boolean } | null)?.credits_enabled ===
      true;
  if (!intent) return null;
  const organizationId =
    (org.data as { organization_id?: string | null } | null)
      ?.organization_id ?? null;
  if (!organizationId) return null;
  const account = await admin
    .from("organization_payment_accounts")
    .select("stripe_account_id, charges_enabled, details_submitted")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const row = account.data as
    | {
      stripe_account_id: string;
      charges_enabled: boolean;
      details_submitted: boolean;
    }
    | null;
  if (!isConnectChargeReady(row)) return null;
  return { organizationId, connectedAccountId: row!.stripe_account_id };
}

// ── The org-level fact (MESITA-1674's "Also": a place-scoped bit becoming an
// org fact) ──────────────────────────────────────────────────────────────
//
// `place_profiles.credits_enabled` is place-scoped and `organizations` has no
// capability bit of its own for Credits — unlike Mesita Pay, where
// `organizations.mesita_pay_enabled` already IS the org fact and ANDs DOWN
// into each place's own bit. Credits has nothing to AND down from yet, so the
// question this issue asks — "any place? all? a new column?" — is answered
// ANY: an organization accepts Credits if AT LEAST ONE of its places has
// opted in, the same semantics consumer-web-list-credit-places already uses
// to decide whether an organization belongs in the Buy picker (a place
// appears there iff its org clears this same chain). Reusing "any" here next
// to that EF is what keeps the two from silently drifting into different
// answers for "does this org take Credits" — the exact unenforced-config bug
// root CLAUDE.md names. ALL was rejected: an organization can hold places
// that never sell Credits (a food-truck chain's kiosk, say) without that
// costing every OTHER place at the org its own opt-in. A new
// `organizations.credits_enabled` column was rejected too — it would need its
// own writer and its own drift-with-place-bits story for a fact this query
// already answers correctly today.
//
// BATCHED, NOT ONE ROUND TRIP PER ORG. consumer-web-list-credit-balances
// calls this once per page of organizations (bounded by DEFAULT_PAGE_SIZE),
// never once per lot.

/**
 * Which of `organizationIds` currently accept a NEW Credits purchase — ANY of
 * that organization's places is a credits_enabled acceptor AND the org's
 * Connect account is charge-ready. `payCredits` is passed in (from
 * visits_config) rather than read here, mirroring every other resolver in
 * this file.
 */
export async function organizationsAcceptingCredits(
  admin: SupabaseClient,
  organizationIds: readonly string[],
  payCredits: boolean,
): Promise<ReadonlySet<string>> {
  if (!payCredits || organizationIds.length === 0) return new Set();

  const places = await admin
    .from("places")
    .select("id, organization_id")
    .in("organization_id", organizationIds);
  if (places.error) return new Set();
  const rows = (places.data ?? []) as { id: string; organization_id: string | null }[];
  if (rows.length === 0) return new Set();

  const placeIds = rows.map((r) => r.id);
  const acceptors = await admin
    .from("place_profiles")
    .select("id, credits_enabled")
    .in("id", placeIds)
    .eq("credits_enabled", true);
  if (acceptors.error) return new Set();
  const acceptingPlaceIds = new Set(
    ((acceptors.data ?? []) as { id: string }[]).map((r) => r.id),
  );
  if (acceptingPlaceIds.size === 0) return new Set();

  const candidateOrgIds = new Set(
    rows
      .filter((r) => r.organization_id && acceptingPlaceIds.has(r.id))
      .map((r) => r.organization_id as string),
  );
  if (candidateOrgIds.size === 0) return new Set();

  const accounts = await admin
    .from("organization_payment_accounts")
    .select("organization_id, stripe_account_id, charges_enabled, details_submitted")
    .in("organization_id", [...candidateOrgIds]);
  if (accounts.error) return new Set();

  const ready = new Set<string>();
  for (
    const row of (accounts.data ?? []) as {
      organization_id: string;
      charges_enabled: boolean;
      details_submitted: boolean;
    }[]
  ) {
    if (isConnectChargeReady(row)) ready.add(row.organization_id);
  }
  return ready;
}

/**
 * The ISO 4217 currency a Credits charge on this organization is priced in,
 * uppercased for Stripe. Falls back to MXN — the market's currency and the
 * column's own default — when the org predates the column or holds blank.
 *
 * Lives beside resolveChargeableOrganizationForCredits for the same reason
 * that function exists: buy and gift both charge the same organization, and
 * the two must never disagree about it. They each carried this query.
 */
export async function resolveOrganizationCurrency(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string> {
  const { data } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", organizationId)
    .maybeSingle();
  const currency = (data as { currency?: string | null } | null)?.currency;
  return currency && currency.trim() ? currency.toUpperCase() : "MXN";
}
