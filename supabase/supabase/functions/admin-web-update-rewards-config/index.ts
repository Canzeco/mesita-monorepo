// Supabase Edge Function — admin-web-update-rewards-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = rewards-config.
//
// Writes the v8 NORMALIZED reward rules (MESITA-873): 60 rows, one per
// (strategy × class × action), upserted in ONE call, plus the universal cap
// on the app_settings singleton (one platform constant, not a rule).
//
// A WHOLE-TABLE write: the payout table is one coherent thing, so the caller
// always sends every rule and normalizeRewards always returns the complete
// 60 — a partial body can never leave the table half-written. Every cell is
// snapped to the 5% grid (5–70%, MESITA-866/872) and the cap onto its
// categorical ladder, so a malformed price can never land.
//
// The legacy blob keeps receiving the same numbers in v13 shape so the engine
// has something to fall back to if the rules table is ever empty. See
// 20260804170553_reward_rules_normalized.sql.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { normalizeRewards, type RewardRule } from "./rewards-config-normalize.ts";

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
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  // Accept the payload at the top level; `config` is still read as a wrapper
  // so an older client mid-deploy doesn't 400.
  const bodyRes = await readJson<{ rules?: unknown; cap?: unknown; config?: unknown }>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const payload = bodyRes.body.rules !== undefined || bodyRes.body.cap !== undefined
    ? bodyRes.body
    : bodyRes.body.config;

  const norm = normalizeRewards(payload);
  if (!norm.ok) return json({ ok: false, error: norm.error }, 400);

  const now = new Date().toISOString();
  const upsert = await admin
    .from("reward_rules")
    .upsert(
      norm.value.rules.map((r) => ({ ...r, updated_at: now, updated_by: userId })),
      { onConflict: "strategy,class,action" },
    )
    .select("strategy, class, action, discount_percent");
  if (upsert.error) {
    return json(
      { ok: false, error: `reward_rules_update: ${upsert.error.message}` },
      500,
    );
  }

  const settings = await admin
    .from("app_settings")
    .update({
      rewards_config: blobFromRules(norm.value.rules, norm.value.cap),
      updated_by: userId,
    })
    .eq("id", 1)
    .select("updated_at")
    .single();
  if (settings.error) {
    return json(
      { ok: false, error: `rewards_cap_update: ${settings.error.message}` },
      500,
    );
  }

  return json({
    ok: true,
    rules: upsert.data ?? norm.value.rules,
    cap: norm.value.cap,
    updatedAt: settings.data.updated_at,
  });
});
