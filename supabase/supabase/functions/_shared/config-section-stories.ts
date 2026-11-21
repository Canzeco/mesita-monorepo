// _shared/config-section-stories.ts — the `stories` section (MESITA-4425).
//
// Admin › Configurations › Stories. The Story rules live in
// app_config.money_config BESIDE keys this page must never touch
// (buying_paused, sending_live, express_wallets), so this section owns both
// its read and its write:
//
//   READ   only the Story keys, plus two facts that are not columns: whether
//          payments are live (PAYMENTS_STRIPE_MODE) and where Story mentions
//          come from (storyMode). The page shows the payments mode beside the
//          follower floor.
//   WRITE  never `.update` on money_config: one call to the atomic RPC
//          money_config_merge_story, which keeps only the Story keys, checks
//          their types, clamps and merges under a row lock, then answers the
//          values before and after. The save is logged here, at the EF, with
//          both and the admin's id, whatever the browser did.
//
// Editable: story_min_followers, and emulator mode (MESITA-4426):
// story_emulator plus its test waits. The real bonus wait and post window are
// shown read-only: they are real-money rules that go by migration.
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { jsonError, jsonOk } from "./http.ts";
import { readAppConfig } from "./write-config.ts";
import { appConfigMissing, type ConfigSection, type SectionWriteContext } from "./config-section-base.ts";
import { paymentsLivemode } from "./stripe.ts";
import { STORY_EMULATOR, STORY_MIN_FOLLOWERS_MAX, storyMode, storyRulesFrom } from "./story-mention.ts";

/** The keys the console may send (money_config_merge_story allows these),
 *  with the whole-number range each must be in; null = a boolean. */
const STORY_CONFIG_RANGES: Record<string, { min: number; max: number } | null> = {
  story_min_followers: { min: 0, max: STORY_MIN_FOLLOWERS_MAX },
  story_emulator: null,
  story_emulator_bonus_wait_sec: STORY_EMULATOR.bonusWait,
  story_emulator_post_window_sec: STORY_EMULATOR.postWindow,
  // MESITA-4549: the AI bot's switches and limits (MESITA-4535).
  story_ai_enabled: null,
  story_recheck_meta: null,
  story_ai_batch: { min: 1, max: 50 },
  story_ai_max_tries: { min: 1, max: 10 },
  story_desk_hours: { min: 1, max: 168 },
  story_media_retention_hours: { min: 24, max: 720 },
  story_stale_days: { min: 1, max: 90 },
};
export const STORY_CONFIG_KEYS = Object.keys(STORY_CONFIG_RANGES);

/** The Story keys out of money_config, as the page renders them. */
export function storiesConfigFrom(raw: unknown) {
  const r = storyRulesFrom(raw);
  return {
    story_min_followers: r.minFollowers,
    story_bonus_wait_sec: r.bonusWaitSec,
    story_post_window_sec: r.postWindowSec,
    story_emulator: r.emulator,
    story_emulator_bonus_wait_sec: r.emulatorBonusWaitSec,
    story_emulator_post_window_sec: r.emulatorPostWindowSec,
    story_ai_enabled: r.aiEnabled,
    story_recheck_meta: r.recheckMeta,
    story_ai_batch: r.aiBatch,
    story_ai_max_tries: r.aiMaxTries,
    story_desk_hours: r.deskHours,
    story_media_retention_hours: r.mediaRetentionHours,
    story_stale_days: r.staleDays,
  };
}

export async function readStoriesSection(admin: SupabaseClient, section: ConfigSection): Promise<Response> {
  const res = await readAppConfig(admin, `${section.column}, updated_at`, section.readError ?? `${section.column}_read`);
  if (!res.ok) return res.response;
  if (!res.row) return appConfigMissing();
  return jsonOk({
    config: storiesConfigFrom(res.row[section.column]),
    payments_live: paymentsLivemode(),
    story_mode: storyMode(),
    updatedAt: res.row.updated_at,
  });
}

/** The console's patch, refused rather than coerced: an unknown key or a
 *  value that is not a whole number in range is a 400 naming it. */
export function storiesPatchFrom(raw: unknown): { ok: true; patch: Record<string, number | boolean> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "config must be an object" };
  const patch: Record<string, number | boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Object.hasOwn(STORY_CONFIG_RANGES, k)) return { ok: false, error: `unknown key ${k}` };
    const range = STORY_CONFIG_RANGES[k];
    if (range === null) {
      if (typeof v !== "boolean") return { ok: false, error: `${k} must be true or false` };
    } else if (typeof v !== "number" || !Number.isInteger(v) || v < range.min || v > range.max) {
      return { ok: false, error: `${k} must be a whole number from ${range.min.toLocaleString("en-US")} to ${range.max.toLocaleString("en-US")}` };
    }
    patch[k] = v as number | boolean;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "nothing to save" };
  return { ok: true, patch };
}

export async function writeStoriesSection(ctx: SectionWriteContext, section: ConfigSection): Promise<Response> {
  const parsed = storiesPatchFrom(ctx.body.config);
  if (!parsed.ok) {
    console.warn("[config-stories] save_refused", JSON.stringify({ admin: ctx.userId, error: parsed.error }));
    return jsonError(parsed.error, 400);
  }
  const { data, error } = await ctx.admin.rpc("money_config_merge_story", { p_patch: parsed.patch, p_updated_by: ctx.userId });
  if (error) {
    console.error("[config-stories] save_failed", JSON.stringify({ admin: ctx.userId, patch: parsed.patch, error: error.message }));
    return jsonError(`${section.column}_update: ${error.message}`, 400);
  }
  const answer = (data ?? {}) as { before?: unknown; after?: unknown; updated_at?: string };
  console.log("[config-stories] saved", JSON.stringify({ admin: ctx.userId, before: answer.before ?? null, after: answer.after ?? null }));
  return jsonOk({
    config: storiesConfigFrom(answer.after),
    payments_live: paymentsLivemode(),
    story_mode: storyMode(),
    updatedAt: answer.updated_at ?? null,
  });
}
