// _shared/config-section-models.ts — the `models` section's read and write.
//
// Was admin-web-get-models-config / admin-web-update-models-config
// (MESITA-1724 collapse). One { model } per subsystem (enricher / embeddings /
// memo) as ONE jsonb blob on app_config.models_config. NULL means "no blob yet
// → the client falls back to its DEFAULTS". See 20260726000000_models_config.sql
// for the column + shape.
//
// The READ is its own handler because it is the one section that returns no
// `updatedAt` and no normalizer: the console's coerceModelsConfig owns the
// merge, and the raw blob (or null) is what it wants.
//
// The WRITE is its own handler because it REBUILDS the blob from scratch rather
// than coercing it in place. Whole-blob writes only — the Models Config page
// always saves its full form, so partial patches would only invite drift.
//
// The MAIN model is always OpenAI (a chat model, or an embedding model under
// the `embeddings` key). The blob has no Perplexity key — the Enricher's search
// preset is enrichment_config.atlasPerplexityPreset. `supabase.model`,
// `ojo.model`, `enricher.perplexity` and `memo.perplexity` had no reader
// (MESITA-2136, MESITA-2144). The validator rebuilds the blob from the keys
// below and ignores everything else, so an older console that still sends them
// saves cleanly and a stored copy is dropped on the next save.
//
// `embeddings` WAS `lineup` (MESITA-1216) — the name outlived the engine
// MESITA-1048 deleted, and the key never ordered anything: it picks the
// place-embedding model. Migration 20260823070521 rewrote every stored row, so
// this validator reads and writes only `embeddings`. See
// _shared/models-config.ts for the reader side. Model is a free
// string (the web-admin catalogs evolve, so only the STRUCTURE is enforced — a
// missing/garbage key falls back to the migration default so the blob is
// always complete). See 20260726010000_models_config_reshape.sql.
//
// Live binding (MESITA-941): Enricher/Memo/embeddings read this blob via
// _shared/models-config.ts. (Until MESITA-1048 the Lineup rankers read
// it too — recommender-rank-map is deleted, so don't look for it.)
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { jsonError, jsonOk } from "./http.ts";
import { readAppConfig, writeAppConfig } from "./write-config.ts";
import { appConfigMissing } from "./config-section-base.ts";
import type { ConfigSection, SectionWriteContext } from "./config-section-base.ts";

// Defaults — mirror the reshape migration so a partial or garbage body still
// yields a complete, well-formed blob.
const DEFAULT = {
  enricher: { model: "gpt-4o-mini" },
  embeddings: { model: "text-embedding-3-small" },
  memo: { model: "gpt-4o-mini" },
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

/** Structural validation → a clean, complete blob (never trusts client shape). */
export function validateModelsConfig(
  raw: unknown,
): { ok: true; config: unknown } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "config must be an object" };
  }
  const r = raw as Record<string, unknown>;
  const config = {
    v: 1,
    enricher: {
      model: cleanModel(obj(r.enricher).model, DEFAULT.enricher.model),
    },
    embeddings: {
      model: cleanModel(obj(r.embeddings).model, DEFAULT.embeddings.model),
    },
    memo: {
      model: cleanModel(obj(r.memo).model, DEFAULT.memo.model),
    },
  };
  return { ok: true, config };
}

export async function readModelsSection(
  admin: SupabaseClient,
  section: ConfigSection,
): Promise<Response> {
  const res = await readAppConfig(
    admin,
    section.column,
    section.readError ?? `${section.column}_read`,
  );
  if (!res.ok) return res.response;
  // Same guard readSectionColumn uses, and the same 500 the old
  // admin-web-get-models-config gave via .single() (MESITA-1728). Without it a
  // missing singleton answered 200 with config:null, the console coerced that
  // to DEFAULTS, and the operator saw a working page whose next Save failed.
  // Unreachable today, since app_config id=1 is created by migration and
  // asserted as a required survivor before admin_reset_database truncates, but
  // the two readers should not disagree about it.
  if (!res.row) return appConfigMissing();
  return jsonOk({ config: res.row[section.column] ?? null });
}

export async function writeModelsSection(
  ctx: SectionWriteContext,
  section: ConfigSection,
): Promise<Response> {
  const v = validateModelsConfig(ctx.body.config);
  if (!v.ok) return jsonError(v.error, 400);

  const saved = await writeAppConfig(
    ctx.admin,
    { [section.column]: v.config, updated_by: ctx.userId },
    section.column,
    `${section.column}_update`,
  );
  if (!saved.ok) return saved.response;

  return jsonOk({ config: saved.row[section.column] });
}
