// The organizationGuestCustomers aggregate — the cache of which Stripe
// Customer, on an organization's CONNECTED account, a guest was cloned onto
// (MESITA-1414). ONE write door, same shape as payment-account-doc.ts.
//
// Why this cache exists at all: a cloned PaymentMethod is single-use unless
// attached to a Customer on the connected account (Stripe's own
// distinction — see the migration comment). Pato's decision (2026-09-02)
// keeps that Customer durable and dashboard-visible rather than one-shot, so
// every visit reuses the SAME connected-account customer instead of the
// venue's Stripe dashboard filling with a new one per charge.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type OrganizationGuestCustomerRow = {
  organization_id: string;
  consumer_id: string;
  /** Customer id on the CONNECTED account — never the platform customer. */
  stripe_customer_id: string;
  created_at: string;
};

/** The cached connected-account customer for this (organization, consumer)
 *  pair, or null if this guest has never been cloned onto this org's
 *  account before. */
export async function getOrganizationGuestCustomer(
  admin: SupabaseClient,
  organizationId: string,
  consumerId: string,
): Promise<OrganizationGuestCustomerRow | null> {
  const { data } = await admin
    .from("organization_guest_customers")
    .select("organization_id, consumer_id, stripe_customer_id, created_at")
    .eq("organization_id", organizationId)
    .eq("consumer_id", consumerId)
    .maybeSingle();
  return (data as OrganizationGuestCustomerRow | null) ?? null;
}

/**
 * Records a freshly-minted connected-account customer. Upsert on the
 * (organization_id, consumer_id) primary key: a race between two charges by
 * the same guest at the same org (two tabs, a retried tap) must converge on
 * ONE cached customer, never insert a duplicate row that a later read could
 * pick either of nondeterministically.
 */
export async function writeOrganizationGuestCustomer(
  admin: SupabaseClient,
  args: { organizationId: string; consumerId: string; stripeCustomerId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin
    .from("organization_guest_customers")
    .upsert(
      {
        organization_id: args.organizationId,
        consumer_id: args.consumerId,
        stripe_customer_id: args.stripeCustomerId,
      },
      { onConflict: "organization_id,consumer_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
