// Membership helpers — the single place tier logic lives so the "blended
// rate" privacy goal holds: a place/waiter never learns which tier (or which
// door — Instagram / invitation / subscription) a guest came through. The
// rate resolver returns only the final integer percent; nothing tier-shaped
// leaks into any business/staff response.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// The subset of place columns the rate resolver needs. Any place row read
// with PLACE_*_COLUMNS satisfies this.
export type PlaceRates = {
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
};

export type TierConfig = {
  key: string;
  label: string;
  rank: number;
  follower_threshold: number | null;
  monthly_reservation_limit: number | null;
  price_cents: number;
  currency: string;
  stripe_price_id: string | null;
  recommendation_weight: number;
};

// Promos v5 (MESITA-723): the promo rate resolver moved to the grid-authoritative
// engine in ./rewards-config.ts (resolveTicketRate over the app_settings grid ×
// the place's strategy, best-of). selectprojectRate (v4, per-place columns) is
// retired; the helpers below feed the new resolver's rate context.

// Consumer-class perk gate: which classes clear the "Premium or better" bar.
// Premium (paid) and Magnetic (Instagram-earned, the active top tier) both
// pass; Standard / null / anonymous do not. Route every premium-perk class
// check through this so Magnetic inherits Premium's perks (magnetic ≥ premium).
export function isPremiumOrHigher(classKey: string | null | undefined): boolean {
  return classKey === "premium" || classKey === "magnetic";
}

// Loads a tier's config row. Returns null if the key isn't in the lookup.
export async function getTierConfig(
  admin: SupabaseClient,
  tierKey: string,
): Promise<TierConfig | null> {
  const { data } = await admin
    .from("classes")
    .select(
      "key, label, rank, follower_threshold, monthly_reservation_limit, price_cents, currency, stripe_price_id, recommendation_weight",
    )
    .eq("key", tierKey)
    .maybeSingle();
  return (data as TierConfig | null) ?? null;
}

// True when this consumer has never had a ticket at this place — drives the
// Welcome rung. Pass excludeTicketId when the current ticket already exists
// (the scan → bill path) so the ticket being billed doesn't count itself and
// suppress its own Welcome rate.
export async function isConsumerFirstVisit(
  admin: SupabaseClient,
  consumerId: string,
  projectId: string,
  excludeTicketId?: string,
): Promise<boolean> {
  let query = admin
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .eq("project_id", projectId);
  if (excludeTicketId) query = query.neq("id", excludeTicketId);
  const { count } = await query;
  return (count ?? 0) === 0;
}

// True when this consumer already claimed the Google Review discount at this
// place (once per consumer × place — Google allows one review per account).
export async function hasClaimedReview(
  admin: SupabaseClient,
  consumerId: string,
  projectId: string,
): Promise<boolean> {
  const { count } = await admin
    .from("consumer_review_claims")
    .select("consumer_id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .eq("project_id", projectId);
  return (count ?? 0) > 0;
}
