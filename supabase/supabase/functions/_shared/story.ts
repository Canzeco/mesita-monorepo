// The Story voucher (MESITA-3507, verified from the @mesita mention since
// MESITA-4264). What the guest paid is Available at payment; only the bonus
// waits. The guest's Wallet shows a QR to visit.mesita.ai/story/<token>;
// staff read it (visit-web-get-story: the guest's handle and every unclaimed
// story of that handle in the last 24 hours) and, signed in with the waiter
// code, approve one story or reject (visit-web-review-story →
// wallet_review_story). 3 hours later supabase-cron-recheck-stories fetches
// the story again and releases the bonus if it still loads.
//
// Reading needs no sign-in: the 122-bit token is the key, as the payment
// proof's is (MESITA-3304). Approving needs a current waiter-code staff
// token of the purchase's place: the guest holds the QR.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readInstagramSyncState } from "./consumer-doc.ts";
import { placeZone, PLACE_ZONE_COLUMNS } from "./local-time.ts";
import {
  type MentionRow,
  type MentionView,
  MENTION_COLUMNS,
  mentionView,
  readCandidateMentions,
  readStoryRules,
  storyExpiresAt,
  type StoryRulesLive,
} from "./story-mention.ts";

/** 32 lowercase hex: `gen_random_uuid()` without its dashes. */
export function isStoryToken(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{32}$/.test(v);
}

export type StoryRow = {
  id: string;
  status: string;
  amount_cents: number;
  bonus_cents: number;
  currency: string;
  livemode: boolean;
  paid_at: string | null;
  /** When staff approved the Story (MESITA-4264; "activated" before). */
  story_activated_at: string | null;
  story_review?: "approved" | "rejected" | null;
  story_reviewed_at?: string | null;
  story_recheck_at?: string | null;
  story_bonus?: "released" | "void" | null;
  story_bonus_void_reason?: "unreachable" | "expired" | "refunded" | "operator" | null;
  story_bonus_decided_at?: string | null;
  place_id: string;
  consumer_id: string | null;
};

export const STORY_COLUMNS =
  "id, status, amount_cents, bonus_cents, currency, livemode, paid_at, story_activated_at, story_review, story_reviewed_at, story_recheck_at, story_bonus, story_bonus_void_reason, story_bonus_decided_at, place_id, consumer_id";

/** Where a Story stands, for the Wallet and the staff page. */
export type StoryState = "needs_story" | "received" | "rejected" | "approved" | "released" | "void";

/** One mapping of the columns (story.test.ts pins it). `newestMentionAt` is
 *  the newest unclaimed story of the guest's handle that fits this purchase,
 *  or null: a story arriving after a reject reads received again. */
export function storyState(
  row: Pick<StoryRow, "story_review" | "story_reviewed_at" | "story_bonus">,
  newestMentionAt: string | null,
): StoryState {
  if (row.story_bonus === "released") return "released";
  if (row.story_bonus === "void") return "void";
  if (row.story_review === "approved") return "approved";
  if (row.story_review === "rejected") {
    const after = newestMentionAt && row.story_reviewed_at && Date.parse(newestMentionAt) > Date.parse(row.story_reviewed_at);
    return after ? "received" : "rejected";
  }
  return newestMentionAt ? "received" : "needs_story";
}

/** When the bonus lands if the story is still up: approval + the wait. */
export function storyBonusAt(row: Pick<StoryRow, "story_activated_at">, rules: Pick<StoryRulesLive, "bonusWaitSec">): string | null {
  if (!row.story_activated_at) return null;
  return new Date(Date.parse(row.story_activated_at) + rules.bonusWaitSec * 1000).toISOString();
}

import { instagramHandleOfUrl } from "./place-instagram.ts";
export { instagramHandleOfUrl };

export type StoryPlace = { id: string; name: string | null; instagram_handle: string | null; time_zone: string };

export type StoryView = {
  purchase_id: string;
  place: StoryPlace;
  /** The buyer's verified Instagram handle: staff match the story to it. */
  instagram_handle: string | null;
  amount_cents: number;
  bonus_cents: number;
  credit_cents: number;
  currency: string;
  paid_at: string | null;
  /** When staff approved; `activated_at` is the same time, kept for old pages. */
  approved_at: string | null;
  activated_at: string | null;
  /** Any status but paid (refunded, partly refunded, needs review): the
   *  credit exists since payment, so this is no longer "before activation". */
  refunded: boolean;
  status: string;
  state: StoryState;
  review: "approved" | "rejected" | null;
  reviewed_at: string | null;
  recheck_at: string | null;
  bonus_at: string | null;
  bonus: "released" | "void" | null;
  bonus_void_reason: "unreachable" | "expired" | "refunded" | "operator" | null;
  bonus_decided_at: string | null;
  /** Approve by this time or the bonus is void. */
  expires_at: string | null;
  /** Unclaimed stories of the buyer's handle in the last 24 hours, newest first. */
  mentions: MentionView[];
  /** The story staff approved on this purchase. */
  claimed_mention: MentionView | null;
  test_mode: boolean;
};

