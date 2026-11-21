"use server";

// Server actions for Admin › Configurations › Stories (MESITA-4425). Thin
// wrappers over the `stories` section of admin-web-get-config /
// admin-web-update-config: the read hands back only the Story keys of
// app_config.money_config plus the payments mode; the write goes through the
// money_config_merge_story RPC, which never touches the other money keys.

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import { botPatch, coerceStories, floorPatch, type StoriesConfig } from "./catalog";

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

/** The follower floor only. The emulator keys belong to Extra › Story. */
export async function updateStoriesConfig(c: StoriesConfig): Promise<StoriesResult> {
  const r = await efInvoke<StoriesAnswer>("admin-web-update-config", {
    section: "stories",
    // The floor and the AI bot's keys (MESITA-4549); never the emulator's.
    config: { ...floorPatch(c), ...botPatch(c) },
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, ...fromAnswer(r.data) };
}
