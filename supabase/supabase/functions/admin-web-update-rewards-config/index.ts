// Supabase Edge Function — admin-web-update-rewards-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = rewards-config.
//
// v10 (MESITA-991): the payload is the ADDITIVE Promos config — base
// (strategy × class) + bonuses (welcome / mesita / story with a nullable
// Influencer override / google) + the default cap. It is written as the
// `v10` key on app_settings.rewards_config, MERGE-preserving the blob's other
// keys. A WHOLE-BLOB write: the caller always sends the complete config and
// normalizePromosV10 always returns a complete one.
//
// Until the engine flips additive (MESITA-992), the LIVE bill still prices
// best-of from public.reward_rules — so every v10 save also derives and
// upserts those 40 cells (cell = base + that action's bonus, clamped to 70).
// The legacy v13 grid/actions keys keep receiving the same numbers as the
// engine's empty-table fallback. See 20260804170553_reward_rules_normalized.sql.
//
// A legacy {rules, cap} body (older client mid-deploy) still writes through
// the v8 path unchanged — delete that path with MESITA-992.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, jsonError, jsonOk, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { normalizeRewards, type RewardRule } from "./rewards-config-normalize.ts";
import {
  legacyRulesFromV10,
  normalizePromosV10,
  type PromosConfigV10,
} from "./promos-v10-normalize.ts";

// Mirror the rules into the v13 blob shape. Belt and braces: loadRewardsGrid
// prefers the rules table, and only falls back here if that read ever comes
// back empty — at which point stale prices beat no prices.
function blobFromRules(rules: RewardRule[], cap: number): Record<string, unknown> {
  const grid: Record<string, Record<string, number>> = {};
  const actions: Record<string, Record<string, Record<string, number>>> = {};

  for (const r of rules) {
    if (r.action === "standing") {
      grid[r.class] ??= { zero: 0 };
      grid[r.class][r.strategy] = r.discount_percent;
      continue;
    }
    actions[r.action] ??= {};
    actions[r.action][r.class] ??= { zero: 0 };
    actions[r.action][r.class][r.strategy] = r.discount_percent;
  }

  return { grid, actions, cap };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<{ rules?: unknown; cap?: unknown; config?: unknown }>(req);
  if (!bodyRes.ok) return bodyRes.response;

  // v10 body: {config: {version: 10, base, bonuses, cap}}. Anything else
  // falls through to the legacy v8 {rules, cap} path.
  const rawConfig = bodyRes.body.config;
  const isV10 = !!rawConfig && typeof rawConfig === "object" &&
    !Array.isArray(rawConfig) &&
    (rawConfig as Record<string, unknown>).version === 10;

  let rules: RewardRule[];
  let cap: number;
  let v10Config: PromosConfigV10 | null = null;

  if (isV10) {
    const norm = normalizePromosV10(rawConfig);
    if (!norm.ok) return jsonError(norm.error, 400);
    v10Config = norm.value;
    rules = legacyRulesFromV10(norm.value);
    cap = norm.value.cap;
  } else {
    const payload = bodyRes.body.rules !== undefined || bodyRes.body.cap !== undefined
      ? bodyRes.body
      : bodyRes.body.config;
    const norm = normalizeRewards(payload);
    if (!norm.ok) return jsonError(norm.error, 400);
    rules = norm.value.rules;
    cap = norm.value.cap;
  }

  const now = new Date().toISOString();
  const upsert = await admin
    .from("reward_rules")
    .upsert(
      rules.map((r) => ({ ...r, updated_at: now, updated_by: userId })),
      { onConflict: "strategy,class,action" },
    )
    .select("strategy, class, action, discount_percent");
  if (upsert.error) {
    return jsonError(`reward_rules_update: ${upsert.error.message}`, 500);
  }

  // MERGE-preserve the blob: the v13 grid/actions fallback and the cap are
  // refreshed, the v10 key is written only on a v10 save, and any other keys
  // riding the blob survive untouched.
  const current = await admin
    .from("app_settings")
    .select("rewards_config")
    .eq("id", 1)
    .maybeSingle();
  if (current.error) {
    return jsonError(`rewards_config_read: ${current.error.message}`, 500);
  }
  const existing =
    (current.data?.rewards_config ?? {}) as Record<string, unknown>;

  const settings = await admin
    .from("app_settings")
    .update({
      rewards_config: {
        ...existing,
        ...blobFromRules(rules, cap),
        ...(v10Config ? { v10: v10Config } : {}),
      },
      updated_by: userId,
    })
    .eq("id", 1)
    .select("updated_at")
    .single();
  if (settings.error) {
    return jsonError(`rewards_cap_update: ${settings.error.message}`, 500);
  }

  return jsonOk({
    config: v10Config,
    rules: upsert.data ?? rules,
    cap,
    updatedAt: settings.data.updated_at,
  });
});
