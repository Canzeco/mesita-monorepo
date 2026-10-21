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
  phone: string | null;
  // Claimed Instagram username (MESITA-74) — normalized, no leading @.
  instagram_handle: string | null;
  // The follower count the guest claimed with the handle. Optional so an
  // older EF payload still reads; absent reads as 0.
  instagram_followers_count?: number | null;
  // MESITA-2585: may verifying Instagram set the picture? Absent on an older
  // EF reads as on (the column defaults true).
  use_instagram_photo?: boolean;
  // MESITA-2590: Settings › Social › "Public profile" off = true (MESITA-2594 name).
  appear_anonymous?: boolean;
  // Consumer avatar public URL (consumer-avatars bucket). Optional — missing
  // falls back to DefaultAvatar on Me / Personal details (MESITA-880/953).
  avatar_url?: string | null;
  // MESITA-2553: Class (regular or vip, through a partner) and Plan (free or
  // pro), two independent facts on the identity card. Set by an operator
  // only; absent or unknown reads as the plain value (lib/guest-standing).
  guest_class?: string;
  plan?: string;
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

// "Use my Instagram photo" on Me › Instagram (MESITA-2585). Off also takes
// down a picture that was copied from Instagram.
type ConsumerInstagramPhotoPatch = {
  use_instagram_photo: boolean;
};

// "Public profile" in Settings and Me › Instagram (MESITA-2590, MESITA-2594). Off = appear as
// "A member".
type ConsumerAppearAnonymousPatch = {
  appear_anonymous: boolean;
};

export async function apiUpdateConsumerProfile(
  client: SupabaseClient,
  input:
    | ConsumerOnboardingInput
    | ConsumerAvatarPatch
    | ConsumerInstagramPhotoPatch
    | ConsumerAppearAnonymousPatch,
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

// ─── Instagram claim ─────────────────────────────────────────────────────

// consumer-web-claim-instagram (MESITA-2461): a handle is proved, not typed.
// `start` hands back a one-time code for the guest's bio; `check` has the
// server read the bio and, only if the code is there, store the handle with
// the follower count it scraped. The app never sends a count; the count
// against INSTAGRAM_REACH_FOLLOWERS is still what makes the account verified
// (consumer-identity.ts).
export async function apiStartInstagramClaim(
  client: SupabaseClient,
  handle: string,
): Promise<{ handle: string; code: string }> {
  return await invokeEF<{ handle: string; code: string }>(
    client,
    "consumer-web-claim-instagram",
    { action: "start", handle },
  );
}

// By DM (MESITA-2575): the guest sends the code to Mesita's Instagram and
// the server learns the handle, followers and photo from Meta. `channel`
// says whether that is switched on; until then the bio flow above is used.
export type InstagramChannel =
  | { channel: "dm"; account: string; link: string }
  | { channel: "bio" };

export async function apiInstagramChannel(
  client: SupabaseClient,
): Promise<InstagramChannel> {
  return await invokeEF<InstagramChannel>(client, "consumer-web-claim-instagram", {
    action: "channel",
  });
}

export type InstagramDmClaim = {
  code: string;
  account: string;
  link: string;
  issuedAt: string;
};

export async function apiStartInstagramDm(
  client: SupabaseClient,
): Promise<InstagramDmClaim> {
  return await invokeEF<InstagramDmClaim>(client, "consumer-web-claim-instagram", {
    action: "start_dm",
  });
}

export type InstagramDmStatus = {
  pending: boolean;
  handle: string | null;
  verifiedAt: string | null;
};

export async function apiInstagramDmStatus(
  client: SupabaseClient,
): Promise<InstagramDmStatus> {
  return await invokeEF<InstagramDmStatus>(client, "consumer-web-claim-instagram", {
    action: "dm_status",
  });
}

/** The DM landed: the claim is spent and the account was proved after the
 *  code was issued. */
export function dmVerified(status: InstagramDmStatus, issuedAt: string): boolean {
  if (status.pending || !status.handle || !status.verifiedAt) return false;
  return Date.parse(status.verifiedAt) >= Date.parse(issuedAt);
}

export async function apiCheckInstagramClaim(
  client: SupabaseClient,
): Promise<{ handle: string; followers: number }> {
  return await invokeEF<{ handle: string; followers: number }>(
    client,
    "consumer-web-claim-instagram",
    { action: "check" },
  );
}
