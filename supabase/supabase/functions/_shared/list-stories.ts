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
import { readVoucherPlace, readWalletPlaces } from "./wallet.ts";
import { STORY_REJECT_WORDS, type StoryRejectReason, type StoryState } from "./story-reward.ts";

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

// ── One story, its ticket (MESITA-4747) ─────────────────────────────────────
//
// Pato, 2026-11-23: "Story: 1. Post & Tag 2. Bot Checks 3. Wait 10 hours
// 4. Bot Rechecks 5. Get Reward … the structure of the ticket must already be
// built and functional." /me/tickets/stories/<id> draws those five steps from
// this read: when each step happened, when the next one runs, and, on a
// rejection, which step failed and why in plain words. Same scoping as the
// list: the caller's own story in the wallet's money mode, field by field.

const TICKET_COLUMNS =
  "id, place_id, state, reject_reason, reward_cents, mentioned_at, ai_checked_at, recheck_at, decided_at, source";

export type StoryTicket = {
  id: string;
  place: { id: string; name: string | null; slug: string | null; photo_url: string | null } | null;
  state: StoryState;
  /** Step 1, Post & Tag: when Instagram says it was posted. */
  posted_at: string;
  /** Step 2, Bot Checks: when the first check ran (storyCheckedAt). */
  checked_at: string | null;
  /** Steps 3–4: when the recheck runs (verified) or ran (rewarded, or a
   *  rejection at the recheck). 10 hours after the check; an emulator
   *  story 2 minutes. */
  recheck_at: string | null;
  /** Rewarded or rejected: when it was decided. */
  decided_at: string | null;
  /** What the story will pay (verified) or paid (rewarded); null otherwise. */
  reward_cents: number | null;
  /** The credit written, only when rewarded. */
  credit_cents: number | null;
  currency: string;
  /** Rejected: why, in plain words (STORY_REJECT_WORDS). */
  reason: string | null;
  /** Rejected: the step that said no, `check` (step 2) or `recheck` (step 4). */
  failed_at: "check" | "recheck" | null;
  simulated: boolean;
};

type TicketRow = {
  id: string;
  place_id: string | null;
  state: StoryState;
  reject_reason: StoryRejectReason | null;
  reward_cents: number | null;
  mentioned_at: string;
  ai_checked_at: string | null;
  recheck_at: string | null;
  decided_at: string | null;
  source: string;
};

/** When the first check ran. The AI bot stamps ai_checked_at on a real
 *  story; the emulator runs its first check the moment it records the story
 *  (consumer-web-simulate-story), so its posted time is its check; a story
 *  rejected before any AI verdict (expired, unreadable without a stamp)
 *  was checked when it was decided. Still checking: null. */
export function storyCheckedAt(r: Pick<TicketRow, "state" | "ai_checked_at" | "mentioned_at" | "recheck_at" | "decided_at" | "source">): string | null {
  if (r.ai_checked_at) return r.ai_checked_at;
  if (r.state === "checking") return null;
  if (r.source === "emulator") return r.mentioned_at;
  return r.recheck_at == null ? r.decided_at : null;
}

/** Which step rejected it: a story gone at the recheck (`removed`) or any
 *  rejection after recheck_at was set (story_reward_pay: off, no_guest)
 *  failed the recheck; every other rejection failed the first check. */
export function storyFailedAt(r: Pick<TicketRow, "state" | "reject_reason" | "recheck_at">): "check" | "recheck" | null {
  if (r.state !== "rejected") return null;
  return r.reject_reason === "removed" || r.recheck_at != null ? "recheck" : "check";
}

export async function getStory(
  admin: SupabaseClient,
  consumerId: string,
  livemode: boolean,
  storyId: string,
): Promise<{ ok: true; story: StoryTicket | null } | { ok: false; error: string }> {
  const res = await admin
    .from("story_mentions")
    .select(TICKET_COLUMNS)
    .eq("id", storyId)
    .eq("consumer_id", consumerId)
    .eq("livemode", livemode)
    .limit(1);
  if (res.error) return { ok: false, error: `story_mentions: ${res.error.message}` };
  const r = ((res.data ?? []) as TicketRow[])[0];
  if (!r) return { ok: true, story: null };

  const entry = r.state === "rewarded"
    ? await admin
      .from("wallet_entries")
      .select("amount_cents, currency")
      .eq("consumer_id", consumerId)
      .eq("kind", "story")
      .eq("story_mention_id", r.id)
      .limit(1)
    : { data: [], error: null };
  if (entry.error) return { ok: false, error: `wallet_entries: ${entry.error.message}` };
  const paid = ((entry.data ?? []) as Array<{ amount_cents: number; currency: string | null }>)[0];
  // The place through the wallet's own doors (read-surface.test.ts): its
  // name and photo, and, before a credit names one, its currency.
  const [places, money] = await Promise.all([
    readWalletPlaces(admin, r.place_id ? [r.place_id] : []),
    r.place_id && !paid?.currency ? readVoucherPlace(admin, r.place_id) : Promise.resolve(null),
  ]);
  if (!places.ok) return { ok: false, error: places.error };
  if (money && !money.ok) return { ok: false, error: money.error };
  const p = r.place_id ? places.places.get(r.place_id) : undefined;
  const currency = paid?.currency ?? (money?.ok ? money.place?.currency : null) ?? "mxn";

  const promised = r.state === "verified" || r.state === "rewarded";
  return {
    ok: true,
    story: {
      id: r.id,
      place: r.place_id
        ? { id: r.place_id, name: p?.name ?? null, slug: p?.slug ?? null, photo_url: p?.photo ?? null }
        : null,
      state: r.state,
      posted_at: r.mentioned_at,
      checked_at: storyCheckedAt(r),
      recheck_at: r.recheck_at,
      decided_at: r.decided_at,
      reward_cents: promised ? (paid?.amount_cents ?? r.reward_cents ?? null) : null,
      credit_cents: r.state === "rewarded" ? (paid?.amount_cents ?? r.reward_cents ?? null) : null,
      currency: currency.toLowerCase(),
      reason: r.state === "rejected" && r.reject_reason ? STORY_REJECT_WORDS[r.reject_reason] ?? null : null,
      failed_at: storyFailedAt(r),
      simulated: r.source === "emulator",
    },
  };
}
