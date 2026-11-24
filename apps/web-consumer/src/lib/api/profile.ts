// Frontend API surface for the consumer-facing profile EFs: fetch + update
// the consumer profile, delete the account, claim an Instagram handle.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import { PROFILE_KEY, writeCached } from "@/lib/screen-cache";

// ─── Consumer profile ───────────────────────────────────────────────────────

/** What other guests see of you (MESITA-4850). */
export type SocialLevel = "private" | "public";

export type ConsumerProfile = {
  id: string;
  code: string;
  // Legacy concat of first + last. EFs keep it populated on every write
  // so older readers (find-consumer search) keep working.
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  sex: string | null;
  // Legacy full date; the apps stopped writing it in MESITA-4302.
  birthday: string | null;
  // MESITA-4302: year of birth, the age source. Optional so a cached row from
  // before the column still reads (birthYearOf falls back to `birthday`).
  birth_year?: number | null;
  phone: string | null;
  // Claimed Instagram username (MESITA-74) — normalized, no leading @.
  instagram_handle: string | null;
  // The follower count the guest claimed with the handle. Optional so an
  // older EF payload still reads; absent reads as 0.
  instagram_followers_count?: number | null;
  // MESITA-3060: when the handle was connected and when it was last synced;
  // the card's "Updated …" is the later one. Optional (older EF payloads).
  instagram_verified_at?: string | null;
  instagram_synced_at?: string | null;
  // MESITA-4858: when a DM proved the account is theirs (the verified badge),
  // and what the VIP follower check answered, if the guest allowed it.
  instagram_proved_at?: string | null;
  instagram_vip_status?: "eligible" | "not_enough" | "not_public" | "unconfirmed" | null;
  // MESITA-4850: the privacy level and why it cannot leave Private, if it
  // cannot. The server decides both. Optional (older EF payloads).
  social_level?: SocialLevel;
  social_lock?: "minor" | "no_birth_year" | null;
  // MESITA-4662: the follower emulator (Stripe test mode only). A number
  // stands in for the real count in the Class; null = the real count.
  // emulator_available says whether the emulator box shows. Both optional
  // (older EF payloads read as off).
  instagram_followers_emulated?: number | null;
  emulator_available?: boolean;
  // MESITA-2585: may verifying Instagram set the picture? Absent on an older
  // EF reads as on (the column defaults true).
  use_instagram_photo?: boolean;
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
  // MESITA-4766: how a VIP got in, an invitation code (the only way
  // since MESITA-4849); null for a non-VIP. When an
  // invitation made them VIP. Optional (older EF payloads read as not VIP).
  vip_reason?: "code" | "instagram" | null;
  vip_invited_at?: string | null;
};

type ConsumerOnboardingInput = {
  // Each half of the name is written INDEPENDENTLY (MESITA-1806): onboarding
  // sends first_name, the reservation sheet sends last_name, and the
  // Edit-profile sheet sends both. The EF merges an absent half from the
  // stored row before rebuilding full_name — what it still refuses is a half
  // sent BLANK, which would leave a consumer no place can be told to expect.
  first_name?: string;
  last_name?: string;
  // Optional so callers that don't edit sex
  // (e.g. the Edit-profile sheet) omit it — the EF patches only present keys.
  sex?: "male" | "female" | "other";
  // MESITA-4302: year of birth; the EF checks current year − year >= 14.
  birth_year?: number;
};

// Avatar-only patch after a Storage upload (MESITA-953). null clears.
type ConsumerAvatarPatch = {
  avatar_url: string | null;
};

// The privacy level on Me › Profile (MESITA-4850).
type ConsumerSocialLevelPatch = {
  social_level: SocialLevel;
};

export async function apiUpdateConsumerProfile(
  client: SupabaseClient,
  input:
    | ConsumerOnboardingInput
    | ConsumerAvatarPatch
    | ConsumerSocialLevelPatch,
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

// MESITA-4858: the handle is saved unverified and never looked up; a DM proves
// it. `channel` says whether the bot is switched on.
export type InstagramChannel = { channel: "dm"; account: string; link: string } | { channel: "off" };

const CLAIM_EF = "consumer-web-claim-instagram";

export async function apiInstagramChannel(client: SupabaseClient): Promise<InstagramChannel> {
  return await invokeEF<InstagramChannel>(client, CLAIM_EF, { action: "channel" });
}

/** Saves the handle, unverified. */
export async function apiSetInstagram(client: SupabaseClient, handle: string): Promise<{ handle: string }> {
  return await invokeEF(client, CLAIM_EF, { action: "set", handle });
}

/** Takes the Instagram off the account. The page confirms first. */
export async function apiDisconnectInstagram(client: SupabaseClient): Promise<void> {
  await invokeEF(client, CLAIM_EF, { action: "disconnect" });
}

export type InstagramDmClaim = { code: string; handle: string; account: string; link: string };

/** `vipCheck`: the guest said yes to the follower check. */
export async function apiStartInstagramDm(client: SupabaseClient, vipCheck: boolean): Promise<InstagramDmClaim> {
  return await invokeEF<InstagramDmClaim>(client, CLAIM_EF, { action: "start_dm", vipCheck });
}

export type InstagramDmStatus = {
  status: "pending" | "wrong_account" | "expired" | "none";
  handle: string | null;
  provedAt: string | null;
  vipStatus: ConsumerProfile["instagram_vip_status"];
};

export async function apiInstagramDmStatus(client: SupabaseClient): Promise<InstagramDmStatus> {
  return await invokeEF<InstagramDmStatus>(client, CLAIM_EF, { action: "dm_status" });
}

/** The DM landed: the code is spent and this handle is proved. */
export function dmVerified(status: InstagramDmStatus, handle: string): boolean {
  return status.status === "none" && status.handle === handle && status.provedAt != null;
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
