// THE YELLOW INSTAGRAM BADGE (MESITA-4714, Pato, 2026-11-23: "add like a tag
// if more than +1K, kinda like verified but yellow tag at the right of
// instagram, that tag means that you have more than +1000 followers and that
// your account is public"). A public mark, so the server decides it, never
// the client: a verified Instagram, more than 1,000 followers, and a public
// account (consumers.instagram_is_private = false; unknown is not public).
// The follower emulator (MESITA-4662) counts only while payments run in
// Stripe test mode, and there it stands in for a public account (the box
// "emulates public instagram with +x followers"). One boolean,
// `instagram_badge`, on consumer-web-get-profile and on every Social person.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const INSTAGRAM_BADGE_MIN_FOLLOWERS = 1000;

export type BadgeFacts = {
  instagram_verified_at: string | null;
  instagram_followers_count: number | null;
  instagram_followers_emulated?: number | null;
  instagram_is_private: boolean | null;
};

/** Whether this guest wears the badge, pure. */
export function instagramBadge(c: BadgeFacts | null | undefined, livemode: boolean): boolean {
  if (!c || !c.instagram_verified_at) return false;
  const emulated = !livemode && typeof c.instagram_followers_emulated === "number" ? c.instagram_followers_emulated : null;
  if (emulated != null) return emulated > INSTAGRAM_BADGE_MIN_FOLLOWERS;
  return c.instagram_is_private === false && (c.instagram_followers_count ?? 0) > INSTAGRAM_BADGE_MIN_FOLLOWERS;
}

export const BADGE_COLUMNS = "id, instagram_verified_at, instagram_followers_count, instagram_followers_emulated, instagram_is_private";

/** The ids among these guests who wear the badge (one batched read). A
 *  failed read is logged and gives no badges: no mark beats a wrong one. */
export async function badgedConsumers(admin: SupabaseClient, ids: readonly string[], livemode: boolean): Promise<Set<string>> {
  const out = new Set<string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return out;
  const { data, error } = await admin.from("consumers").select(BADGE_COLUMNS).in("id", unique);
  if (error) {
    console.error("[instagram-badge] read_failed", JSON.stringify({ message: error.message }));
    return out;
  }
  for (const r of (data ?? []) as unknown as Array<BadgeFacts & { id: string }>) {
    if (instagramBadge(r, livemode)) out.add(r.id);
  }
  return out;
}

/** Marks each Social row whose member wears the badge (place-activity rows
 *  carry consumer_id; the person shaped from it never does). */
export async function withInstagramBadges<T extends { consumer_id: string; instagram_badge?: boolean }>(
  admin: SupabaseClient,
  rows: T[],
  livemode: boolean,
): Promise<T[]> {
  const badged = await badgedConsumers(admin, rows.map((r) => r.consumer_id), livemode);
  return rows.map((r) => ({ ...r, instagram_badge: badged.has(r.consumer_id) }));
}
