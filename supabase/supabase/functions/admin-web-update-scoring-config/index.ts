// Supabase Edge Function — admin-web-update-scoring-config
//
// Writes the scoring model's hyperparameters as ONE versioned jsonb blob on
// the public.app_settings singleton (scoring_config). Whole-blob writes only
// — the Subscores tab always saves its full form, so partial patches would
// only invite drift.
//
// v6 blob (scoring v10, MESITA-644 · per-lane counts MESITA-659 · SM cut to
// two knobs per factor) — keys follow the subscore names (EM · SM · GP · RP ·
// XX, all [0,1]; three lanes; merge O → I → H). The EM encoder
// (text-embedding-3-small @ its native 1536 dims) is a FIXED decision,
// deliberately NOT in the blob — a stray `em` key from an older client is
// ignored:
//   { v: 6, laneN, retrieval, sm, gp, rp, xx, dataAccess, context }
//   laneN     PER-LANE deck counts { organic, inorganic, hybrid }, each
//             0–50 int (0 = lane off), sum ≥ 1; the merged deck (dedupe,
//             no backfill) is ≤ their sum. A legacy v4 flat number expands
//             to all three lanes.
//   sm        Structured Match knobs — where (pointTolKm · distExp) · when
//             (waitFloor · sessionH) · what (sibling · mismatch). Zone
//             spillover, wait transition/steepness and the 30-min grid are
//             frozen constants in the model — not config; leftover v5 keys
//             are ignored.
//   gp        Google Popularity — lnCeiling (ln(1 + ★·n) that reads GP 1)
//   rp        Rewards Promotions rungs per posture, [0,1]
//   xx        Random Number — control ∈ [0,5] (0 = off, pure merit)
//   dataAccess the core config — per-subscore data-source toggles
//             (consumer · place · intent · interaction), ⊂ each subscore's
//             applicable set; default all ON
//   context   which TEXT fields EM reads (EM is the only field-configurable one)
// See web-admin lib/business/scores.ts — the RANGE TABLE there is mirrored
// VERBATIM here; a value the UI allows but this EF clamps would silently
// move the form on save.
//
// The model is still a frontend draft: nothing in Swipe/Map/Memo reads this
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

// Mirrors APPLICABLE_SOURCES in web-admin lib/business/scores.ts — a source
// a subscore structurally cannot read is rejected, not silently dropped.
const APPLICABLE_SOURCES: Record<string, readonly string[]> = {
  em: ["consumer", "place", "intent"],
  sm: ["place", "intent", "interaction"],
  gp: ["place"],
  rp: ["place"],
  xx: [],
};
const SUBSCORE_IDS = ["em", "sm", "gp", "rp", "xx"] as const;

function num(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
}

