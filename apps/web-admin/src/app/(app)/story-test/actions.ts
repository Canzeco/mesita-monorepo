"use server";

// Extra › Story (MESITA-4522). The emulator save and the settle desk. The
// follower floor stays on Configurations › Stories.

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import { coerceStories, emulatorPatch, type StoriesConfig } from "@/app/(app)/stories-config/catalog";

type StoriesAnswer = { config: unknown; updatedAt: string | null; payments_live?: boolean; story_mode?: string };

export type StoriesResult = ActionResult<{
  config: StoriesConfig;
  updatedAt: string | null;
  paymentsLive: boolean;
  storyMode: string | null;
}>;

function fromAnswer(d: StoriesAnswer) {
  return {
    config: coerceStories(d.config),
    updatedAt: d.updatedAt ?? null,
    paymentsLive: d.payments_live === true,
    storyMode: typeof d.story_mode === "string" ? d.story_mode : null,
  };
}

export async function updateEmulatorConfig(c: StoriesConfig): Promise<StoriesResult> {
  const r = await efInvoke<StoriesAnswer>("admin-web-update-config", {
    section: "stories",
    config: emulatorPatch(c),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, ...fromAnswer(r.data) };
}

export type StoryDeskRow = {
  id: string;
  purchase_id: string;
  state: string;
  recheck_at: string | null;
  void_reason: string | null;
};
export type MentionRow = {
  id: string;
  mentioned_at: string | null;
  source: string | null;
  deleted_at: string | null;
  /** MESITA-4549: what the AI bot decided. */
  ig_handle?: string | null;
  livemode?: boolean | null;
  ai_outcome?: string | null;
  ai_reason?: string | null;
  ai_model?: string | null;
  ai_checked_at?: string | null;
  ai_last_error?: string | null;
  ai_tries?: number | null;
  ai_reviewed_at?: string | null;
  thumb_url?: string | null;
  media?: "image" | "video" | "purged" | "none";
  candidates?: Array<{ place_id: string; name: string | null; handle: string | null }>;
};
export type DeskCounters = { verified: number; rejected: number; unreadable: number; ambiguous: number; held: number };

export async function listStoryDesk(): Promise<ActionResult<{ stories: StoryDeskRow[]; mentions: MentionRow[]; counters: DeskCounters }>> {
  const r = await efInvoke<{ stories: StoryDeskRow[]; mentions: MentionRow[]; counters?: DeskCounters }>("admin-web-list-story-desk", {});
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    stories: r.data.stories ?? [],
    mentions: r.data.mentions ?? [],
    counters: r.data.counters ?? { verified: 0, rejected: 0, unreadable: 0, ambiguous: 0, held: 0 },
  };
}

/** MESITA-4549: the bot's desk actions on one story (mention). */
export async function aiDeskAction(
  mentionId: string,
  action: "ai_attach" | "ai_reject" | "ai_recheck" | "ai_reviewed",
  placeId?: string,
): Promise<ActionResult<{ outcome: string }>> {
  const r = await efInvoke<{ outcome?: string }>("admin-web-story-override", {
    action,
    mention_id: mentionId,
    ...(placeId ? { place_id: placeId } : {}),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, outcome: r.data.outcome ?? action };
}

export async function overrideStory(
  purchaseId: string,
  action: "release" | "void" | "recheck_now",
): Promise<ActionResult<{ outcome: string }>> {
  const r = await efInvoke<{ outcome?: string }>("admin-web-story-override", { purchase_id: purchaseId, action });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, outcome: r.data.outcome ?? action };
}
