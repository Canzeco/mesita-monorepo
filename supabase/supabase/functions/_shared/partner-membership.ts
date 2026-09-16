// Mesita Membership — the yearly subscription that makes a PLACE a Partner
// (MESITA-1877, re-scoped to the place by MESITA-1892).
//
// THE NAME. The thing you buy is the Membership; the thing you become is a
// Partner. The name also used to keep this file apart from `org-membership.ts`,
// which answered "is this caller IN this organization" — membership of PEOPLE.
// That file is gone with the org layer, and the name stays because it is the
// right one: this is the membership a venue BUYS, not a person's place in a
// team (that is `place_members`).
//
// THE SHAPE. `partner_memberships` is BILLING; `places.partnered` is
// ENTITLEMENT. The console and the guest lane read the second. This file is
// the only place that derives one from the other, so there is exactly one
// answer to "is this place a partner because it paid".
//
// ── LAPSE ≠ DROP ──────────────────────────────────────────────────────────
//
// A yearly MX card declines. Stripe moves the subscription to `past_due` and
// starts dunning; it may well recover on the third retry a week later. If that
// moment dropped the partnership, `dropPlacePatch` would null four rate columns
// and the monthly cap on the place — and recovering the card a week later would
// bring it back at ZERO rates, the operator's whole discount configuration
// gone, silently, because a bank said no once.
//
// So the ladder is:
//
//   active / trialing   entitle — partnered, the place joined at plan=pro Zero
//                       (the existing joinPlacePatch).
//   past_due            entitle, AND CHANGE NOTHING ELSE. Still a partner;
//                       Stripe is dunning; the console reads the mirror row's
//                       state to say the payment is due. The place is not
//                       touched.
//   canceled / unpaid   revoke — the year genuinely ended. (`unpaid` is where
//                       Stripe lands AFTER the whole retry schedule failed, so
//                       it is an ending, not a wobble.)
//   incomplete          mirror only. A checkout that was started and never
//                       paid never entitled anything, so it must not revoke
//                       anything either — including a partnership granted
//                       through another door.
//
// That last rung is the webhook's standing precedence rule (a lapse only
// downgrades an entitlement that came through the paid door) applied to the
// one case where this file could otherwise get it wrong.
//
// WHAT THIS FILE NEVER WRITES: `place_profiles.mesita_pay_enabled`. Paying for
// the Membership does not switch card payments on — that is the add-on, with
// its own switch and its own Stripe Ready lock (MESITA-1867 undid the coupling
// in the console; MESITA-1868 gives Pay its own writer, and MESITA-1892 made
// `place-rails.ts` the ONLY writer of that bit). Buying a partnership must
// never start charging a restaurant's guests.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type PlacePartnershipRow,
  writePlacePartnership,
} from "./place-partnership.ts";

/** The one row in `membership_plans` — the yearly Mesita Membership. */
export const MEMBERSHIP_PLAN_KEY = "membership";

/** Its entry in the Stripe catalog (stripe-billing-catalog.ts). */
export const MEMBERSHIP_CATALOG_ID = "business_partner_membership" as const;

/** Mirror states that count as a LIVE membership — the same pair the
 *  `partner_memberships_one_live` partial index is built on. */
export const LIVE_MEMBERSHIP_STATES = ["active", "past_due"] as const;

/**
 * What a mirror state does to the partnership.
 *
 *   "entitle"  → partnered on, held places joined
 *   "revoke"   → partnered off, held places dropped
 *   "mirror"   → the row is written, the partnership is not touched
 */
export type MembershipOutcome = "entitle" | "revoke" | "mirror";

/** Takes the LOCAL state (subscriptionSnapshot's mapping of Stripe's), not
 *  Stripe's raw status: `trialing` has already folded into `active` there. */
export function membershipOutcome(localState: string): MembershipOutcome {
  if (localState === "active" || localState === "past_due") return "entitle";
  if (localState === "canceled" || localState === "unpaid") return "revoke";
  return "mirror";
}

