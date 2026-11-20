"use server";

// Server actions for Admin › Configurations › Stories (MESITA-4425). Thin
// wrappers over the `stories` section of admin-web-get-config /
// admin-web-update-config: the read hands back only the Story keys of
// app_config.money_config plus the payments mode; the write goes through the
// money_config_merge_story RPC, which never touches the other money keys.

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import { coerceStories, type StoriesConfig } from "./catalog";

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

export async function getStoriesConfig(): Promise<StoriesResult> {
  const r = await efInvoke<StoriesAnswer>("admin-web-get-config", { section: "stories" });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, ...fromAnswer(r.data) };
}

/** The editable keys only; the read-only waits are never sent. */
export async function updateStoriesConfig(c: StoriesConfig): Promise<StoriesResult> {
  const r = await efInvoke<StoriesAnswer>("admin-web-update-config", {
    section: "stories",
    config: {
      story_min_followers: c.story_min_followers,
      story_emulator: c.story_emulator,
      story_emulator_bonus_wait_sec: c.story_emulator_bonus_wait_sec,
      story_emulator_post_window_sec: c.story_emulator_post_window_sec,
    },
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
export type MentionRow = { id: string; mentioned_at: string | null; source: string | null; deleted_at: string | null };

export async function listStoryDesk(): Promise<ActionResult<{ stories: StoryDeskRow[]; mentions: MentionRow[] }>> {
  const r = await efInvoke<{ stories: StoryDeskRow[]; mentions: MentionRow[] }>("admin-web-list-story-desk", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, stories: r.data.stories ?? [], mentions: r.data.mentions ?? [] };
}

export async function overrideStory(
  purchaseId: string,
  action: "release" | "void" | "recheck_now",
): Promise<ActionResult<{ outcome: string }>> {
  const r = await efInvoke<{ outcome?: string }>("admin-web-story-override", { purchase_id: purchaseId, action });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, outcome: r.data.outcome ?? action };
}
