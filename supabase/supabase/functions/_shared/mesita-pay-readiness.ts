// Mesita Pay charge-readiness — the ONE place this three-leg chain is
// computed, so consumer-web-get-ticket's `cardRail` flag and
// consumer-web-select-ticket-payment's actual charge attempt can never
// disagree about whether a place is chargeable (MESITA-1414):
//
//   place_profiles.mesita_pay_enabled  (operator intent bit)
//   ∧ visits_config.payCard            (global rail switch)
//   ∧ isConnectChargeReady             (Stripe-derived Connect capability, on
//                                        the PLACE's own account — MESITA-1892)
//
// IT USED TO BE FOUR LEGS. The place's intent bit was ANDed with its
// organization's, and the Connect account hung off the organization. The org
// layer is gone: the intent bit absorbed the org's half at migration time, and
// the account is the place's, so the same three facts now live on one row each.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isConnectChargeReady } from "./payment-account-doc.ts";

export type ChargeablePlaceAccount = {
  placeId: string;
  connectedAccountId: string;
};

/**
 * Resolves the connected Stripe account this place may charge through, or
 * null if any leg of the chain is closed. `payCard` is passed in (from
 * visits_config) rather than read here — callers that already hold it
 * (consumer-web-get-ticket polls it every request) skip a redundant query.
 */
export async function resolveChargeablePlaceAccount(
  admin: SupabaseClient,
  payCard: boolean,
  placeId: string | null,
): Promise<ChargeablePlaceAccount | null> {
  if (!payCard || !placeId) return null;
  const place = await admin
    .from("place_profiles")
    .select("mesita_pay_enabled")
    .eq("id", placeId)
    .maybeSingle();
  const intent =
    (place.data as { mesita_pay_enabled?: boolean } | null)?.mesita_pay_enabled ===
      true;
  if (!intent) return null;
  const account = await admin
    .from("place_payment_accounts")
    .select("stripe_account_id, charges_enabled, details_submitted")
    .eq("place_id", placeId)
    .maybeSingle();
  const row = account.data as
    | { stripe_account_id: string; charges_enabled: boolean; details_submitted: boolean }
    | null;
  if (!isConnectChargeReady(row)) return null;
  return { placeId, connectedAccountId: row!.stripe_account_id };
}