export type ApplyMembershipResult =
  | {
    ok: true;
    partnered: boolean;
    /** Did this call move the place onto the pro plan, or off it? A replayed
     *  webhook reports false for both, because nothing moved. */
    joined: boolean;
    dropped: boolean;
  }
  | { ok: false; error: string };

/**
 * Writes the entitlement an outcome implies. Idempotent both ways:
 * `joinPlacePatch` / `dropPlacePatch` return null for a place already in the
 * target state, so a replayed webhook writes nothing at all.
 *
 * THIS IS THE ONLY WRITER of `places.partnered`. It deliberately never went
 * through the operator switch's body, which refused without a Ready Connect
 * account — the Membership is not Stripe-locked, because Stripe has already
 * taken the money by the time this runs — and wrote `mesita_pay_enabled` in
 * the same statement. MESITA-1889 retired that door and deleted its body;
 * MESITA-1892 did not resurrect it under a place-shaped name. One entitlement,
 * one writer.
 */
export async function applyMembershipEntitlement(
  admin: SupabaseClient,
  placeId: string,
  outcome: MembershipOutcome,
): Promise<ApplyMembershipResult> {
  if (outcome === "mirror") {
    const { data, error } = await admin
      .from("places")
      .select("partnered")
      .eq("id", placeId)
      .maybeSingle();
    if (error) return { ok: false, error: `place_read: ${error.message}` };
    return {
      ok: true,
      partnered: (data as { partnered?: boolean } | null)?.partnered === true,
      joined: false,
      dropped: false,
    };
  }

  const partnered = outcome === "entitle";

  // Read the plan columns BEFORE the write: the join / drop decision and the
  // "did anything move" answer both come from the row as it stands.
  const { data: before, error: readErr } = await admin
    .from("places")
    .select("id, plan, listing_type, plan_forfeited_at")
    .eq("id", placeId)
    .maybeSingle();
  if (readErr) return { ok: false, error: `place_read: ${readErr.message}` };
  if (!before) return { ok: false, error: "place_read: no row" };

  const row = before as PlacePartnershipRow;
  const currentPlan = row.plan ?? "free";
  // Counted from the same predicates join/dropPlacePatch use, so the answer
  // reports what actually moved rather than that a row was visited.
  const willChange = partnered
    ? currentPlan === "free" || !!row.plan_forfeited_at
    : currentPlan !== "free";

  const { data: place, error: placeErr } = await admin
    .from("places")
    .update({ partnered })
    .eq("id", placeId)
    .select("id, partnered")
    .single();
  if (placeErr || !place) {
    return { ok: false, error: `place_update: ${placeErr?.message ?? "no row"}` };
  }

  const write = await writePlacePartnership(admin, row, partnered);
  if (!write.ok) return { ok: false, error: `place_update: ${write.error}` };

  return {
    ok: true,
    partnered: (place as { partnered: boolean }).partnered === true,
    joined: willChange && partnered,
    dropped: willChange && !partnered,
  };
}

export type PartnerMembershipRow = {
  state: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  price_cents: number | null;
  currency: string;
};

/** A `mock_*` id is MOCK_SUBSCRIPTION's placeholder, never a Stripe
 *  subscription. It must not read as one on the real path: a place that got a
 *  mock grant while the flag was on would otherwise be a permanent partner
 *  with nothing billable behind it, unable to buy even when it wanted to.
 *  Same rule `business-web-change-subscription` applies to place rows. */
export function isMockSubscriptionId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("mock_");
}

/**
 * The place's live membership, or null. At most one row by construction —
 * `partner_memberships_one_live` is a unique partial index on exactly these
 * two states.
 */
export async function readLiveMembership(
  admin: SupabaseClient,
  placeId: string,
): Promise<
  { ok: true; row: PartnerMembershipRow | null } | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("partner_memberships")
    .select(
      "state, stripe_subscription_id, current_period_end, cancel_at_period_end, price_cents, currency",
    )
    .eq("place_id", placeId)
    .in("state", LIVE_MEMBERSHIP_STATES)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: (data as PartnerMembershipRow | null) ?? null };
}
