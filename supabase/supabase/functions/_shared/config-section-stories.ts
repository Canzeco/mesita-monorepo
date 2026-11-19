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
// Editable now: story_min_followers. The real bonus wait and post window are
// shown read-only: they are real-money rules that go by migration.
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { jsonError, jsonOk } from "./http.ts";
import { readAppConfig } from "./write-config.ts";
import { appConfigMissing, type ConfigSection, type SectionWriteContext } from "./config-section-base.ts";
import { paymentsLivemode } from "./stripe.ts";
import { STORY_MIN_FOLLOWERS_MAX, storyMode, storyRulesFrom } from "./story-mention.ts";

/** The keys the console may send (money_config_merge_story allows these). */
export const STORY_CONFIG_KEYS = ["story_min_followers"] as const;

/** The Story keys out of money_config, as the page renders them. */
export function storiesConfigFrom(raw: unknown) {
  const r = storyRulesFrom(raw);
  return {
    story_min_followers: r.minFollowers,
    story_bonus_wait_sec: r.bonusWaitSec,
    story_post_window_sec: r.postWindowSec,
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
export function storiesPatchFrom(raw: unknown): { ok: true; patch: Record<string, number> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "config must be an object" };
  const patch: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(STORY_CONFIG_KEYS as readonly string[]).includes(k)) return { ok: false, error: `unknown key ${k}` };
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > STORY_MIN_FOLLOWERS_MAX) {
      return { ok: false, error: `${k} must be a whole number from 0 to ${STORY_MIN_FOLLOWERS_MAX.toLocaleString("en-US")}` };
    }
    patch[k] = v;
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
