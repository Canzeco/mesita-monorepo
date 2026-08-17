// Supabase Edge Function — admin-web-update-rewards-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = rewards-config.
//
// v11 (MESITA-1069): the payload is the CONTEXT × IDENTITY Promos config —
// visits (base: strategy × class × plan, + bonuses), orders (base: strategy ×
// plan, + bonuses, parked) and the default cap. It is written as the `v11`
// key on app_settings.rewards_config, MERGE-preserving the blob's other keys.
// A WHOLE-BLOB write: the caller always sends the complete config and
// normalizePromosV11 always returns a complete one.
//
// The superseded `v10` key is DELETED on every v11 save so there is exactly
// one additive source of truth; a v10-shaped body (a stale client tab mid-
// deploy) is migrated forward rather than rejected.
//
// MESITA-992: the LIVE bill prices additive from the config. Every save still
// derives and upserts the 40 reward_rules cells as a frozen mirror (rollback
// / empty-config fallback) and refreshes the legacy v13 grid/actions blob
// keys. See 20260804170553_reward_rules_normalized.sql.
//
// A legacy {rules, cap} body still writes through the v8 path unchanged.
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
  legacyRulesFromV11,
  normalizePromosV11,
  type PromosConfigV11,
} from "./promos-v11-normalize.ts";

// Mirror the rules into the v13 blob shape. Belt and braces: loadRewardsGrid
// prefers v10, then the rules table, then this blob fallback.
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

  // v11 body: {config: {version: 11, visits, orders, cap}}. A version-10 body
  // is accepted and migrated (stale client tab mid-deploy). Anything else
  // falls through to the legacy v8 {rules, cap} path.
  const rawConfig = bodyRes.body.config;
  const configVersion = !!rawConfig && typeof rawConfig === "object" &&
      !Array.isArray(rawConfig)
    ? (rawConfig as Record<string, unknown>).version
    : undefined;
  const isPromosConfig = configVersion === 10 || configVersion === 11;

  let rules: RewardRule[];
  let cap: number;
  let promosConfig: PromosConfigV11 | null = null;

  if (isPromosConfig) {
    const norm = normalizePromosV11(rawConfig);
    if (!norm.ok) return jsonError(norm.error, 400);
    promosConfig = norm.value;
    rules = legacyRulesFromV11(norm.value);
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

  const nextBlob: Record<string, unknown> = {
    ...existing,
    ...blobFromRules(rules, cap),
    ...(promosConfig ? { v11: promosConfig } : {}),
  };
  // One additive source of truth: v11 supersedes v10 outright, so the old key
  // is dropped rather than left to drift behind the live config.
  if (promosConfig) delete nextBlob.v10;

  const settings = await admin
    .from("app_settings")
    .update({ rewards_config: nextBlob, updated_by: userId })
    .eq("id", 1)
    .select("updated_at")
    .single();
  if (settings.error) {
    return jsonError(`rewards_cap_update: ${settings.error.message}`, 500);
  }

  return jsonOk({
    config: promosConfig,
    rules: upsert.data ?? rules,
    cap,
    updatedAt: settings.data.updated_at,
  });
});
