// Supabase Edge Function — admin-web-update-scoring-config
//
// Writes the scoring model's hyperparameters as ONE versioned jsonb blob on
// the public.app_settings singleton (scoring_config). Whole-blob writes only
// — the Params tab always saves its full form, so partial patches would only
// invite drift. Validation is structural + range-clamping; the mix rows are
// NOT forced to sum to 100 (the admin UI warns instead — an operator may
// deliberately save a work-in-progress mix).
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
const LANES = ["organic-now", "organic-future", "inorganic-now", "inorganic-future"] as const;
const POSTURES = ["zero", "conservative", "aggressive", "dominant"] as const;

function num(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
}

/** Structural validation + clamping. Returns the clean blob or an error string. */
function validate(raw: unknown): { ok: true; config: unknown } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "config must be an object" };
  const r = raw as Record<string, unknown>;

  const mixIn = r.mix as Record<string, Record<string, unknown>> | undefined;
  if (!mixIn || typeof mixIn !== "object") return { ok: false, error: "config.mix missing" };
  const mix: Record<string, Record<string, number>> = {};
  for (const e of ENGINES) {
    mix[e] = {};
    for (const l of LANES) {
      const v = num(mixIn[e]?.[l], 0, 100);
      if (v == null) return { ok: false, error: `mix.${e}.${l} must be a number 0–100` };
      mix[e][l] = v;
    }
  }

  const ret = r.retrieval as Record<string, unknown> | undefined;
  const recallTopK = num(ret?.recallTopK, 10, 200);
  const shortlistN = num(ret?.shortlistN, 1, 50);
  if (recallTopK == null || shortlistN == null) {
    return { ok: false, error: "retrieval.recallTopK / shortlistN out of range" };
  }

  const ww = r.ww as Record<string, unknown> | undefined;
  const distanceHalfKm = num(ww?.distanceHalfKm, 1, 20);
  const waitHalfH = num(ww?.waitHalfH, 0.5, 4);
  const waitExp = num(ww?.waitExp, 1, 5);
  const sessionH = num(ww?.sessionH, 0.5, 4);
  if (distanceHalfKm == null || waitHalfH == null || waitExp == null || sessionH == null) {
    return { ok: false, error: "ww knobs out of range" };
  }

  const promosIn = r.promos as Record<string, unknown> | undefined;
  const promos: Record<string, number> = {};
  for (const p of POSTURES) {
    const v = num(promosIn?.[p], 0, 9);
    if (v == null) return { ok: false, error: `promos.${p} must be a number 0–9` };
    promos[p] = v;
  }

  return {
    ok: true,
    config: {
      v: 1,
      mix,
      retrieval: { recallTopK, shortlistN },
      ww: { distanceHalfKm, waitHalfH, waitExp, sessionH },
      promos,
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
