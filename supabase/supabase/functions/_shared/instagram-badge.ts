// THE VERIFIED BADGE (MESITA-4858): Mesita confirmed, by DM, that this guest
// owns this Instagram account (consumers.instagram_proved_at). It says nothing
// about followers. One boolean, `instagram_badge`, on consumer-web-get-profile
// and on every Social person; the server decides it, never the client.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type BadgeFacts = { instagram_handle: string | null; instagram_proved_at: string | null };

/** Whether this guest wears the badge, pure. */
export function instagramBadge(c: BadgeFacts | null | undefined): boolean {
  return Boolean(c?.instagram_handle && c.instagram_proved_at);
}

export const BADGE_COLUMNS = "id, instagram_handle, instagram_proved_at";

/** The ids among these guests who wear the badge (one batched read). A
 *  failed read is logged and gives no badges: no mark beats a wrong one. */
export async function badgedConsumers(admin: SupabaseClient, ids: readonly string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return out;
  const { data, error } = await admin.from("consumers").select(BADGE_COLUMNS).in("id", unique);
  if (error) {
    console.error("[instagram-badge] read_failed", JSON.stringify({ message: error.message }));
    return out;
  }
  for (const r of (data ?? []) as unknown as Array<BadgeFacts & { id: string }>) {
    if (instagramBadge(r)) out.add(r.id);
  }
  return out;
}

/** Marks each Social row whose member wears the badge (place-activity rows
 *  carry consumer_id; the person shaped from it never does). */
export async function withInstagramBadges<T extends { consumer_id: string; instagram_badge?: boolean }>(
  admin: SupabaseClient,
  rows: T[],
): Promise<T[]> {
  const badged = await badgedConsumers(admin, rows.map((r) => r.consumer_id));
  return rows.map((r) => ({ ...r, instagram_badge: badged.has(r.consumer_id) }));
}
