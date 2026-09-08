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
