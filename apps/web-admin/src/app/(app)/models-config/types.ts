// Shared Models Config types, catalogs and pure helpers. Kept OUT of actions.ts
// because that file is a "use server" module (it may only export async
// functions to the client) and it pulls in efInvoke / next/headers — importing
// the catalog or defaults from there would hand the client stubs and crash the
// picker. Same footgun the Memo types file documents.
//
// The page edits two stores (MESITA-2126 remake):
//   app_config.models_config      memo.model (Discovery chat).
//                                 Read by supabase-edgefunc-get-memo-config.
//   app_config.enrichment_config  atlasSynthesisQuality · atlasVisionQuality ·
//                                 atlasPerplexityPreset (the Enricher). Saved as a
//                                 PATCH through the enricher section.
// Shown read-only: embeddings.model (place search index) and enricher.model
// (the Enricher's sorting/tagging model, and what the photos row's cheaper
// tier runs — enricher-cron-enrich-place-analysis swaps it in for economy).
// Not shown and DEAD in First Stage: supabase.model, ojo.model and
// enricher.perplexity. models_config is still saved WHOLE, so they are written
// back as their coerced values; coercion also drops unknown keys (a stored
// memo.perplexity among them — Memo has no Perplexity leg, MESITA-2136) and
// resets a Perplexity value outside PERPLEXITY_OPTIONS to its default.
// MESITA-2091 owns deleting the dead keys.

import type { PerplexityPreset } from "../enricher-config/actions";
import { COST_RATES } from "../enricher-config/cost-model";
import {
  ENRICHER_TIER_MODELS,
  type SynthesisQuality,
} from "@/lib/synthesis-quality";

/** Live Enricher model picks — stored on enrichment_config, edited on this page. */
export type EnricherModelSettings = {
  synthesisQuality: SynthesisQuality;
  visionQuality: SynthesisQuality;
  perplexityPreset: PerplexityPreset;
};

/** Enricher web search presets (Perplexity Agents API), labelled in plain words. */
export const ENRICHER_PERPLEXITY_PRESETS: readonly {
  value: PerplexityPreset;
  label: string;
}[] = [
  { value: "fast-search", label: "fast-search · fastest" },
  { value: "pro-search", label: "pro-search · standard" },
  { value: "deep-research", label: "deep-research · slow, costs more" },
  { value: "advanced-deep-research", label: "advanced-deep-research · slowest, costs most" },
];

// The persisted blob (app_config.models_config). See the header for which
// keys are live.
export type ModelsConfig = {
  v: number;
  supabase: { model: string };
  enricher: { model: string; perplexity: string };
  embeddings: { model: string };
  memo: { model: string };
  ojo: { model: string };
};

// OpenAI chat catalog for the Discovery chat model.
// The gpt-5.6 family (Sol / Terra / Luna — GA 2026-07-09) is included; treat
// those ids as PROVISIONAL until confirmed against platform.openai.com. Model is
// stored as a free string, so a stored id off this list is shown as current
// rather than silently replaced.
export const OPENAI_CHAT_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
] as const;

// Perplexity values accepted in the blob's enricher leg ("off" = none).
const PERPLEXITY_OPTIONS = [
  "off",
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
] as const;

// Defaults — mirror the migration's app_config.models_config seed. The server
// coerces a null/partial blob to them; the page never SHOWS them as live.
export const DEFAULT_MODELS_CONFIG: ModelsConfig = {
  v: 1,
  supabase: { model: "gpt-4o-mini" },
  enricher: { model: "gpt-4o-mini", perplexity: "sonar-pro" },
  embeddings: { model: "text-embedding-3-small" },
  memo: { model: "gpt-4o-mini" },
  ojo: { model: "gpt-4o" },
};

/** Merge a null / partial / untrusted blob into a complete, valid config. */
export function coerceModelsConfig(raw: unknown): ModelsConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
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
    embeddings: { model: str(obj("embeddings").model, d.embeddings.model) },
    memo: { model: str(obj("memo").model, d.memo.model) },
    ojo: { model: str(obj("ojo").model, d.ojo.model) },
  };
}

/** The only edit this page makes to models_config: Memo's model. Every other key stays byte-equal. */
export function withMemo(
  cfg: ModelsConfig,
  patch: Partial<ModelsConfig["memo"]>,
): ModelsConfig {
  return { ...cfg, memo: { ...cfg.memo, ...patch } };
}

export function memoDirty(saved: ModelsConfig, next: ModelsConfig): boolean {
  return saved.memo.model !== next.memo.model;
}

