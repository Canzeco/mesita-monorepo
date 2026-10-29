// Frontend API surface for the consumer-facing profile EFs: fetch + update
// the consumer profile, delete the account, claim an Instagram handle.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import { PROFILE_KEY, readCached, writeCached } from "@/lib/screen-cache";

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
  // falls back to DefaultAvatar on Me / Profile (MESITA-880/953).
  avatar_url?: string | null;
  // MESITA-2553: Class (regular or vip, through a partner) and Plan (free or
  // pro), two independent facts on the identity card. Set by an operator
  // only; absent or unknown reads as the plain value (lib/guest-standing).
  guest_class?: string;
  plan?: string;
  // MESITA-2556: for a VIP, the partner's name and the last day (YYYY-MM-DD),
  // each null when none is recorded. Shown only on the guest's own Class sheet.
  vip_partner?: string | null;
  vip_until?: string | null;
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

// "Public profile" in Settings and Me › Instagram (MESITA-2590, MESITA-2594). Off = no photo
// or handle in Social; the first name still shows (MESITA-2612).
type ConsumerAppearAnonymousPatch = {
  appear_anonymous: boolean;
};

/** Join VIP (MESITA-3054): a 12-digit invitation code (emulated on the server:
 *  any 12 digits) or the guest's connected Instagram at 1,000+ followers. Any
 *  200 is VIP (`joined: false` = already was). The cache is patched FIRST, so
 *  every reader shows VIP even if the refetch fails, and a refetch that comes
 *  back Regular never overwrites it. */
export async function apiJoinClass(
  client: SupabaseClient,
  body: { via: "code"; code: string } | { via: "instagram" },
): Promise<void> {
  await invokeEF<{ guest_class: "vip"; joined: boolean }>(
    client,
    "consumer-web-join-class",
    body,
  );
  const cached = readCached<ConsumerProfile>(PROFILE_KEY);
  if (cached) writeCached(PROFILE_KEY, { ...cached, guest_class: "vip" });
  try {
    const { consumer } = await apiFetchConsumerProfile(client);
    if (consumer.guest_class === "vip") writeCached(PROFILE_KEY, consumer);
  } catch {
    // The join stands; the patched cache already reads VIP.
  }
}

/** Leave VIP, back to Regular (MESITA-3054). Same cache order as a join:
 *  patch first, and a refetch that still says VIP never overwrites it. */
export async function apiLeaveClass(client: SupabaseClient): Promise<void> {
  await invokeEF<{ guest_class: "regular"; left: boolean }>(
    client,
    "consumer-web-join-class",
    { via: "leave" },
  );
  const cached = readCached<ConsumerProfile>(PROFILE_KEY);
  if (cached) {
    writeCached(PROFILE_KEY, {
      ...cached,
      guest_class: "regular",
      vip_partner: null,
      vip_until: null,
    });
  }
  try {
    const { consumer } = await apiFetchConsumerProfile(client);
    if (consumer.guest_class !== "vip") writeCached(PROFILE_KEY, consumer);
  } catch {
    // The change stands; the patched cache already reads Regular.
  }
}

/** After a refused Instagram join: the server's count, so the row re-locks
 *  with it. Best effort. */
export async function apiRefreshConsumerProfile(
  client: SupabaseClient,
): Promise<void> {
  try {
    const { consumer } = await apiFetchConsumerProfile(client);
    writeCached(PROFILE_KEY, consumer);
  } catch {
    // Keep what is there.
  }
}

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
  // Every screen that reads the profile sees the saved row at once
  // (MESITA-3014). A no-op on the server.
  writeCached(PROFILE_KEY, consumer);
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

// By DM (MESITA-2575): the guest sends the code to Mesita's Instagram and
// the server learns the handle, followers and photo from Meta. `channel`
// says whether that is switched on; until then the bio flow above is used.
export type InstagramChannel =
  { channel: "dm"; account: string; link: string } | { channel: "bio" };

export async function apiInstagramChannel(
  client: SupabaseClient,
): Promise<InstagramChannel> {
  return await invokeEF<InstagramChannel>(
    client,
    "consumer-web-claim-instagram",
    {
      action: "channel",
    },
  );
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
  return await invokeEF<InstagramDmClaim>(
    client,
    "consumer-web-claim-instagram",
    {
      action: "start_dm",
    },
  );
}

export type InstagramDmStatus = {
  pending: boolean;
  handle: string | null;
  verifiedAt: string | null;
};

export async function apiInstagramDmStatus(
  client: SupabaseClient,
): Promise<InstagramDmStatus> {
  return await invokeEF<InstagramDmStatus>(
    client,
    "consumer-web-claim-instagram",
    {
      action: "dm_status",
    },
  );
}

// ─── Instagram connect by username (MESITA-3039) ─────────────────────────

// While the DM channel is off: the server scrapes the typed username (Apify)
// and stores the handle, followers and photo on the account. For testing:
// the username is trusted. `photo` says whether the photo became the avatar.
export type InstagramLookup = {
  source: "apify";
  profile: {
    username: string;
    profilePictureUrl: string | null;
    followerCount: number;
  };
  photo: boolean;
};

export async function apiLookupInstagram(
  client: SupabaseClient,
  username: string,
): Promise<InstagramLookup> {
  return await invokeEF<InstagramLookup>(
    client,
    "consumer-web-lookup-instagram",
    { username, confirmed: true },
  );
}

/** Takes the Instagram off the account: handle, followers and a picture
 *  copied from it (MESITA-3052). The page confirms first. */
export async function apiDisconnectInstagram(
  client: SupabaseClient,
): Promise<void> {
  await invokeEF(client, "consumer-web-claim-instagram", {
    action: "disconnect",
  });
}

/** The DM landed: the claim is spent and the account was proved after the
 *  code was issued. */
export function dmVerified(
  status: InstagramDmStatus,
  issuedAt: string,
): boolean {
  if (status.pending || !status.handle || !status.verifiedAt) return false;
  return Date.parse(status.verifiedAt) >= Date.parse(issuedAt);
}

// ─── Account deletion ────────────────────────────────────────────────────

// consumer-web-delete-account: irreversibly closes the caller's account —
// Premier pledges ended first, then the account tombstoned or deleted. The
// session is dead server-side afterwards; callers must locally sign out and
// hard-navigate.
export async function apiDeleteConsumerAccount(
  client: SupabaseClient,
): Promise<void> {
  await invokeEF<{ id: string }>(client, "consumer-web-delete-account", {});
}
