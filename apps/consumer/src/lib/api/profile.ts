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
  // Account-level visibility flags (MESITA-76) — Settings → Social toggles.
  profile_public: boolean;
  profile_show_saves: boolean;
  profile_show_visits: boolean;
};

// Class payload returned alongside the profile by consumer-web-get-profile.
// The real class/origin/subscription state for the signed-in consumer — what
// the (shell) layout feeds into the ClassProvider so every client
// surface renders the consumer's actual class instead of a hardcoded mock.
export type ConsumerClass = {
  key: "free" | "premium";
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

type ConsumerOnboardingInput = {
  first_name: string;
  last_name: string;
  sex: "male" | "female" | "other";
  birthday: string; // YYYY-MM-DD
  country: string;
  // Optional — phone is the auth identity and lives on auth.user.phone.
  // consumer-update-profile mirrors it into consumers.phone on first call.
  phone?: string;
};

export async function apiUpdateConsumerProfile(
  client: SupabaseClient,
  input: ConsumerOnboardingInput,
): Promise<ConsumerProfile> {
  const { consumer } = await invokeEF<{ consumer: ConsumerProfile }>(
    client,
    "consumer-web-update-profile",
    input,
  );
  return consumer;
}

// Visibility-only patch for consumer-web-update-profile. The EF patches just
// the keys present, so identity fields are untouched.
export type ProfileVisibilityPatch = {
  profile_public?: boolean;
  profile_show_saves?: boolean;
  profile_show_visits?: boolean;
};

export async function apiUpdateProfileVisibility(
  client: SupabaseClient,
  patch: ProfileVisibilityPatch,
): Promise<ConsumerProfile> {
  const { consumer } = await invokeEF<{ consumer: ConsumerProfile }>(
    client,
    "consumer-web-update-profile",
    patch,
  );
  return consumer;
}

export async function apiFetchConsumerProfile(
  client: SupabaseClient,
): Promise<{ consumer: ConsumerProfile; consumerClass: ConsumerClass }> {
  const { consumer, class: consumerClass } = await invokeEF<{
    consumer: ConsumerProfile;
    class: ConsumerClass;
  }>(client, "consumer-web-get-profile", {});
  return { consumer, consumerClass };
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

// consumer-web-claim-instagram: the social door into Premium. 1,000+
// followers grants Premium with origin "instagram"; below the threshold an
// instagram-origin Premium is dropped back to Free. The handle is persisted
// to consumers.instagram_handle.
export type InstagramClaimResult = {
  tier: "free" | "premium";
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
