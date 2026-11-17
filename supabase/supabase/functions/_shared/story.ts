// The Story voucher on the guest's Wallet (MESITA-4296). The guest showed
// their story before paying (consumer-web-check-story); the credit claimed
// it (story_claim) and set the re-check to payment + 3 hours; the cron
// releases the bonus if the story is still up then. Staff are out of the
// flow: there is no token, no review and no approve window any more.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { MENTION_COLUMNS, type MentionRow, type MentionView, mentionView, type StoryRulesLive } from "./story-mention.ts";

export type StoryVoidReason = "unreachable" | "expired" | "refunded" | "operator" | "mention_lost" | "no_mention";

export type StoryRow = {
  id: string;
  status: string;
  amount_cents: number;
  bonus_cents: number;
  currency: string;
  livemode: boolean;
  paid_at: string | null;
  /** When the story was claimed, which is the payment (MESITA-4296). */
  story_activated_at: string | null;
  story_recheck_at?: string | null;
  story_bonus?: "released" | "void" | null;
  story_bonus_void_reason?: StoryVoidReason | null;
  story_bonus_decided_at?: string | null;
  place_id: string;
  consumer_id: string | null;
};

export const STORY_COLUMNS =
  "id, status, amount_cents, bonus_cents, currency, livemode, paid_at, story_activated_at, story_recheck_at, story_bonus, story_bonus_void_reason, story_bonus_decided_at, place_id, consumer_id";

/** Where a paid Story stands on the Wallet:
 *   waiting   claimed, the re-check is still ahead ("keep it up until <time>")
 *   checking  the re-check time has come, the cron has not decided yet
 *   released  the bonus landed
 *   void      no bonus (story_bonus_void_reason says why) */
export type StoryState = "waiting" | "checking" | "released" | "void";

/** One mapping of the columns (story.test.ts pins it). */
export function storyState(
  row: Pick<StoryRow, "story_bonus" | "story_recheck_at">,
  nowMs: number,
): StoryState {
  if (row.story_bonus === "released") return "released";
  if (row.story_bonus === "void") return "void";
  if (row.story_recheck_at && Date.parse(row.story_recheck_at) <= nowMs) return "checking";
  return "waiting";
}

/** When the bonus lands if the story is still up: the claim + the wait. */
export function storyBonusAt(row: Pick<StoryRow, "story_activated_at">, rules: Pick<StoryRulesLive, "bonusWaitSec">): string | null {
  if (!row.story_activated_at) return null;
  return new Date(Date.parse(row.story_activated_at) + rules.bonusWaitSec * 1000).toISOString();
}

/** The claimed mentions of these purchases, by purchase id. */
export async function readClaimedMentions(admin: SupabaseClient, purchaseIds: string[]): Promise<Map<string, MentionView>> {
  const out = new Map<string, MentionView>();
  if (purchaseIds.length === 0) return out;
  const { data, error } = await admin.from("story_mentions").select(MENTION_COLUMNS).in("purchase_id", purchaseIds);
  if (error) throw new Error(`story_mentions: ${error.message}`);
  for (const m of (data ?? []) as MentionRow[]) if (m.purchase_id) out.set(m.purchase_id, mentionView(m));
  return out;
}
