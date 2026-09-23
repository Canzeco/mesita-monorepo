// Shared Models Config types + catalog. Kept OUT of actions.ts because that
// file is a "use server" module (it may only export async functions to the
// client) and it pulls in efInvoke / next/headers — importing the catalog or
// defaults from there would hand the client stubs and crash the picker. Same
// footgun the Memo types file documents.
//
// This page is the SoT for app_config.models_config (MESITA-941). Live readers
// (_shared/models-config.ts → get-memo-config, Enricher stages, embeddings,
// business-web-suggest-promo, ojo-engine) bind supabase / enricher.model /
// embeddings / memo.* / ojo.model.
// Enricher Perplexity is NOT read from this blob — app_config's
// atlas_perplexity_preset is the live search preset (enricher.perplexity here
// is staged). Text / image quality tiers are atlas_* columns too; this page
// edits those three alongside the models_config blob (MESITA-1811).

import type { SynthesisQuality } from "@/lib/synthesis-quality";
import type { PerplexityPreset } from "../enricher-config/actions";

/** Live Enricher model picks — stored on atlas_* columns, edited on this page. */
export type EnricherModelSettings = {
  synthesisQuality: SynthesisQuality;
  visionQuality: SynthesisQuality;
  perplexityPreset: PerplexityPreset;
};

export const DEFAULT_ENRICHER_MODEL_SETTINGS: EnricherModelSettings = {
  synthesisQuality: "economy",
  visionQuality: "economy",
  perplexityPreset: "pro-search",
};

/** Perplexity Agent presets for Enricher Serp + Links (not Memo Sonar). */
export const ENRICHER_PERPLEXITY_PRESETS: readonly {
  value: PerplexityPreset;
  label: string;
}[] = [
  { value: "fast-search", label: "fast-search" },
  { value: "pro-search", label: "pro-search" },
  { value: "deep-research", label: "deep-research" },
  { value: "advanced-deep-research", label: "advanced-deep-research" },
];

// The persisted blob (app_config.models_config). supabase + memo + ojo are
// edited here; enricher.model is informational (the stored atlas_* quality
// tiers pick the live OpenAI model, with models_config.enricher.model as the
// cheap/default binding); enricher.perplexity is staged (unread — atlas_perplexity_preset wins).
export type ModelsConfig = {
  v: number;
  supabase: { model: string };
  enricher: { model: string; perplexity: string };
  embeddings: { model: string };
  memo: { model: string; perplexity: string };
  ojo: { model: string };
};

// OpenAI chat catalog for editable OpenAI knobs on this page.
// The gpt-5.6 family (Sol / Terra / Luna — GA 2026-07-09) is included; treat
// those ids as PROVISIONAL until confirmed against platform.openai.com. Model is
// stored as a free string, so editing this list never breaks a saved blob.
export const OPENAI_CHAT_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
] as const;

// Perplexity values accepted in the blob's enricher/memo legs ("off" = none).
export const PERPLEXITY_OPTIONS = [
  "off",
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
] as const;

// Defaults — mirror the migration's app_config.models_config seed. The client
// shows these before load; the server coerces a null/partial blob to them.
export const DEFAULT_MODELS_CONFIG: ModelsConfig = {
  v: 1,
  supabase: { model: "gpt-4o-mini" },
  enricher: { model: "gpt-4o-mini", perplexity: "sonar-pro" },
  embeddings: { model: "text-embedding-3-small" },
  memo: { model: "gpt-4o-mini", perplexity: "sonar-pro" },
  ojo: { model: "gpt-4o" },
};

/** Merge a null / partial / untrusted blob into a complete, valid config. */
export function coerceModelsConfig(raw: unknown): ModelsConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // Keyed by string, not a closed key union: the coercer also has to reach the
  // LEGACY `lineup` key, which is deliberately not a subsystem any more
  // (MESITA-1216) but still appears in blobs written before the rename.
  const obj = (k: string): Record<string, unknown> =>
    (r[k] && typeof r[k] === "object" ? r[k] : {}) as Record<string, unknown>;
  const str = (v: unknown, fb: string): string =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : fb;
  const perp = (v: unknown, fb: string): string => {
    const s = typeof v === "string" ? v.trim() : "";
    return (PERPLEXITY_OPTIONS as readonly string[]).includes(s) ? s : fb;
  };
  const d = DEFAULT_MODELS_CONFIG;
  return {
    v: 1,
    supabase: { model: str(obj("supabase").model, d.supabase.model) },
    enricher: {
      model: str(obj("enricher").model, d.enricher.model),
      perplexity: perp(obj("enricher").perplexity, d.enricher.perplexity),
    },
    // Both spellings — a blob written before MESITA-1216 still says `lineup`,
    // and dropping it here would show the operator the default model rather
    // than what is actually stored.
    embeddings: {
      model: str(
        obj("embeddings").model ?? obj("lineup").model,
        d.embeddings.model,
      ),
    },
    memo: {
      model: str(obj("memo").model, d.memo.model),
      perplexity: perp(obj("memo").perplexity, d.memo.perplexity),
    },
    ojo: { model: str(obj("ojo").model, d.ojo.model) },
  };
}
