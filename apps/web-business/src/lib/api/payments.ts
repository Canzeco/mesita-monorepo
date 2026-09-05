// Frontend helper for business-web-get-payment-dashboard-link.
//
// The door to the Express Dashboard (MESITA-1532). Under the old Standard
// controller a place logged into stripe.com itself and the business console
// needed nothing; under Express there is no public login for sandbox accounts,
// so a platform-minted link is the ONLY way in.
//
// Deliberately read-and-open only: this module does NOT start onboarding.
// Creating a connected account bakes a country into it permanently, and
// onboarding today is staff-assisted (super-admins are exempt from the owner
// gate, and no production place has owners). A business-side "set up payments"
// button would have to pick that permanent country silently, which is exactly
// the failure the admin console's explicit selector exists to prevent.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF, withPlaceId } from "./_invoke";

export type PaymentDashboardLink = {
  /** Mock connect account — there is no Stripe side, so no link exists. */
  mock: boolean;
  url: string | null;
};

/**
 * Mint a single-use Express Dashboard link.
 *
 * Single-use is load-bearing: never call this to probe whether an account
 * exists, because a probe burns the link. Call it when the owner asks to go.
 */
export async function apiGetPaymentDashboardLink(
  client: SupabaseClient,
  input: { projectId: string },
): Promise<PaymentDashboardLink> {
  return invokeEF<PaymentDashboardLink>(
    client,
    "business-web-get-payment-dashboard-link",
    withPlaceId(input),
    "Couldn't open the payments dashboard.",
  );
}

/**
 * The EF's machine-readable code off a thrown invoke error.
 *
 * `not_onboarded` is a NORMAL state (the place has never set up payments), not
 * a fault — the EF returns it as a code precisely so the console can branch
 * instead of pattern-matching an English string that copy edits would break.
 */
export function paymentsErrorCode(err: unknown): string | null {
  const code = (err as { code?: unknown })?.code;
  return typeof code === "string" ? code : null;
}
