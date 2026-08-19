// Supabase Edge Function — admin-web-update-rewards-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = rewards-config.
//
// v11 (MESITA-1069): the payload is the CONTEXT × IDENTITY Promos config —
// visits (base: strategy × class × plan, + bonuses), orders (base: strategy ×
// plan, + bonuses, parked) and the default cap. It is written as the `v11`
// key on app_config.promos_config, MERGE-preserving the blob's other keys.
// A WHOLE-BLOB write: the caller always sends the complete config and
// normalizePromosV11 always returns a complete one.
//
// The superseded `v10` key is DELETED on every v11 save so there is exactly
// one additive source of truth. A v10-shaped SAVE is now REFUSED (409): only
// a stale tab can produce one, it is showing bundled defaults rather than the
// live blob, and accepting it would overwrite every live rate. Reads still
// migrate v10 — a restored app_config row may hold one.
//
// MESITA-992: the LIVE bill prices additive from the config. The reward_rules
// mirror table is gone (20260818090000_drop_coupons_and_dead_columns.sql) —
// the config priced every ticket long before it was dropped — so a save now
// writes the blob alone, refreshing the legacy v13 grid/actions keys it
// carries as the engine's last-resort fallback.
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
  promosWriteShape,
  type PromosConfigV11,
} from "./promos-v11-normalize.ts";

// Fold the rules into the v13 blob shape. Belt and braces: loadRewardsGrid
// prefers v11, then falls back to these blob keys.
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

  // v11 body: {config: {version: 11, visits, orders, cap}}. Anything else
  // falls through to the legacy v8 {rules, cap} path.
  const rawConfig = bodyRes.body.config;
  const shape = promosWriteShape(rawConfig);

  // A v10 SAVE is refused outright. Nothing shipped writes v10 any more, so
  // it can only be a stale tab whose bundle predates the v11 migration — and
  // such a tab cannot parse the live blob, so it is displaying its own bundled
  // DEFAULTS. Letting it through would overwrite every live rate with those
  // defaults, silently, on a single click. Reads still migrate v10 (see
  // promosWriteShape); only writes are closed.
  if (shape === "stale-v10") {
    return jsonError(
      "This page is out of date — reload it before saving. It is showing " +
        "default rates, not the live ones, and saving would overwrite them.",
      409,
    );
  }

  let rules: RewardRule[];
  let cap: number;
  let promosConfig: PromosConfigV11 | null = null;

  if (shape === "v11") {
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

  // MERGE-preserve the blob: the v13 grid/actions fallback and the cap are
  // refreshed, v11 is written on a config save, and any other keys riding the
  // blob survive untouched.
  const current = await admin
    .from("app_config")
    .select("promos_config")
    .eq("id", 1)
    .maybeSingle();
  if (current.error) {
    return jsonError(`promos_config_read: ${current.error.message}`, 500);
  }
  const existing =
    (current.data?.promos_config ?? {}) as Record<string, unknown>;

  const nextBlob: Record<string, unknown> = {
    ...existing,
    ...blobFromRules(rules, cap),
    ...(promosConfig ? { v11: promosConfig } : {}),
  };
  // One additive source of truth: v11 supersedes v10 outright, so the old key
  // is dropped rather than left to drift behind the live config.
  if (promosConfig) delete nextBlob.v10;

  const settings = await admin
    .from("app_config")
    .update({ promos_config: nextBlob, updated_by: userId })
    .eq("id", 1)
    .select("updated_at")
    .single();
  if (settings.error) {
    return jsonError(`rewards_cap_update: ${settings.error.message}`, 500);
  }

  return jsonOk({
    config: promosConfig,
    rules,
    cap,
    updatedAt: settings.data.updated_at,
  });
});
