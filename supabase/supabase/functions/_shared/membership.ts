// Membership helpers — the single place tier logic lives so the "blended
// rate" privacy goal holds: a place never learns which tier (or which
// door — Instagram / invitation / subscription) a guest came through. The
// rate resolver returns only the final integer percent; nothing tier-shaped
// leaks into any business/staff response.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isClassSegment } from "./rewards-config.ts";

// The subset of place columns the rate resolver needs. Any place row read
// with PLACE_*_COLUMNS satisfies this.
export type PlaceRates = {
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
};

// A class is WHO YOU ARE: earned, public, ranked. Price and the Stripe price
// id are the PLAN — they live on consumer_plans and are read there (see
// stripe-billing-catalog.ts), never here.
export type TierConfig = {
  key: string;
  label: string;
  rank: number;
  follower_threshold: number | null;
  monthly_reservation_limit: number | null;
  recommendation_weight: number;
};

// Promos v5 (MESITA-723): the promo rate resolver moved to the grid-authoritative
// engine in ./rewards-config.ts (resolveTicketRate over the app_config
// promos_config grid × the place's strategy — v11 additive, with best-of as
// the no-config fallback). selectprojectRate (v4, per-place columns) is
// retired; the helpers below feed the new resolver's rate context.

// Consumer-class perk gate: which classes clear the "better than the base
// class" bar. Every elevated class passes; the base class / null / unknown do
// not. Generic on purpose (rank > 0 in classes-table terms): a future class
// INSERT inherits the elevated perks without touching this gate.
export function isElevatedClass(classKey: string | null | undefined): boolean {
  return isClassSegment(classKey) && classKey !== "standard";
}

// Loads a tier's config row. Returns null if the key isn't in the lookup.
export async function getTierConfig(
  admin: SupabaseClient,
  tierKey: string,
): Promise<TierConfig | null> {
  const { data } = await admin
    .from("classes")
    .select(
      "key, label, rank, follower_threshold, monthly_reservation_limit, recommendation_weight",
    )
    .eq("key", tierKey)
    .maybeSingle();
  return (data as TierConfig | null) ?? null;
}

// True when this consumer has never had a ticket at this place — drives the
// Welcome rung. Pass excludeTicketId when the current ticket already exists
// (the scan → bill path) so the ticket being billed doesn't count itself and
// suppress its own Welcome rate.
/**
 * The Mesita-review rung's verified signal — scoped to ONE TICKET (v9,
 * MESITA-877).
 *
 * The review itself is one per consumer × place and stays editable (unique
 * pair since MESITA-825). The REWARD, though, is granted once: the same model
 * as Google or Yelp, where writing the review earns something and keeping it
 * current doesn't earn it again. That is why this asks whether THIS ticket
 * carries the review rather than whether the guest has ever reviewed the
 * place — the older question paid the rung on every future visit, forever,
 * for one review written years earlier.
 */
export async function hasMesitaReview(
  admin: SupabaseClient,
  ticketId: string,
): Promise<boolean> {
  const { count } = await admin
    .from("ticket_reviews")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticketId);
  return (count ?? 0) > 0;
}

export async function isConsumerFirstVisit(
  admin: SupabaseClient,
  consumerId: string,
  projectId: string,
  excludeTicketId?: string,
): Promise<boolean> {
  let query = admin
    .from("visit_tickets")
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

/**
 * Which of `projectIds` this consumer has ALREADY visited — one query for a
 * whole batch (MESITA-1019).
 *
 * `isConsumerFirstVisit` above answers the same question for one place with a
 * count query, which is right when a bill is being priced but is an N+1 the
 * moment a surface needs the answer for a deck of places. The set is inverted
 * by the caller: absent from it ⇒ first visit. An empty id list short-circuits
 * without touching the table.
 *
 * No `excludeTicketId` twin on purpose: the exclusion exists so a ticket being
 * billed doesn't suppress its own Welcome rate, and nothing that reads a batch
 * is pricing a live ticket.
 */
export async function consumerVisitedPlaceIds(
  admin: SupabaseClient,
  consumerId: string,
  projectIds: string[],
): Promise<Set<string>> {
  if (projectIds.length === 0) return new Set();
  const { data } = await admin
    .from("visit_tickets")
    .select("project_id")
    .eq("consumer_id", consumerId)
    .in("project_id", projectIds);
  const rows = (data ?? []) as { project_id: string | null }[];
  return new Set(
    rows
      .map((r) => r.project_id)
      .filter((id): id is string => typeof id === "string"),
  );
}
