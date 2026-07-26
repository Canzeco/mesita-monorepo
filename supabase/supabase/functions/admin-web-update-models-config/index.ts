// Supabase Edge Function — admin-web-update-models-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = models-config.
//
// Writes the central models config as ONE jsonb blob on the public.app_settings
// singleton (models_config). Whole-blob writes only — the Models Config page
// always saves its full form, so partial patches would only invite drift.
//
// One { provider, model } per subsystem (supabase / enricher / lineup / memo).
// provider ∈ ('openai','perplexity'); model is a free string (the catalogs in
// web-admin evolve, so only the STRUCTURE is enforced here — a missing/garbage
// key falls back to the migration default so the blob is always complete). See
// 20260726000000_models_config.sql.
//
// STAGED: persisted ahead of the wiring; the subsystems read the blob in a
// follow-up. When they do, this blob is their model source.
//
// Auth: caller's JWT email must be in public.super_admins. verify_jwt defaults
// to true at the gateway (no config.toml entry, mirroring the memo/lineup pair).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = { config?: unknown };

const PROVIDERS = ["openai", "perplexity"] as const;
type Provider = (typeof PROVIDERS)[number];

const SUBSYSTEMS = ["supabase", "enricher", "lineup", "memo"] as const;

type Entry = { provider: Provider; model: string };

// Per-subsystem fallback — mirrors the migration default so a partial or
// garbage body still yields a complete, well-formed blob.
const FALLBACK: Record<(typeof SUBSYSTEMS)[number], Entry> = {
  supabase: { provider: "openai", model: "gpt-4o-mini" },
  enricher: { provider: "perplexity", model: "sonar-pro" },
  lineup: { provider: "openai", model: "text-embedding-3-small" },
  memo: { provider: "openai", model: "gpt-4o-mini" },
};

function cleanEntry(raw: unknown, fallback: Entry): Entry {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const provider = PROVIDERS.includes(r.provider as Provider)
    ? (r.provider as Provider)
    : fallback.provider;
  const model =
    typeof r.model === "string" &&
    r.model.trim().length > 0 &&
    r.model.trim().length <= 100
      ? r.model.trim()
      : fallback.model;
  return { provider, model };
}

/** Structural validation → a clean, complete blob (never trusts client shape). */
function validate(
  raw: unknown,
): { ok: true; config: unknown } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "config must be an object" };
  }
  const r = raw as Record<string, unknown>;
  const config: Record<string, unknown> = { v: 1 };
  for (const key of SUBSYSTEMS) {
    config[key] = cleanEntry(r[key], FALLBACK[key]);
  }
  return { ok: true, config };
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

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const v = validate(bodyRes.body.config);
  if (!v.ok) return json({ ok: false, error: v.error }, 400);

  const { data, error } = await admin
    .from("app_settings")
    .update({ models_config: v.config, updated_by: userId })
    .eq("id", 1)
    .select("models_config")
    .single();
  if (error) {
    return json(
      { ok: false, error: `models_config_update: ${error.message}` },
      500,
    );
  }

  return json({ ok: true, config: data.models_config });
});
