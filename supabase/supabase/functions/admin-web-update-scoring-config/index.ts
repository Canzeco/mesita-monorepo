// Supabase Edge Function — admin-web-update-scoring-config
//
// Writes the scoring model's hyperparameters as ONE versioned jsonb blob on
// the public.app_settings singleton (scoring_config). Whole-blob writes only
// — the Subscores tab always saves its full form, so partial patches would
// only invite drift.
//
// v3 blob (scoring v9.1, MESITA-621) — keys follow the Subscore names:
//   { v: 3, decks, retrieval, es, gp, rp, ic, context }
//   decks     per-lane MAXES per engine — sub-deck ceilings, not quotas
//             (the merged deck dedupes and never backfills)
//   es        Embeddings Similarity params (embedDims)
//   gp        Google Popularity curve (refCount · qualityMid · qualitySteep ·
//             coldStartFloor · minReviews)
//   rp        Rewards Promotions rungs per posture
//   ic        Intent Context knobs (where × when; was `ww` in v2)
//   context   which TEXT fields ES reads (ES is the only configurable one)
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

const ENGINES = ["swipe", "map", "memo"] as const;
const DECK_KEYS = ["on", "of", "in", "if"] as const;
const POSTURES = ["zero", "conservative", "aggressive", "dominant"] as const;
const DECK_COUNT_MAX = 20;
/** RP's ceiling — the top rung of the membership ladder (scores.RP_MAX). */
const RP_MAX = 3;

function num(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
}

/** Structural validation + clamping. Returns the clean blob or an error string. */
function validate(raw: unknown): { ok: true; config: unknown } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "config must be an object" };
  const r = raw as Record<string, unknown>;

  // Deck composition — per-lane MAXES; required per engine per lane; ints, 0–20.
  const decksIn = r.decks as Record<string, Record<string, unknown>> | undefined;
  if (!decksIn || typeof decksIn !== "object") return { ok: false, error: "config.decks missing" };
  const decks: Record<string, Record<string, number>> = {};
  for (const e of ENGINES) {
    decks[e] = {};
    for (const k of DECK_KEYS) {
      const v = num(decksIn[e]?.[k], 0, DECK_COUNT_MAX);
      if (v == null) {
        return { ok: false, error: `decks.${e}.${k} must be a number 0–${DECK_COUNT_MAX}` };
      }
      decks[e][k] = Math.round(v);
    }
  }

  const ret = r.retrieval as Record<string, unknown> | undefined;
  const recallTopK = num(ret?.recallTopK, 10, 200);
  if (recallTopK == null) return { ok: false, error: "retrieval.recallTopK out of range" };

  // ES — the encoder's params.
  const esIn = r.es as Record<string, unknown> | undefined;
  const embedDims = num(esIn?.embedDims, 16, 256);
  if (embedDims == null) return { ok: false, error: "es.embedDims out of range" };

  // GP — the smooth popularity curve.
  const gpIn = r.gp as Record<string, unknown> | undefined;
  const refCount = num(gpIn?.refCount, 100, 100000);
  const qualityMid = num(gpIn?.qualityMid, 1, 5);
  const qualitySteep = num(gpIn?.qualitySteep, 0.1, 10);
  const coldStartFloor = num(gpIn?.coldStartFloor, 0, 1);
  const minReviews = num(gpIn?.minReviews, 0, 1000);
  if (
    refCount == null || qualityMid == null || qualitySteep == null ||
    coldStartFloor == null || minReviews == null
  ) {
    return { ok: false, error: "gp knobs out of range" };
  }

  // RP — the posture rungs.
  const rpIn = r.rp as Record<string, unknown> | undefined;
  const rp: Record<string, number> = {};
  for (const p of POSTURES) {
    const v = num(rpIn?.[p], 0, RP_MAX);
    if (v == null) return { ok: false, error: `rp.${p} must be a number 0–${RP_MAX}` };
    rp[p] = v;
  }

  // IC — the intent context's knobs.
  const icIn = r.ic as Record<string, unknown> | undefined;
  const distanceHalfKm = num(icIn?.distanceHalfKm, 1, 20);
  const distanceExp = num(icIn?.distanceExp, 1, 3);
  const waitHalfH = num(icIn?.waitHalfH, 0.5, 4);
  const waitExp = num(icIn?.waitExp, 1, 5);
  const sessionH = num(icIn?.sessionH, 0.5, 4);
  const timeBlockH = num(icIn?.timeBlockH, 0.25, 1);
  if (
    distanceHalfKm == null || distanceExp == null || waitHalfH == null ||
    waitExp == null || sessionH == null || timeBlockH == null
  ) {
    return { ok: false, error: "ic knobs out of range" };
  }

  // Context — which TEXT fields ES reads. Validation is STRUCTURAL only
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
    for (const tier of ["es"] as const) {
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
      v: 3,
      decks,
      retrieval: { recallTopK },
      es: { embedDims: Math.round(embedDims) },
      gp: {
        refCount: Math.round(refCount),
        qualityMid,
        qualitySteep,
        coldStartFloor,
        minReviews: Math.round(minReviews),
      },
      rp,
      ic: {
        distanceHalfKm,
        distanceExp,
        waitHalfH,
        waitExp,
        sessionH,
        timeBlockH,
      },
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
