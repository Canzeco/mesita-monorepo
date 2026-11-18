// The Story record (MESITA-4405). Pato, 2026-11-18: "a different entity for
// vouchers and stories … 1. Pay $X. 2. Get principal immediately. 3. Solve
// the Story artifact (substeps). 4. Receive bonus."
//
// The Story voucher is plain money: what the guest paid is Available at the
// credit, which also creates one `stories` row (wallet_credit_purchase →
// story_create). The Story then runs its own steps:
//
//   waiting_post  post a story tagging @mesita and the place (deadline_at)
//   found         story_bind tied the guest's story; the screen shows the
//                 waiter QR (visit.mesita.ai/story/<token>)
//   approved      a waiter of the place approved it; the bonus lands at
//                 recheck_at if the story is still up ("Checking · bonus at")
//   released      the bonus landed
//   void          no bonus: expired · deleted · unreachable · refunded · operator
//
// Every reader goes through this file; the purchase's old story_* columns
// are a frozen copy nobody reads.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { STORY_RULES } from "./story-mention.ts";
import { storyReviewUrl } from "./story-review.ts";
import { storyLog } from "./story-log.ts";

export const STORY_STATES = ["waiting_post", "found", "approved", "released", "void"] as const;
export type StoryState = typeof STORY_STATES[number];

/** The one list of void reasons; the SQL CHECK on stories.void_reason
 *  carries the same five (story.test.ts pins them against the migration). */
export const STORY_VOID_REASONS = ["expired", "deleted", "unreachable", "refunded", "operator"] as const;
export type StoryVoidReason = typeof STORY_VOID_REASONS[number];

/** Before a decision: the guest can still act, or the bonus is still ahead. */
export const OPEN_STORY_STATES: readonly StoryState[] = ["waiting_post", "found", "approved"];

export type StoryRecord = {
  id: string;
  purchase_id: string;
  consumer_id: string | null;
  place_id: string;
  livemode: boolean;
  state: StoryState;
  deadline_at: string;
  mention_id: string | null;
  first_bound_at: string | null;
  approved_at: string | null;
  recheck_at: string | null;
  recheck_tries: number;
  decided_at: string | null;
  void_reason: StoryVoidReason | null;
  bonus_cents: number;
  created_at: string;
};

export const STORY_RECORD_COLUMNS =
  "id, purchase_id, consumer_id, place_id, livemode, state, deadline_at, mention_id, first_bound_at, approved_at, recheck_at, recheck_tries, decided_at, void_reason, bonus_cents, created_at";

export function isOpenStory(s: Pick<StoryRecord, "state">): boolean {
  return OPEN_STORY_STATES.includes(s.state);
}

/** An expired Story with no story ever bound does not use its visit's slot
 *  (Eng: a guest who paid away from the table is not penalised twice). Any
 *  other Story, a refunded one too, does. */
export function storyFreesSlot(s: Pick<StoryRecord, "state" | "void_reason" | "first_bound_at">): boolean {
  return s.state === "void" && s.void_reason === "expired" && !s.first_bound_at;
}

/** Whether the guest's screen should still look for the story or the
 *  waiter's answer: waiting_post or found, before the deadline. */
export function storyNeedsPoll(s: Pick<StoryRecord, "state" | "deadline_at">, nowMs: number): boolean {
  return (s.state === "waiting_post" || s.state === "found") && Date.parse(s.deadline_at) > nowMs;
}

/** The screen's poll: every 5 s, every 15 s after 2 minutes, stopping at
 *  approved, void or the deadline. */
export const STORY_POLL = {
  every_ms: STORY_RULES.pollEveryMs,
  slow_after_ms: STORY_RULES.pollForMs,
  slow_every_ms: STORY_RULES.slowPollEveryMs,
} as const;

export type StoryMention = {
  id: string;
  media_url: string | null;
  media_kind: "image" | "video";
  mentioned_at: string;
  source: "meta" | "emulator";
  review_token: string | null;
  deleted_at: string | null;
};

const STORY_MENTION_COLUMNS = "id, media_url, media_kind, mentioned_at, source, review_token, deleted_at";

export type StoryPurchase = { amount_cents: number; currency: string; paid_at: string | null; status: string };

/** One Story as the guest's screen and the Tickets list read it. The QR
 *  link is there only while found (the waiter's step). */
export function storyView(
  s: StoryRecord,
  x: {
    purchase: StoryPurchase | null;
    mention: StoryMention | null;
    placeHandle?: string | null;
    timeZone?: string | null;
    emulator: boolean;
    nowMs: number;
  },
) {
  const amount = x.purchase?.amount_cents ?? 0;
  return {
    story_id: s.id,
    purchase_id: s.purchase_id,
    place_id: s.place_id,
    state: s.state,
    deadline_at: s.deadline_at,
    created_at: s.created_at,
    paid_at: x.purchase?.paid_at ?? null,
    amount_cents: amount,
    bonus_cents: s.bonus_cents,
    credit_cents: amount + s.bonus_cents,
    currency: x.purchase?.currency ?? null,
    refunded: !!x.purchase && x.purchase.status !== "paid",
    approved_at: s.approved_at,
    /** "Checking · bonus at HH:MM": the re-check time while approved. */
    bonus_at: s.state === "approved" ? s.recheck_at : null,
    decided_at: s.decided_at,
    void_reason: s.void_reason,
    first_bound_at: s.first_bound_at,
    mention: x.mention
      ? {
        id: x.mention.id,
        media_url: x.mention.media_url,
        media_kind: x.mention.media_kind,
        mentioned_at: x.mention.mentioned_at,
        source: x.mention.source,
        deleted: !!x.mention.deleted_at,
      }
      : null,
    review_url: s.state === "found" && x.mention?.review_token ? storyReviewUrl(x.mention.review_token) : null,
    place_handle: x.placeHandle ?? null,
    time_zone: x.timeZone ?? null,
    test_mode: !s.livemode,
    /** Test mode: Tag the place, Simulate the waiter, Simulate deleting it. */
    emulator: x.emulator && !s.livemode && isOpenStory(s),
    poll: storyNeedsPoll(s, x.nowMs) ? STORY_POLL : null,
    server_time: new Date(x.nowMs).toISOString(),
  };
}

