// The guest's own Instagram stories (MESITA-4738): the read behind Me ›
// Tickets › Stories and the Loyalty Card page's Stories tab.
//
//   story_mentions (this guest, this money mode, newest first, 51)
//     └─ wallet_entries kind 'story' for those mentions (the credit paid)
//     └─ profiles (name, slug, round photo) for the places
//
// Only rows whose consumer_id is the caller: a story nobody matched yet is
// not anyone's ticket. Each row is mapped field by field, so the AI verdict,
// the sender's Instagram ids and the media link never leave.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readWalletPlaces } from "./wallet.ts";

export const STORIES_LIMIT = 50;

const LIST_STORY_COLUMNS = "id, place_id, state, reward_cents, mentioned_at, decided_at, source";

export type GuestStory = {
  id: string;
  /** Null while the check has not tied the story to a place yet. */
  place: { id: string; name: string | null; slug: string | null; photo_url: string | null } | null;
  /** checking · verified (waiting for the recheck) · rewarded · rejected. */
  state: string;
  /** What the story paid: the credit written, only when rewarded. */
  credit_cents: number | null;
  currency: string | null;
  posted_at: string;
  decided_at: string | null;
  simulated: boolean;
};

type MentionRow = {
  id: string;
  place_id: string | null;
  state: string;
  reward_cents: number | null;
  mentioned_at: string;
  decided_at: string | null;
  source: string;
};

export async function listStories(
  admin: SupabaseClient,
  consumerId: string,
  livemode: boolean,
): Promise<{ ok: true; stories: GuestStory[]; truncated: boolean } | { ok: false; error: string }> {
  const mentions = await admin
    .from("story_mentions")
    .select(LIST_STORY_COLUMNS)
    .eq("consumer_id", consumerId)
    .eq("livemode", livemode)
    .order("mentioned_at", { ascending: false })
    .limit(STORIES_LIMIT + 1);
  if (mentions.error) return { ok: false, error: `story_mentions: ${mentions.error.message}` };
  const all = (mentions.data ?? []) as MentionRow[];
  const truncated = all.length > STORIES_LIMIT;
  const rows = all.slice(0, STORIES_LIMIT);
  if (rows.length === 0) return { ok: true, stories: [], truncated: false };

  const [entries, places] = await Promise.all([
    admin
      .from("wallet_entries")
      .select("story_mention_id, amount_cents, currency")
      .eq("consumer_id", consumerId)
      .eq("kind", "story")
      .in("story_mention_id", rows.map((r) => r.id)),
    readWalletPlaces(admin, [...new Set(rows.flatMap((r) => (r.place_id ? [r.place_id] : [])))]),
  ]);
  if (entries.error) return { ok: false, error: `wallet_entries: ${entries.error.message}` };
  if (!places.ok) return { ok: false, error: places.error };
  const credit = new Map(
    ((entries.data ?? []) as Array<{ story_mention_id: string; amount_cents: number; currency: string }>)
      .map((e) => [e.story_mention_id, e] as const),
  );

  return {
    ok: true,
    truncated,
    stories: rows.map((r) => {
      const place = r.place_id ? places.places.get(r.place_id) : undefined;
      const paid = r.state === "rewarded" ? credit.get(r.id) : undefined;
      return {
        id: r.id,
        place: r.place_id
          ? { id: r.place_id, name: place?.name ?? null, slug: place?.slug ?? null, photo_url: place?.photo ?? null }
          : null,
        state: r.state,
        credit_cents: r.state === "rewarded" ? (paid?.amount_cents ?? r.reward_cents ?? null) : null,
        currency: paid?.currency ? paid.currency.toLowerCase() : null,
        posted_at: r.mentioned_at,
        decided_at: r.decided_at,
        simulated: r.source === "emulator",
      };
    }),
  };
}
