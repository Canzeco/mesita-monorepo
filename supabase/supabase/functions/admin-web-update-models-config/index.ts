// Supabase Edge Function — admin-web-update-models-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = models-config.
//
// Writes the central models config as ONE jsonb blob on the public.app_config
// singleton (models_config). Whole-blob writes only — the Models Config page
// always saves its full form, so partial patches would only invite drift.
//
// The MAIN model is always OpenAI (a chat model, or an embedding model under
// the legacy `lineup` key). Perplexity is NEVER a main model — it's an optional
// web-grounding leg, and ONLY Enricher and Memo have one ("off" disables it).
// The `lineup` KEY outlived the engine MESITA-1048 deleted: it now selects the
// place-embedding model and nothing else. Renaming it needs a data migration —
// see _shared/models-config.ts. Model is a free
// string (the web-admin catalogs evolve, so only the STRUCTURE is enforced —
// a missing/garbage key falls back to the migration default so the blob is
// always complete). See 20260726010000_models_config_reshape.sql.
//
// Live binding (MESITA-941): Enricher/Memo/embeddings/suggest-promo read this
// blob via _shared/models-config.ts. (Until MESITA-1048 the Lineup rankers read
// it too — recommender-rank-map is deleted, so don't look for it.)
//
// Auth: caller's JWT email must be in public.super_admins. verify_jwt defaults
// to true at the gateway (no config.toml entry, mirroring the memo pair).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, jsonError, jsonOk, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = { config?: unknown };

const PERPLEXITY_OPTIONS = [
  "off",
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
] as const;

// Defaults — mirror the reshape migration so a partial or garbage body still
// yields a complete, well-formed blob.
const DEFAULT = {
  supabase: { model: "gpt-4o-mini" },
  enricher: { model: "gpt-4o-mini", perplexity: "sonar-pro" },
  lineup: { model: "text-embedding-3-small" },
  memo: { model: "gpt-4o-mini", perplexity: "sonar-pro" },
};

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function cleanModel(v: unknown, fallback: string): string {
  return typeof v === "string" &&
    v.trim().length > 0 &&
    v.trim().length <= 100
    ? v.trim()
    : fallback;
}

function cleanPerplexity(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  return (PERPLEXITY_OPTIONS as readonly string[]).includes(s) ? s : fallback;
}

/** Structural validation → a clean, complete blob (never trusts client shape). */
function validate(
  raw: unknown,
): { ok: true; config: unknown } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "config must be an object" };
  }
  const r = raw as Record<string, unknown>;
  const config = {
    v: 1,
    supabase: {
      model: cleanModel(obj(r.supabase).model, DEFAULT.supabase.model),
    },
    enricher: {
      model: cleanModel(obj(r.enricher).model, DEFAULT.enricher.model),
      perplexity: cleanPerplexity(
        obj(r.enricher).perplexity,
        DEFAULT.enricher.perplexity,
      ),
    },
    lineup: {
      model: cleanModel(obj(r.lineup).model, DEFAULT.lineup.model),
    },
    memo: {
      model: cleanModel(obj(r.memo).model, DEFAULT.memo.model),
      perplexity: cleanPerplexity(
        obj(r.memo).perplexity,
        DEFAULT.memo.perplexity,
      ),
    },
  };
  return { ok: true, config };
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

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const v = validate(bodyRes.body.config);
  if (!v.ok) return jsonError(v.error, 400);

  const { data, error } = await admin
    .from("app_config")
    .update({ models_config: v.config, updated_by: userId })
    .eq("id", 1)
    .select("models_config")
    .single();
  if (error) {
    return jsonError(`models_config_update: ${error.message}`, 500);
  }

  return jsonOk({ config: data.models_config });
});