export type StoryView = ReturnType<typeof storyView>;

/** One Story of THIS guest, by its id or its purchase's id; null when it is
 *  not theirs (get-story answers 404, never someone else's Story). */
export async function readOwnStory(
  admin: SupabaseClient,
  consumerId: string,
  by: { storyId?: string | null; purchaseId?: string | null },
): Promise<StoryRecord | null> {
  let q = admin.from("stories").select(STORY_RECORD_COLUMNS).eq("consumer_id", consumerId);
  if (by.storyId) q = q.eq("id", by.storyId);
  else if (by.purchaseId) q = q.eq("purchase_id", by.purchaseId);
  else return null;
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`stories: ${error.message}`);
  return (data as StoryRecord | null) ?? null;
}

/** The Tickets Stories tab: every open Story plus the 20 most recently
 *  decided, newest first. */
export async function readStoryList(admin: SupabaseClient, consumerId: string, livemode: boolean): Promise<StoryRecord[]> {
  const base = () => admin.from("stories").select(STORY_RECORD_COLUMNS).eq("consumer_id", consumerId).eq("livemode", livemode);
  const [open, decided] = await Promise.all([
    base().in("state", [...OPEN_STORY_STATES]).order("created_at", { ascending: false }).limit(50),
    base().in("state", ["released", "void"]).order("decided_at", { ascending: false }).limit(20),
  ]);
  const error = open.error ?? decided.error;
  if (error) throw new Error(`stories: ${error.message}`);
  return [...((open.data ?? []) as StoryRecord[]), ...((decided.data ?? []) as StoryRecord[])]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

/** The mentions these Stories hold, by mention id. */
export async function readStoryMentions(admin: SupabaseClient, mentionIds: Array<string | null>): Promise<Map<string, StoryMention>> {
  const ids = [...new Set(mentionIds.filter((x): x is string => !!x))];
  const out = new Map<string, StoryMention>();
  if (ids.length === 0) return out;
  const { data, error } = await admin.from("story_mentions").select(STORY_MENTION_COLUMNS).in("id", ids);
  if (error) throw new Error(`story_mentions: ${error.message}`);
  for (const m of (data ?? []) as StoryMention[]) out.set(m.id, m);
  return out;
}

/** The purchases behind these Stories, by purchase id. */
export async function readStoryPurchases(admin: SupabaseClient, purchaseIds: string[]): Promise<Map<string, StoryPurchase>> {
  const out = new Map<string, StoryPurchase>();
  if (purchaseIds.length === 0) return out;
  const { data, error } = await admin.from("wallet_purchases").select("id, amount_cents, currency, paid_at, status")
    .in("id", [...new Set(purchaseIds)]);
  if (error) throw new Error(`wallet_purchases: ${error.message}`);
  for (const p of (data ?? []) as Array<StoryPurchase & { id: string }>) out.set(p.id, p);
  return out;
}

/** story_bind from the guest's screen: answers the RPC's outcome; never
 *  throws on "nothing yet". */
export async function bindStory(admin: SupabaseClient, storyId: string): Promise<{ outcome: string; mention_id?: string }> {
  const { data, error } = await admin.rpc("story_bind", { p_story: storyId });
  if (error) throw new Error(`story_bind: ${error.message}`);
  const r = (data ?? {}) as { ok?: boolean; outcome?: string; code?: string; mention_id?: string };
  return { outcome: r.outcome ?? r.code ?? "unknown", mention_id: r.mention_id };
}

/** The webhook's and the emulator's bind (story_bind_handle): ties a new
 *  mention to its guest's Story when exactly one waits for a post. Answers
 *  the Story id it bound, or null; a failure is logged, never thrown (the
 *  mention is stored and the guest's screen binds it later). */
export async function bindMentionToOpenStory(admin: SupabaseClient, mentionId: string, via: string): Promise<string | null> {
  const { data, error } = await admin.rpc("story_bind_handle", { p_mention: mentionId });
  if (error) {
    console.error("[story] bind_handle_failed", JSON.stringify({ mention_id: mentionId, error: error.message }));
    return null;
  }
  const r = (data ?? {}) as { outcome?: string; story_id?: string };
  if (r.outcome !== "found" || !r.story_id) return null;
  storyLog("found", { story_id: r.story_id, via });
  return r.story_id;
}

/** The Wallet's old `waiting_stories` row (until the apps move to
 *  `stories`): one undecided or recently decided Story in that shape. */
export function legacyWaitingState(s: Pick<StoryRecord, "state" | "recheck_at">, nowMs: number): "waiting" | "checking" | "released" | "void" {
  if (s.state === "released") return "released";
  if (s.state === "void") return "void";
  if (s.state === "approved" && s.recheck_at && Date.parse(s.recheck_at) <= nowMs) return "checking";
  return "waiting";
}
