// Supabase Edge Function — admin-web-update-lineup-config
//
// CANONICAL since 2026-07-20 (Lineup rename phase 1): the admin console calls
// this slug; admin-web-update-scoring-config stays deployed as a
// byte-equivalent compat alias until old admin builds drain, then gets
// deleted. The BLOB COLUMN deliberately keeps its old name
// (app_settings.scoring_config) — deferred to the recommender-* batch.
//
// Writes the scoring model's hyperparameters as ONE versioned jsonb blob on
// the public.app_settings singleton (scoring_config). Whole-blob writes only
// — the Subscores tab always saves its full form, so partial patches would
// only invite drift.
//
// v12 blob (MESITA-714 · Hybrid lane removed 2026-07-22): ONE hyperparam per intent axis + GP ratingPow.
//   { v: 12, laneN, sm, gp, rp, xx }
//   laneN     PER-LANE deck counts { organic, inorganic }, each (Hybrid
//             0–50 int (0 = lane off), sum ≥ 1
//   sm        where: { defaultTolKm } — GREEN consumer default (falloff frozen)
//             when:  { patience } — ONE shape knob over 2×24×7 openness array
//             what:  { tol } — super = t, none = t²
//   gp        { lnCeiling, ratingPow } — ratingPow ∈ [1,2], default 1
//   rp        Rewards Promotions rungs per strategy, [0,1]
//   xx        { levels } — the consumer Randomness ladder (low · medium ·
//             high · extra · max) → one WHOLE control 0–5 per rung; GREEN.
//             A pre-table flat `control` migrates onto the `low` rung.
// Soft-migrate: patience ← waitFloor · tol ← sibling · ratingPow defaults to 1.
// Stray pre-v11 keys (distExp · sessionH · sibling · dataAccess · context ·
// retrieval · em) are ignored. See web-admin lib/business/scores.ts RANGE TABLE.
//
// Swipe + Map read this blob live (MESITA-718). Memo airlock still cosine-only.
// yet. When the engines go live, this blob is their config source.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { validate } from "./lineup-config-validate.ts";

type Body = { config?: unknown };

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

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const v = validate(bodyRes.body.config);
  if (!v.ok) return jsonError(v.error, 400);

  const { data, error } = await admin
    .from("app_settings")
    .update({ scoring_config: v.config, updated_by: userId })
    .eq("id", 1)
    .select("scoring_config")
    .single();
  if (error) {
    return jsonError(`scoring_config_update: ${error.message}`, 500);
  }

  return json({ ok: true, config: data.scoring_config });
});
