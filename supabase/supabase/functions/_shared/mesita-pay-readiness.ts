// Mesita Pay charge-readiness — the ONE place this three-leg chain is
// computed, so consumer-web-get-ticket's `cardRail` flag and
// consumer-web-select-ticket-payment's actual charge attempt can never
// disagree about whether a place is chargeable (MESITA-1414):
//
//   places.mesita_pay_enabled  (operator intent bit)
//   ∧ visits_config.payCard    (global rail switch)
//   ∧ isConnectChargeReady     (Stripe-derived Connect capability, on the
//                                place's ORGANIZATION — MESITA-1545)

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isConnectChargeReady } from "./payment-account-doc.ts";

export type ChargeableOrganizationAccount = {
  organizationId: string;
  connectedAccountId: string;
};

/**
 * Resolves the connected Stripe account this place may charge through, or
 * null if any leg of the chain is closed. `payCard` is passed in (from
 * visits_config) rather than read here — callers that already hold it
 * (consumer-web-get-ticket polls it every request) skip a redundant query.
 */
export async function resolveChargeableOrganizationAccount(
  admin: SupabaseClient,
  payCard: boolean,
  placeId: string | null,
): Promise<ChargeableOrganizationAccount | null> {
  if (!payCard || !placeId) return null;
  const [place, org] = await Promise.all([
    admin
      .from("place_profiles")
      .select("mesita_pay_enabled")
      .eq("id", placeId)
      .maybeSingle(),
    admin
      .from("places")
      .select("organization_id")
      .eq("id", placeId)
      .maybeSingle(),
  ]);
  const intent =
    (place.data as { mesita_pay_enabled?: boolean } | null)?.mesita_pay_enabled ===
      true;
  if (!intent) return null;
  const organizationId =
    (org.data as { organization_id?: string | null } | null)?.organization_id ??
      null;
  if (!organizationId) return null;
  const account = await admin
    .from("organization_payment_accounts")
    .select("stripe_account_id, charges_enabled, details_submitted")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const row = account.data as
    | { stripe_account_id: string; charges_enabled: boolean; details_submitted: boolean }
    | null;
  if (!isConnectChargeReady(row)) return null;
  return { organizationId, connectedAccountId: row!.stripe_account_id };
}
