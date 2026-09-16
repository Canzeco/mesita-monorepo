// The per-place partnership cascade (MESITA-1798, narrowed by MESITA-1889,
// re-scoped by MESITA-1892).
//
// It holds the three patch builders and the one writer that move a single
// PLACE between `plan=free` and `plan=pro Zero`, and nothing else.
//
// WHO CALLS IT. `_shared/partner-membership.ts` — the Mesita Membership's
// entitlement writer (MESITA-1877) — and `business-web-claim-place`, which
// joins a newly claimed place that is already partnered.
//
// It used to cascade a whole ORGANIZATION's portfolio; MESITA-1892 removed
// that layer, so a Membership now buys one place and the cascade is a single
// row. The loop did not become a special case — it stopped existing.
//
// WHO WRITES `places.partnered`. The Membership lifecycle ALONE:
// business-web-start-membership under MOCK_SUBSCRIPTION, and
// stripe-webhook-handle-event once Stripe confirms. `setOrgPartnership` used
// to live here and was the operator's SECOND door onto the same fact — it
// also wrote the organization's `mesita_pay_enabled` in the same statement and
// refused ON without a Ready Connect account. MESITA-1889 retired it with its
// EF (archived under retired/edge-functions/business-web-set-org-partnership),
// and MESITA-1892 did not bring it back under a place-shaped name: one
// entitlement, one door. Mesita Pay is its own switch with its own writer
// (`_shared/place-rails.ts`), so buying a partnership never switches card
// payments on for a restaurant's guests.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { applyListingTypeToPatch } from "./partner-derivation.ts";
import { type PlacePatch, writePlace } from "./place-doc.ts";

export const ZERO_RATES = {
  welcome_free_rate: null,
  welcome_premium_rate: null,
  free_rate: null,
  premium_rate: null,
} as const;

export type PlacePartnershipRow = {
  id: string;
  plan: string | null;
  listing_type: string | null;
  plan_forfeited_at: string | null;
};

/** Join patch for one place. Null when the place is already a member. */
export function joinPlacePatch(
  row: PlacePartnershipRow,
): PlacePatch | null {
  const currentPlan = row.plan ?? "free";
  if (currentPlan !== "free" && !row.plan_forfeited_at) return null;
  const patch: Record<string, unknown> = { plan: "pro" };
  applyListingTypeToPatch(patch, {
    plan: "pro",
    rates: ZERO_RATES,
    currentListingType: row.listing_type,
  });
  if (row.plan_forfeited_at) {
    patch.plan_forfeited_at = null;
    patch.strike_count = 0;
    patch.promo_paused_until = null;
    patch.plan_live_at = null;
    patch.first_ticket_honored_at = null;
  }
  return patch as PlacePatch;
}

/** Drop patch for one place. Null when the place is already free. */
export function dropPlacePatch(
  row: PlacePartnershipRow,
): PlacePatch | null {
  const currentPlan = row.plan ?? "free";
  if (currentPlan === "free") return null;
  const patch: Record<string, unknown> = {
    plan: "free",
    ...ZERO_RATES,
    monthly_promo_cap: null,
    plan_live_at: null,
    first_ticket_honored_at: null,
  };
  applyListingTypeToPatch(patch, {
    plan: "free",
    rates: ZERO_RATES,
    currentListingType: row.listing_type,
  });
  return patch as PlacePatch;
}

export async function writePlacePartnership(
  admin: SupabaseClient,
  row: PlacePartnershipRow,
  joining: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch = joining ? joinPlacePatch(row) : dropPlacePatch(row);
  if (!patch) return { ok: true };
  const upd = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: row.id,
    patch,
    select: "id",
    selectMode: "maybeSingle",
  });
  if (!upd.ok) return { ok: false, error: upd.error };
  return { ok: true };
}
