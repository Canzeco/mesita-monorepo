// Frontend API surface for the consumer-facing profile EFs.
//
// Pre-entity-split this file used to also house the ticket workflow /
// taxonomy code under the name `api/tickets.ts`. After the split
// (reservations + coupons each got their own EFs) the ticket helpers
// were dropped and the file was renamed to its current responsibility:
// fetch + update the consumer profile, plus the currency display
// helper that every money surface reuses.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// ─── Consumer profile ───────────────────────────────────────────────────────

export type ConsumerProfile = {
  id: string;
  code: string;
  // Legacy concat of first + last. EFs keep it populated on every write
  // so older readers (find-consumer search, ticket meta) keep working.
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  sex: string | null;
  birthday: string | null;
  country: string | null;
  phone: string | null;
  // Claimed Instagram username (MESITA-74) — normalized, no leading @.
  instagram_handle: string | null;
  // Consumer avatar. Optional + forward-compatible: the Me page renders it the
  // moment consumer-web-get-profile starts returning it, and falls back to
  // initials until then. The upload/storage/EF half is a separate,
  // human-gated change. (Salvaged from the closed design-review PR #362.)
  avatar_url?: string | null;
  // Account-level visibility flags (MESITA-76 / MESITA-913) — Settings → Privacy.
  // profile_public=false → Private account (anonymous to other guests).
  // profile_show_stories → Mesita story visibility (independent of Instagram).
  profile_public: boolean;
  profile_show_saves: boolean;
  profile_show_visits: boolean;
  profile_show_stories: boolean;
};

// Class payload returned alongside the profile by consumer-web-get-profile.
// The real class/origin/subscription state for the signed-in consumer — what
// the (shell) layout feeds into the ClassProvider so every client
// surface renders the consumer's actual class instead of a hardcoded mock.
export type ConsumerClass = {
  key: "standard" | "premium" | "influencer" | "aura";
  origin: "default" | "instagram" | "subscription" | "invitation";
  label: string;
  followers: number | null;
  /** consumers.class_expires_at — when a non-default class lapses. */
  expires_at: string | null;
  subscription: {
    status: string;
    price_cents: number;
    currency: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  usage: {
    reservations_used: number;
    reservations_limit: number | null;
  };
};

// Passport stats returned by consumer-web-get-profile (MESITA-888).
// `visits` = tickets the v3 close sealed ("revealed") — completed visits.
export type ConsumerStats = {
  visits: number;
};

// Lifetime counters from consumer-web-get-metrics (MESITA-904) — the Me →
// Metrics sheet (10 tiles). Fetched lazily when the sheet opens, never on
// shell load. places_visited === rewards_claimed always (same EF source).
export type ConsumerMetrics = {
  /** Place-detail opens — not tracked yet; EF returns 0. */
  places_viewed: number;
  /** Saved places. */
  places_saved: number;
  /** Revealed tickets — same value as rewards_claimed. */
  places_visited: number;
  /** Revealed tickets (reward claims). */
  rewards_claimed: number;
  /** Confirmed, non-test reservations (all time). */
  reservations_booked: number;
  /** Mesita post-visit reviews (ticket_reviews). */
  mesita_reviews: number;
  /** Verified Google reviews on tickets. */
  google_reviews: number;
  /** Verified Instagram stories on tickets. */
  instagram_stories: number;
  /** Guest-paid cents on revealed tickets (bill − discount). */
  spent_cents: number;
  /** Discount cents earned on revealed tickets. */
  saved_cents: number;
};

export async function apiFetchConsumerMetrics(
  client: SupabaseClient,
): Promise<ConsumerMetrics> {
  const { metrics } = await invokeEF<{ metrics: ConsumerMetrics }>(
    client,
    "consumer-web-get-metrics",
    {},
  );
  return metrics;
}

type ConsumerOnboardingInput = {
  // First + last name are both required everywhere the consumer writes their
  // name: the EF joins them into full_name, which is the name the reservation
  // agent books the table under. The EF rejects one without the other.
  first_name: string;
  last_name: string;
  // Male/Female only (MESITA-727). Optional so callers that don't edit sex
  // (e.g. the Edit-profile sheet) omit it — the EF patches only present keys.
  sex?: "male" | "female";
  birthday: string; // YYYY-MM-DD
  // Optional — phone is the auth identity and lives on auth.user.phone.
  // Set at sign-in; consumer-update-profile mirrors it into consumers.phone
  // on first call. Not editable from the profile sheet.
  phone?: string;
};

// Visibility-only patches (MESITA-913). Name fields are omitted so the EF
// doesn't require the first/last pair for a privacy toggle flip.
export type ConsumerPrivacyPatch = {
  profile_public?: boolean;
  profile_show_saves?: boolean;
  profile_show_visits?: boolean;
  profile_show_stories?: boolean;
};

export async function apiUpdateConsumerProfile(
  client: SupabaseClient,
  input: ConsumerOnboardingInput | ConsumerPrivacyPatch,
): Promise<ConsumerProfile> {
  const { consumer } = await invokeEF<{ consumer: ConsumerProfile }>(
    client,
    "consumer-web-update-profile",
    input,
  );
  return consumer;
}

export async function apiFetchConsumerProfile(client: SupabaseClient): Promise<{
  consumer: ConsumerProfile;
  consumerClass: ConsumerClass;
  stats: ConsumerStats;
}> {
  // `stats` is optional in the response type so a not-yet-redeployed EF
  // degrades to zeroes instead of breaking the profile read.
  const {
    consumer,
    class: consumerClass,
    stats,
  } = await invokeEF<{
    consumer: ConsumerProfile;
    class: ConsumerClass;
    stats?: ConsumerStats;
  }>(client, "consumer-web-get-profile", {});
  return { consumer, consumerClass, stats: stats ?? { visits: 0 } };
}

// ─── Account deletion ────────────────────────────────────────────────────

// consumer-web-delete-account: irreversibly deletes the caller's account —
// tickets first (RESTRICT FK), then the auth user (consumers row cascades).
// The session is dead server-side afterwards; callers must locally sign out
// and hard-navigate.
export async function apiDeleteConsumerAccount(
  client: SupabaseClient,
): Promise<void> {
  await invokeEF<{ id: string }>(client, "consumer-web-delete-account", {});
}

// ─── Instagram claim ─────────────────────────────────────────────────────

// consumer-web-claim-instagram: the social door into Influencer (segments
// v6). Crossing classes.follower_threshold (2,000) grants Influencer with
// origin "instagram"; below the threshold an instagram-origin class falls
// back (live subscription → premium, else standard). The handle is persisted
// to consumers.instagram_handle. `tier` echoes the resulting class key.
type InstagramClaimResult = {
  tier: string;
  followers: number;
  handle: string | null;
};

export async function apiClaimInstagram(
  client: SupabaseClient,
  input: { followers: number; handle: string },
): Promise<InstagramClaimResult> {
  return await invokeEF<InstagramClaimResult>(
    client,
    "consumer-web-claim-instagram",
    input,
  );
}

// ─── Display helpers ─────────────────────────────────────────────────────

export function formatCurrency(
  cents: number | null | undefined,
  currency = "MXN",
): string {
  if (cents == null) return "—";
  const value = cents / 100;
  try {
    // Intl with `en-US` + `MXN` yields the unambiguous "MX$1,234" prefix
    // (Mexican-locale formatting would collapse to just "$1,234", which
    // reads as USD outside Mexico). Other ISO codes still format with
    // their conventional prefix ("$", "€", etc.).
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency === "MXN" ? "MX$" : "$"}${value.toFixed(0)}`;
  }
}
