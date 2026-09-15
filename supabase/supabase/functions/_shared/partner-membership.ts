// Mesita Membership — the yearly subscription that makes an organization a
// Partner (MESITA-1877).
//
// THE NAME. The thing you buy is the Membership; the thing you become is a
// Partner. `partner-membership.ts`, not `org-membership.ts`: that file already
// exists and answers "is this caller IN this organization, and how strongly" —
// membership of PEOPLE. Two files a letter apart meaning person-in-org and
// org-pays-Mesita is how a money path gets edited by accident.
//
// THE SHAPE. `partner_memberships` is BILLING; `organizations.partnered` is
// ENTITLEMENT. The console, the profiles view and the guest lane all read the
// second. This file is the only place that derives one from the other, so
// there is exactly one answer to "is this organization a partner because it
// paid".
//
// ── LAPSE ≠ DROP ──────────────────────────────────────────────────────────
//
// A yearly MX card declines. Stripe moves the subscription to `past_due` and
// starts dunning; it may well recover on the third retry a week later. If that
// moment dropped the partnership, `dropPlacePatch` would null four rate columns
// and the monthly cap on EVERY held place — and recovering the card a week
// later would bring those places back at ZERO rates, the operator's whole
// discount configuration gone, silently, because a bank said no once.
//
// So the ladder is:
//
//   active / trialing   entitle — partnered, every held place joined at
//                       plan=pro Zero (the existing joinPlacePatch).
//   past_due            entitle, AND CHANGE NOTHING ELSE. Still a partner;
//                       Stripe is dunning; the console reads the mirror row's
//                       state to say the payment is due. No place is touched.
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
// WHAT THIS FILE NEVER WRITES: `organizations.mesita_pay_enabled`. Paying for
// the Membership does not switch card payments on — that is the add-on, with
// its own switch and its own Stripe Ready lock (MESITA-1867 undid the coupling
// in the console; MESITA-1868 gives Pay its own writer). Buying a partnership
// must never start charging a restaurant's guests.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type PlacePartnershipRow,
  writePlacePartnership,
} from "./org-partnership.ts";

/** The one row in `org_plans` — the yearly Mesita Membership. */
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
    placesJoined: number;
    placesDropped: number;
  }
  | { ok: false; error: string };

/**
 * Writes the entitlement an outcome implies. Idempotent both ways:
 * `joinPlacePatch` / `dropPlacePatch` return null for a place already in the
 * target state, so a replayed webhook writes nothing at all.
 *
 * Deliberately NOT `setOrgPartnership`. That one is the operator switch's
 * body: it refuses without a Ready Connect account — Membership is not
 * Stripe-locked any more — and it writes `mesita_pay_enabled` alongside,
 * which is the coupling this issue undoes.
 */
export async function applyMembershipEntitlement(
  admin: SupabaseClient,
  orgId: string,
  outcome: MembershipOutcome,
): Promise<ApplyMembershipResult> {
  if (outcome === "mirror") {
    const { data, error } = await admin
      .from("organizations")
      .select("partnered")
      .eq("id", orgId)
      .maybeSingle();
    if (error) return { ok: false, error: `org_read: ${error.message}` };
    return {
      ok: true,
      partnered: (data as { partnered?: boolean } | null)?.partnered === true,
      placesJoined: 0,
      placesDropped: 0,
    };
  }

  const partnered = outcome === "entitle";

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .update({ partnered })
    .eq("id", orgId)
    .select("id, partnered")
    .single();
  if (orgErr || !org) {
    return { ok: false, error: `org_update: ${orgErr?.message ?? "no row"}` };
  }

  const { data: places, error: placesErr } = await admin
    .from("places")
    .select("id, plan, listing_type, plan_forfeited_at")
    .eq("organization_id", orgId);
  if (placesErr) {
    return { ok: false, error: `places_read: ${placesErr.message}` };
  }

  let placesJoined = 0;
  let placesDropped = 0;
  for (const place of (places ?? []) as PlacePartnershipRow[]) {
    const currentPlan = place.plan ?? "free";
    // Counted BEFORE the write, from the same predicates join/dropPlacePatch
    // use, so the numbers report what actually moved rather than how many
    // rows were visited.
    const willChange = partnered
      ? currentPlan === "free" || !!place.plan_forfeited_at
      : currentPlan !== "free";
    const write = await writePlacePartnership(admin, place, partnered);
    if (!write.ok) return { ok: false, error: `place_update: ${write.error}` };
    if (willChange) {
      if (partnered) placesJoined += 1;
      else placesDropped += 1;
    }
  }

  return {
    ok: true,
    partnered: (org as { partnered: boolean }).partnered === true,
    placesJoined,
    placesDropped,
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
 *  subscription. It must not read as one on the real path: an org that got a
 *  mock grant while the flag was on would otherwise be a permanent partner
 *  with nothing billable behind it, unable to buy even when it wanted to.
 *  Same rule `business-web-change-subscription` applies to place rows. */
export function isMockSubscriptionId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("mock_");
}

/**
 * The organization's live membership, or null. At most one row by
 * construction — `partner_memberships_one_live` is a unique partial index on
 * exactly these two states.
 */
export async function readLiveMembership(
  admin: SupabaseClient,
  orgId: string,
): Promise<
  { ok: true; row: PartnerMembershipRow | null } | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("partner_memberships")
    .select(
      "state, stripe_subscription_id, current_period_end, cancel_at_period_end, price_cents, currency",
    )
    .eq("organization_id", orgId)
    .in("state", LIVE_MEMBERSHIP_STATES)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: (data as PartnerMembershipRow | null) ?? null };
}
