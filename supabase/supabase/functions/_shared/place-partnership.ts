// Place-level Partner (MESITA-1798, re-scoped by MESITA-1892).
//
// Partner is a fact about the PLACE now: a binary switch on its Settings,
// labeled Partner (on/off — never "Not Partner"). Turning it on:
//   • writes places.partnered
//   • joins the place at plan=pro Zero (listing_type stays web until a paid
//     strategy is picked — existing partner-derivation)
// Turning it off reverses both.
//
// IT USED TO WRITE THE PAY BIT TOO, and it deliberately no longer does.
// There were two Mesita Pay bits, the organization's and the place's, and
// `profiles.mesita_pay_enabled` ANDed them; this switch owned the org's half.
// MESITA-1892 collapsed them into one column on `place_profiles`, and that
// column already has exactly ONE writer — `_shared/place-rails.ts`. A second
// writer for one bit is how a switch and a page end up disagreeing about what
// is on, so the coupling ends here rather than being re-pointed. This also
// finishes what MESITA-1867/1868 started: buying or being granted a
// partnership must never start charging a restaurant's guests.
//
// Stripe Ready (charges_enabled ∧ details_submitted) is still the LOCK on the
// switch, and it is KEPT ON PURPOSE even though the Pay coupling it guarded
// is gone: loosening a money gate is not this issue's business. A Partner is a
// merchant, and a merchant has an account that can take a charge.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isConnectChargeReady } from "./payment-account-doc.ts";
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

export type SetPlacePartnershipResult =
  | {
    ok: true;
    partnered: boolean;
    /** Did this call move the place onto the pro plan / off it? Reported
     *  rather than assumed, because flipping to the current value is legal
     *  and must say that nothing moved. */
    joined: boolean;
    dropped: boolean;
  }
  | { ok: false; status: number; code: string; error: string };

/**
 * The body of business-web-set-partner-status. Auth is the caller's job.
 * Idempotent: flipping to the current value still re-applies the plan patch,
 * so a place that raced the toggle still lands joined.
 */
export async function setPlacePartnership(
  admin: SupabaseClient,
  placeId: string,
  partnered: boolean,
): Promise<SetPlacePartnershipResult> {
  if (partnered) {
    const account = await admin
      .from("place_payment_accounts")
      .select("charges_enabled, details_submitted")
      .eq("place_id", placeId)
      .maybeSingle();
    if (account.error) {
      return {
        ok: false,
        status: 500,
        code: "stripe_read",
        error: account.error.message,
      };
    }
    const row = account.data as {
      charges_enabled: boolean;
      details_submitted: boolean;
    } | null;
    if (!isConnectChargeReady(row)) {
      return {
        ok: false,
        status: 409,
        code: "stripe_not_ready",
        error: "Connect Stripe first — Partner needs a Ready account.",
      };
    }
  }

  // READ BEFORE WRITE, and read the plan columns in the same trip: the join /
  // drop patch is decided from the row as it stands, and `writePlacePartnership`
  // returns a no-op for a place already in the target state.
  const { data: place, error: readErr } = await admin
    .from("places")
    .select("id, plan, listing_type, plan_forfeited_at")
    .eq("id", placeId)
    .maybeSingle();
  if (readErr) {
    return { ok: false, status: 500, code: "place_read", error: readErr.message };
  }
  if (!place) {
    return { ok: false, status: 404, code: "place_not_found", error: "No such place." };
  }

  const row = place as PlacePartnershipRow;
  const moved = joiningCount(row, partnered);

  const { data: written, error: writeErr } = await admin
    .from("places")
    .update({ partnered })
    .eq("id", placeId)
    .select("id, partnered")
    .single();
  if (writeErr || !written) {
    return {
      ok: false,
      status: 500,
      code: "place_update",
      error: writeErr?.message ?? "Update failed",
    };
  }

  const patch = await writePlacePartnership(admin, row, partnered);
  if (!patch.ok) {
    return { ok: false, status: 500, code: "place_update", error: patch.error };
  }

  return {
    ok: true,
    partnered: (written as { partnered: boolean }).partnered === true,
    joined: moved === "join",
    dropped: moved === "drop",
  };
}

function joiningCount(
  row: PlacePartnershipRow,
  partnered: boolean,
): "join" | "drop" | "skip" {
  if (partnered) return joinPlacePatch(row) ? "join" : "skip";
  return dropPlacePatch(row) ? "drop" : "skip";
}