export function storyView(
  row: StoryRow,
  place: StoryPlace,
  handle: string | null,
  extra: { mentions: MentionRow[]; claimed: MentionRow | null; rules: StoryRulesLive },
): StoryView {
  const mentions = extra.mentions;
  return {
    purchase_id: row.id,
    place,
    instagram_handle: handle,
    amount_cents: row.amount_cents,
    bonus_cents: row.bonus_cents,
    credit_cents: row.amount_cents + row.bonus_cents,
    currency: row.currency,
    paid_at: row.paid_at,
    approved_at: row.story_activated_at,
    activated_at: row.story_activated_at,
    refunded: row.status !== "paid",
    status: row.status,
    state: storyState(
      { story_review: row.story_review ?? null, story_reviewed_at: row.story_reviewed_at ?? null, story_bonus: row.story_bonus ?? null },
      mentions[0]?.mentioned_at ?? null,
    ),
    review: row.story_review ?? null,
    reviewed_at: row.story_reviewed_at ?? null,
    recheck_at: row.story_recheck_at ?? null,
    bonus_at: storyBonusAt(row, extra.rules),
    bonus: row.story_bonus ?? null,
    bonus_void_reason: row.story_bonus_void_reason ?? null,
    bonus_decided_at: row.story_bonus_decided_at ?? null,
    expires_at: storyExpiresAt(row.paid_at, extra.rules),
    mentions: mentions.map(mentionView),
    claimed_mention: extra.claimed ? mentionView(extra.claimed) : null,
    test_mode: !row.livemode,
  };
}

/** The Story behind a token with everything its staff page shows; row null
 *  when no paid (or since refunded) Story carries it. */
export async function readStory(
  admin: SupabaseClient,
  token: string,
  nowMs: number = Date.now(),
): Promise<
  | { ok: true; row: null }
  | { ok: true; row: StoryRow; view: StoryView }
  | { ok: false; error: string }
> {
  const { data, error } = await admin.from("wallet_purchases")
    .select(STORY_COLUMNS)
    .eq("story_token", token).eq("voucher", "voucher_story")
    .in("status", ["paid", "refunded", "partly_refunded", "needs_review"])
    .maybeSingle();
  if (error) return { ok: false, error: `wallet_purchases: ${error.message}` };
  const row = data as StoryRow | null;
  if (!row) return { ok: true, row: null };
  const [placeRes, guest, claimedRes, rules] = await Promise.all([
    admin.from("place_profiles").select(`id, name, instagram_url, ${PLACE_ZONE_COLUMNS}`).eq("id", row.place_id).maybeSingle(),
    row.consumer_id ? readInstagramSyncState(admin, row.consumer_id) : Promise.resolve(null),
    admin.from("story_mentions").select(MENTION_COLUMNS).eq("purchase_id", row.id).maybeSingle(),
    readStoryRules(admin),
  ]);
  if (placeRes.error) return { ok: false, error: `place_read: ${placeRes.error.message}` };
  if (guest && !guest.ok) return { ok: false, error: `consumers: ${guest.error}` };
  if (claimedRes.error) return { ok: false, error: `story_mentions: ${claimedRes.error.message}` };
  const handle = guest && guest.ok ? guest.handle?.toLowerCase() ?? null : null;
  // Candidates only while a story can still be approved on it.
  const open = row.status === "paid" && !row.story_bonus && row.story_review !== "approved";
  let mentions: MentionRow[] = [];
  if (open) {
    try {
      mentions = await readCandidateMentions(admin, handle, row.livemode, nowMs);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const p = placeRes.data as { id: string; name: string | null; instagram_url: string | null; timezone?: unknown; lng?: unknown } | null;
  const place: StoryPlace = {
    id: row.place_id,
    name: p?.name ?? null,
    instagram_handle: instagramHandleOfUrl(p?.instagram_url),
    time_zone: placeZone(p),
  };
  return {
    ok: true,
    row,
    view: storyView(row, place, handle, { mentions, claimed: (claimedRes.data as MentionRow | null) ?? null, rules }),
  };
}
