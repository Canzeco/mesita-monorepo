// Frontend API surface for the consumer-facing profile EFs: fetch + update
// the consumer profile, delete the account, claim an Instagram handle.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// ─── Consumer profile ───────────────────────────────────────────────────────

export type ConsumerProfile = {
  id: string;
  code: string;
  // Legacy concat of first + last. EFs keep it populated on every write
  // so older readers (find-consumer search) keep working.
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  sex: string | null;
  birthday: string | null;
  country: string | null;
  phone: string | null;
  // Claimed Instagram username (MESITA-74) — normalized, no leading @.
  instagram_handle: string | null;
  // The follower count the guest claimed with the handle. Optional so an
  // older EF payload still reads; absent reads as 0.
  instagram_followers_count?: number | null;
  // Consumer avatar public URL (consumer-avatars bucket). Optional — missing
  // falls back to DefaultAvatar on Me / Personal details (MESITA-880/953).
  avatar_url?: string | null;
};

type ConsumerOnboardingInput = {
  // Each half of the name is written INDEPENDENTLY (MESITA-1806): onboarding
  // sends first_name, the reservation sheet sends last_name, and the
  // Edit-profile sheet sends both. The EF merges an absent half from the
  // stored row before rebuilding full_name — what it still refuses is a half
  // sent BLANK, which would leave a consumer no place can be told to expect.
  first_name?: string;
  last_name?: string;
  // Male/Female only (MESITA-727). Optional so callers that don't edit sex
  // (e.g. the Edit-profile sheet) omit it — the EF patches only present keys.
  sex?: "male" | "female";
  birthday?: string; // YYYY-MM-DD
};

// Avatar-only patch after a Storage upload (MESITA-953). null clears.
type ConsumerAvatarPatch = {
  avatar_url: string | null;
};

export async function apiUpdateConsumerProfile(
  client: SupabaseClient,
  input: ConsumerOnboardingInput | ConsumerAvatarPatch,
): Promise<ConsumerProfile> {
  const { consumer } = await invokeEF<{ consumer: ConsumerProfile }>(
    client,
    "consumer-web-update-profile",
    input,
  );
  return consumer;
}

// consumer-web-get-profile lazily creates the row, so a brand-new account
// reads back successfully (just with null fields).
export async function apiFetchConsumerProfile(
  client: SupabaseClient,
): Promise<{ consumer: ConsumerProfile }> {
  const { consumer } = await invokeEF<{ consumer: ConsumerProfile }>(
    client,
    "consumer-web-get-profile",
    {},
  );
  return { consumer };
}

// ─── Account deletion ────────────────────────────────────────────────────

// consumer-web-delete-account: irreversibly deletes the caller's account —
// everything hanging off the consumer row first, then the auth user. The
// session is dead server-side afterwards; callers must locally sign out and
// hard-navigate.
export async function apiDeleteConsumerAccount(
  client: SupabaseClient,
): Promise<void> {
  await invokeEF<{ id: string }>(client, "consumer-web-delete-account", {});
}

// ─── Instagram claim ─────────────────────────────────────────────────────

// consumer-web-claim-instagram: persists the claimed follower count and the
// handle to the consumer row. The handle is what makes the account
// "connected"; the count against INSTAGRAM_REACH_FOLLOWERS is what makes it
// verified (consumer-identity.ts).
type InstagramClaimResult = {
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
