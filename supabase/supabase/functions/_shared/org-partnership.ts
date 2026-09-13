// Org-level Partner (MESITA-1798).
//
// Stripe is one connected account per organization. Partner is the next
// org fact: a binary switch on the Organization screen, labeled Partner
// (on/off — never "Not Partner"). Turning it on:
//   • writes organizations.partnered
//   • turns on organizations.mesita_pay_enabled (the payments package a
//     Partnered org turns on once — Checkout §0; the column existed with
//     no writer)
//   • joins every held place at plan=pro Zero (listing_type stays web
//     until a paid strategy is picked — existing partner-derivation)
// Turning it off reverses all three.
//
// Stripe Ready (charges_enabled ∧ details_submitted) is the LOCK on the
// switch, not the fact. The EF refuses ON without it.

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

export type SetOrgPartnershipResult =
  | {
    ok: true;
    partnered: boolean;
    mesitaPayEnabled: boolean;
    placesJoined: number;
    placesDropped: number;
  }
  | { ok: false; status: number; code: string; error: string };

/**
 * The body of business-web-set-org-partnership. Auth is the caller's job.
 * Idempotent on the org bit: flipping to the current value still cascades
 * held places so a claim that raced the toggle still lands joined.
 */
export async function setOrgPartnership(
  admin: SupabaseClient,
  orgId: string,
  partnered: boolean,
): Promise<SetOrgPartnershipResult> {
  if (partnered) {
    const account = await admin
      .from("organization_payment_accounts")
      .select("charges_enabled, details_submitted")
      .eq("organization_id", orgId)
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

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .update({
      partnered,
      mesita_pay_enabled: partnered,
    })
    .eq("id", orgId)
    .select("id, partnered, mesita_pay_enabled")
    .single();
  if (orgErr || !org) {
    return {
      ok: false,
      status: 500,
      code: "org_update",
      error: orgErr?.message ?? "Update failed",
    };
  }

  const { data: places, error: placesErr } = await admin
    .from("places")
    .select("id, plan, listing_type, plan_forfeited_at")
    .eq("organization_id", orgId);
  if (placesErr) {
    return {
      ok: false,
      status: 500,
      code: "places_read",
      error: placesErr.message,
    };
  }

  let placesJoined = 0;
  let placesDropped = 0;
  for (const p of (places ?? []) as PlacePartnershipRow[]) {
    const before = joiningCount(p, partnered);
    const write = await writePlacePartnership(admin, p, partnered);
    if (!write.ok) {
      return {
        ok: false,
        status: 500,
        code: "place_update",
        error: write.error,
      };
    }
    if (before === "join") placesJoined += 1;
    if (before === "drop") placesDropped += 1;
  }

  const written = org as {
    partnered: boolean;
    mesita_pay_enabled: boolean;
  };
  return {
    ok: true,
    partnered: written.partnered === true,
    mesitaPayEnabled: written.mesita_pay_enabled === true,
    placesJoined,
    placesDropped,
  };
}

function joiningCount(
  row: PlacePartnershipRow,
  partnered: boolean,
): "join" | "drop" | "skip" {
  if (partnered) return joinPlacePatch(row) ? "join" : "skip";
  return dropPlacePatch(row) ? "drop" : "skip";
}