/** Structural validation + clamping. Returns the clean blob or an error string. */
function validate(raw: unknown): { ok: true; config: unknown } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "config must be an object" };
  const r = raw as Record<string, unknown>;

  // Per-lane deck counts (v5). A legacy flat number expands to all three;
  // each lane 0–LANE_N_MAX (0 = lane off); an all-zero config would empty
  // every deck, so the sum must be ≥ 1.
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

  const ret = r.retrieval as Record<string, unknown> | undefined;
  const recallTopK = num(ret?.recallTopK, 10, 200);
  if (recallTopK == null) return { ok: false, error: "retrieval.recallTopK out of range" };

  // SM — where × when × what (v6: two knobs each; zone spillover, wait
  // transition/steepness and the 30-min grid are frozen constants in the
  // model, so they're not in the blob and a stray v5 key is ignored).
  const smIn = r.sm as Record<string, unknown> | undefined;
  const whereIn = smIn?.where as Record<string, unknown> | undefined;
  const pointTolKm = num(whereIn?.pointTolKm, 0.5, 20);
  const distExp = num(whereIn?.distExp, 1, 5);
  if (pointTolKm == null || distExp == null) {
    return { ok: false, error: "sm.where knobs out of range" };
  }
  const whenIn = smIn?.when as Record<string, unknown> | undefined;
  const waitFloor = num(whenIn?.waitFloor, 0, 1);
  const sessionH = num(whenIn?.sessionH, 0.5, 4);
  if (waitFloor == null || sessionH == null) {
    return { ok: false, error: "sm.when knobs out of range" };
  }
  const whatIn = smIn?.what as Record<string, unknown> | undefined;
  const sibling = num(whatIn?.sibling, 0, 1);
  const mismatch = num(whatIn?.mismatch, 0, 1);
  if (sibling == null || mismatch == null) {
    return { ok: false, error: "sm.what knobs out of range" };
  }

  // GP — the log squash's ceiling.
  const gpIn = r.gp as Record<string, unknown> | undefined;
  const lnCeiling = num(gpIn?.lnCeiling, 5, 15);
  if (lnCeiling == null) return { ok: false, error: "gp.lnCeiling out of range" };

  // RP — the posture rungs, [0,1].
  const rpIn = r.rp as Record<string, unknown> | undefined;
  const rp: Record<string, number> = {};
  for (const p of POSTURES) {
    const v = num(rpIn?.[p], 0, 1);
    if (v == null) return { ok: false, error: `rp.${p} must be a number 0–1` };
    rp[p] = v;
  }

  // XX — the deck-wide randomness control.
  const xxIn = r.xx as Record<string, unknown> | undefined;
  const control = num(xxIn?.control, 0, 5);
  if (control == null) return { ok: false, error: "xx.control must be a number 0–5" };

  // dataAccess — the core config: per-subscore source toggles. Optional
  // (older clients omit it; the frontend coercer default-fills all-ON).
  // Each present cell must be an array ⊂ that subscore's applicable set;
  // empty arrays are VALID (that subscore reads nothing — degenerate on
  // purpose).
  const daIn = r.dataAccess as Record<string, unknown> | undefined;
  let dataAccess: Record<string, string[]> | null = null;
  if (daIn !== undefined) {
    if (!daIn || typeof daIn !== "object") {
      return { ok: false, error: "config.dataAccess must be an object" };
    }
    dataAccess = {};
    for (const sub of SUBSCORE_IDS) {
      const cell = daIn[sub];
      if (cell === undefined) continue; // missing cell → client defaults
      if (!Array.isArray(cell)) {
        return { ok: false, error: `dataAccess.${sub} must be an array` };
      }
      const applicable = APPLICABLE_SOURCES[sub];
      const clean = [...new Set(cell)];
      for (const src of clean) {
        if (typeof src !== "string" || !applicable.includes(src)) {
          return { ok: false, error: `dataAccess.${sub} has an inapplicable source` };
        }
      }
      dataAccess[sub] = (clean as string[]).sort();
    }
  }

  // Context — which TEXT fields EM reads. Validation is STRUCTURAL only
  // ("side.name" strings, deduped, capped) — the exact key list lives in the
  // frontend registry and its coercer drops unknowns on read, so this EF
  // never has to chase it. Missing/absent → omitted; the client coerces to
  // its defaults. Empty arrays are VALID (everything off — degenerate on
  // purpose).
  const KEY_RE = /^(consumer|intent|place)\.[a-z_]{1,32}$/;
  const contextIn = r.context as Record<string, unknown> | undefined;
  let context: Record<string, string[]> | null = null;
  if (contextIn !== undefined) {
    if (!contextIn || typeof contextIn !== "object") {
      return { ok: false, error: "config.context must be an object" };
    }
    context = {};
    for (const tier of ["em"] as const) {
      const v = contextIn[tier];
      if (!Array.isArray(v)) return { ok: false, error: `context.${tier} must be an array` };
      const clean = [...new Set(v.filter((k) => typeof k === "string" && KEY_RE.test(k)))];
      if (clean.length !== v.length) {
        return { ok: false, error: `context.${tier} has invalid or duplicate keys` };
      }
      if (clean.length > 64) return { ok: false, error: `context.${tier} too large` };
      context[tier] = (clean as string[]).sort();
    }
  }

  return {
    ok: true,
    config: {
      v: 6,
      laneN: {
        organic: laneN.organic,
        inorganic: laneN.inorganic,
        hybrid: laneN.hybrid,
      },
      retrieval: { recallTopK },
      sm: {
        where: { pointTolKm, distExp },
        when: { waitFloor, sessionH },
        what: { sibling, mismatch },
      },
      gp: { lnCeiling },
      rp,
      xx: { control },
      ...(dataAccess ? { dataAccess } : {}),
      ...(context ? { context } : {}),
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
