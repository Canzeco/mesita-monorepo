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
// v11 blob (MESITA-714): ONE hyperparam per intent axis + GP ratingPow.
//   { v: 11, laneN, sm, gp, rp, xx }
//   laneN     PER-LANE deck counts { organic, inorganic, hybrid }, each
//             0–50 int (0 = lane off), sum ≥ 1
//   sm        where: { defaultTolKm } — GREEN consumer default (falloff frozen)
//             when:  { patience } — ONE shape knob over 2×24×7 openness array
//             what:  { tol } — super = t, none = t²
//   gp        { lnCeiling, ratingPow } — ratingPow ∈ [1,2], default 1
//   rp        Rewards Promotions rungs per posture, [0,1]
//   xx        { control } ∈ [0,5] — GREEN default only
// Soft-migrate: patience ← waitFloor · tol ← sibling · ratingPow defaults to 1.
// Stray pre-v11 keys (distExp · sessionH · sibling · dataAccess · context ·
// retrieval · em) are ignored. See web-admin lib/business/scores.ts RANGE TABLE.
//
// Swipe + Map read this blob live (MESITA-718). Memo airlock still cosine-only.
// yet. When the engines go live, this blob is their config source.
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

type Body = { config?: unknown };

const POSTURES = ["zero", "conservative", "aggressive", "dominant"] as const;
const LANE_N_MAX = 50;

function num(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
}

/** Structural validation + clamping. Returns the clean blob or an error string. */
function validate(raw: unknown): { ok: true; config: unknown } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "config must be an object" };
  const r = raw as Record<string, unknown>;

  const LANE_IDS = ["organic", "inorganic", "hybrid"] as const;
  const laneN: Record<string, number> = {};
  if (typeof r.laneN === "number") {
    const n = num(r.laneN, 0, LANE_N_MAX);
    if (n == null) {
      return { ok: false, error: `laneN must be a number 0–${LANE_N_MAX}` };
    }
    for (const id of LANE_IDS) laneN[id] = Math.round(n);
  } else if (r.laneN && typeof r.laneN === "object") {
    const rawLaneN = r.laneN as Record<string, unknown>;
    for (const id of LANE_IDS) {
      const n = num(rawLaneN[id], 0, LANE_N_MAX);
      if (n == null) {
        return { ok: false, error: `laneN.${id} must be a number 0–${LANE_N_MAX}` };
      }
      laneN[id] = Math.round(n);
    }
  } else {
    return {
      ok: false,
      error: "laneN must be per-lane counts { organic, inorganic, hybrid }",
    };
  }
  if (laneN.organic + laneN.inorganic + laneN.hybrid < 1) {
    return { ok: false, error: "laneN: at least one lane must be > 0" };
  }

  // SM — one hyperparam per intent axis (v11). Soft-migrate v10 keys.
  const smIn = r.sm as Record<string, unknown> | undefined;
  const whereIn = smIn?.where as Record<string, unknown> | undefined;
  const defaultTolKm = num(whereIn?.defaultTolKm, 0.5, 20) ?? 5;

  const whenIn = smIn?.when as Record<string, unknown> | undefined;
  const patience =
    num(whenIn?.patience, 0, 1) ??
    num(whenIn?.waitFloor, 0, 1) ??
    0.35;

  const whatIn = smIn?.what as Record<string, unknown> | undefined;
  const tol =
    num(whatIn?.tol, 0, 1) ??
    num(whatIn?.sibling, 0, 1) ??
    0.5;

  // GP — ln ceiling + rating exponent (v11).
  const gpIn = r.gp as Record<string, unknown> | undefined;
  const lnCeiling = num(gpIn?.lnCeiling, 5, 15);
  if (lnCeiling == null) return { ok: false, error: "gp.lnCeiling out of range" };
  const ratingPow = num(gpIn?.ratingPow, 1, 2) ?? 1;

  // RP — the posture rungs, [0,1].
  const rpIn = r.rp as Record<string, unknown> | undefined;
  const rp: Record<string, number> = {};
  for (const p of POSTURES) {
    const v = num(rpIn?.[p], 0, 1);
    if (v == null) return { ok: false, error: `rp.${p} must be a number 0–1` };
    rp[p] = v;
  }

  // XX — the deck-wide randomness control (green default only).
  const xxIn = r.xx as Record<string, unknown> | undefined;
  const control = num(xxIn?.control, 0, 5);
  if (control == null) return { ok: false, error: "xx.control must be a number 0–5" };

  return {
    ok: true,
    config: {
      v: 11,
      laneN: {
        organic: laneN.organic,
        inorganic: laneN.inorganic,
        hybrid: laneN.hybrid,
      },
      sm: {
        where: { defaultTolKm },
        when: { patience },
        what: { tol },
      },
      gp: { lnCeiling, ratingPow },
      rp,
      xx: { control },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

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
  if (!v.ok) return json({ ok: false, error: v.error }, 400);

  const { data, error } = await admin
    .from("app_settings")
    .update({ scoring_config: v.config, updated_by: userId })
    .eq("id", 1)
    .select("scoring_config")
    .single();
  if (error) {
    return json({ ok: false, error: `scoring_config_update: ${error.message}` }, 500);
  }

  return json({ ok: true, config: data.scoring_config });
});