/** The enricher fields that changed — the PATCH this page sends, nothing else. */
export function changedEnricherFields(
  saved: EnricherModelSettings,
  next: EnricherModelSettings,
): Partial<EnricherModelSettings> {
  const patch: Partial<EnricherModelSettings> = {};
  if (saved.synthesisQuality !== next.synthesisQuality) {
    patch.synthesisQuality = next.synthesisQuality;
  }
  if (saved.visionQuality !== next.visionQuality) {
    patch.visionQuality = next.visionQuality;
  }
  if (saved.perplexityPreset !== next.perplexityPreset) {
    patch.perplexityPreset = next.perplexityPreset;
  }
  return patch;
}

// What each tier costs, from Creation's cost model (one rate card, not two).
const TIER_PRICE: Record<"writing" | "photos", Record<SynthesisQuality, string>> = {
  writing: {
    economy: `~$${COST_RATES.synthEconomy} per place`,
    standard: `~$${COST_RATES.synthStandard} per place`,
  },
  photos: {
    economy: `~$${COST_RATES.visionEconomy} per photo`,
    standard: `~$${COST_RATES.visionStandard} per photo`,
  },
};

export type TierChoice =
  | { kind: "choice"; options: { tier: SynthesisQuality; label: string }[] }
  | { kind: "same"; model: string };

/**
 * The two options a tier row offers, named by the model each one runs.
 * Writing's cheaper tier is the pinned ENRICHER_TIER_MODELS constant; photos'
 * cheaper tier is the LIVE enricher.model, because the analysis cron swaps it
 * in for economy. If both options would run the same model there is nothing to
 * choose, and saying "cheaper" would be a lie — so the row says so instead.
 */
export function tierChoice(
  row: "writing" | "photos",
  enricherModel: string,
): TierChoice {
  const economyModel =
    row === "photos" ? enricherModel : ENRICHER_TIER_MODELS.economy;
  const standardModel = ENRICHER_TIER_MODELS.standard;
  if (economyModel === standardModel) return { kind: "same", model: standardModel };
  // The rate card prices the default cheap model; a swapped-in sorting model
  // gets no price rather than a borrowed one.
  const economyLabel =
    economyModel === ENRICHER_TIER_MODELS.economy
      ? `${economyModel} · ${TIER_PRICE[row].economy}`
      : economyModel;
  return {
    kind: "choice",
    options: [
      { tier: "economy", label: economyLabel },
      { tier: "standard", label: `${standardModel} · ${TIER_PRICE[row].standard}` },
    ],
  };
}

/** Roving-focus step for a radiogroup: the option index a key moves to, or null. */
export function nextRadioIndex(key: string, i: number, n: number): number | null {
  if (n <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (i + 1) % n;
    case "ArrowLeft":
    case "ArrowUp":
      return (i - 1 + n) % n;
    case "Home":
      return 0;
    case "End":
      return n - 1;
    default:
      return null;
  }
}

type Saved<T> = { ok: true; data: T } | { ok: false; error: string };

export type SaveOutcome = {
  savedModels: ModelsConfig;
  savedEnricher: EnricherModelSettings;
  modelsSaved: boolean;
  enricherSaved: boolean;
  modelsError: string | null;
  enricherError: string | null;
};

/**
 * Save what changed, in two independent halves: Memo's model (models_config,
 * whole blob) then the Enricher's (enrichment_config, PATCH of changed fields).
 * A failure in one half never stops the other, and a half that saved keeps its
 * new baseline either way.
 */
export async function runSave(
  state: {
    savedModels: ModelsConfig;
    nextModels: ModelsConfig;
    savedEnricher: EnricherModelSettings;
    nextEnricher: EnricherModelSettings;
  },
  io: {
    updateModels: (cfg: ModelsConfig) => Promise<Saved<ModelsConfig>>;
    updateEnricher: (
      patch: Partial<EnricherModelSettings>,
    ) => Promise<Saved<EnricherModelSettings>>;
  },
): Promise<SaveOutcome> {
  const out: SaveOutcome = {
    savedModels: state.savedModels,
    savedEnricher: state.savedEnricher,
    modelsSaved: false,
    enricherSaved: false,
    modelsError: null,
    enricherError: null,
  };
  if (memoDirty(state.savedModels, state.nextModels)) {
    const r = await io.updateModels(state.nextModels);
    if (r.ok) {
      out.savedModels = r.data;
      out.modelsSaved = true;
    } else {
      out.modelsError = r.error;
    }
  }
  const patch = changedEnricherFields(state.savedEnricher, state.nextEnricher);
  if (Object.keys(patch).length > 0) {
    const r = await io.updateEnricher(patch);
    if (r.ok) {
      out.savedEnricher = r.data;
      out.enricherSaved = true;
    } else {
      out.enricherError = r.error;
    }
  }
  return out;
}
