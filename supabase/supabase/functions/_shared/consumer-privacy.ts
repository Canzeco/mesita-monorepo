/**
 * Guest-to-guest privacy on Mesita (MESITA-913).
 *
 * Private account (`privacy_public = false`) anonymizes the display name /
 * Instagram handle that OTHER guests see in the social feed and on Mesita
 * reviews. Business/staff surfaces (reservations, check, tickets) keep real
 * names — those are operational, not social.
 *
 * `privacy_show_stories` is independent: a guest can keep Mesita story
 * activity hidden even while posting publicly on Instagram.
 */

import { consumerDisplayName } from "./consumer-lookup.ts";

export const ANONYMOUS_GUEST_NAME = "Anonymous guest";

export type PublicGuestIdentity = {
  name: string;
  handle: string;
  anonymous: boolean;
};

type PrivacyRow = {
  privacy_public?: boolean | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  instagram_handle?: string | null;
};

/** True when other guests must not see this consumer's real identity. */
export function isPrivateAccount(
  profilePublic: boolean | null | undefined,
): boolean {
  return profilePublic === false;
}

/**
 * Display name + @handle for consumer-facing social surfaces.
 * Private accounts always resolve to {@link ANONYMOUS_GUEST_NAME} with an
 * empty handle — never leak first name or Instagram.
 */
export function publicGuestIdentity(row: PrivacyRow): PublicGuestIdentity {
  if (isPrivateAccount(row.privacy_public)) {
    return { name: ANONYMOUS_GUEST_NAME, handle: "", anonymous: true };
  }
  const name = consumerDisplayName(row) ?? ANONYMOUS_GUEST_NAME;
  const raw = String(row.instagram_handle ?? "").trim().replace(/^@+/, "");
  const handle = raw ? `@${raw}` : "";
  return { name, handle, anonymous: false };
}

/** Whether story activity may appear on Mesita social surfaces. Default on. */
export function storiesVisibleOnMesita(
  profileShowStories: boolean | null | undefined,
): boolean {
  return profileShowStories !== false;
}

/** Whether visit activity may appear on Mesita social surfaces. Default on. */
export function visitsVisibleOnMesita(
  profileShowVisits: boolean | null | undefined,
): boolean {
  return profileShowVisits !== false;
}
