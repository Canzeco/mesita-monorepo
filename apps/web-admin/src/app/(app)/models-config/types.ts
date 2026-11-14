// Shared Models Config types, catalogs and pure helpers. Kept OUT of actions.ts
// because that file is a "use server" module (it may only export async
// functions to the client) and it pulls in efInvoke / next/headers — importing
// the catalog or defaults from there would hand the client stubs and crash the
// picker. Same footgun the Memo types file documents.
//
// The page edits two stores (MESITA-2126 remake):
//   app_config.models_config      memo.model (Discovery chat).
//                                 Read by supabase-edgefunc-get-memo-config.
//   app_config.enrichment_config  enrichSynthesisQuality · enrichVisionQuality ·
//                                 enrichPerplexityPreset (the Enricher). Saved as a
//                                 PATCH through the enricher section.
// Shown read-only: embeddings.model (place search index) and enricher.model
// (the Enricher's sorting/tagging model, and what the photos row's cheaper
// tier runs — enricher-cron-enrich-place-analysis swaps it in for economy).
// models_config is saved WHOLE, as exactly these three models plus `v`.
// Coercion drops every other key, so the dead supabase.model, ojo.model,
// enricher.perplexity and memo.perplexity a stored blob may still carry are
// never sent back (MESITA-2136, MESITA-2144).

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
  enricher: { model: string };
  embeddings: { model: string };
  memo: { model: string };
};

// OpenAI chat catalog for the Discovery chat model. Model is stored as a free
// string, so a stored id off this list is shown as current rather than
// silently replaced.
// MESITA-3945 (Pato: "super cheap … efficient"; developers.openai.com pricing
// and deprecations, 2026-11-14): only cheap models, cheapest-first after the
// current default. gpt-4o-mini and gpt-4o shut down 2027-01-14 (replacement
// gpt-6-luna); gpt-5.4-nano on 2027-04-01. Per 1M tokens in / out:
//   gpt-6-luna $0.10 / $0.50 · gpt-4o-mini $0.15 / $0.60
//   gpt-5.6-luna $0.20 / $1.20 · gpt-5.4-nano $0.20 / $1.25
export const OPENAI_CHAT_MODELS = [
  "gpt-4o-mini",
  "gpt-6-luna",
  "gpt-5.6-luna",
  "gpt-5.4-nano",
] as const;

// Defaults — mirror the migration's app_config.models_config seed. The server
// coerces a null/partial blob to them; the page never SHOWS them as live.
export const DEFAULT_MODELS_CONFIG: ModelsConfig = {
  v: 1,
  enricher: { model: "gpt-4o-mini" },
  embeddings: { model: "text-embedding-3-small" },
  memo: { model: "gpt-4o-mini" },
};

/** Merge a null / partial / untrusted blob into a complete, valid config. */
export function coerceModelsConfig(raw: unknown): ModelsConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const obj = (k: string): Record<string, unknown> =>
    (r[k] && typeof r[k] === "object" ? r[k] : {}) as Record<string, unknown>;
  const str = (v: unknown, fb: string): string =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : fb;
  const d = DEFAULT_MODELS_CONFIG;
  return {
    v: 1,
    enricher: { model: str(obj("enricher").model, d.enricher.model) },
    embeddings: { model: str(obj("embeddings").model, d.embeddings.model) },
    memo: { model: str(obj("memo").model, d.memo.model) },
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
    efficient: `~$${COST_RATES.synthEfficient} per place`,
    economy: `~$${COST_RATES.synthEconomy} per place`,
    standard: `~$${COST_RATES.synthStandard} per place`,
  },
  photos: {
    efficient: `~$${COST_RATES.visionEfficient} per photo`,
    economy: `~$${COST_RATES.visionEconomy} per photo`,
    standard: `~$${COST_RATES.visionStandard} per photo`,
  },
};

export type TierChoice =
  | { kind: "choice"; options: { tier: SynthesisQuality; label: string }[] }
  | { kind: "same"; model: string };

/**
 * The options a tier row offers (efficient, economy, standard; MESITA-3945),
 * named by the model each one runs.
 * Writing's cheaper tier is the pinned ENRICHER_TIER_MODELS constant; photos'
 * cheaper tier is the LIVE enricher.model, because the analysis cron swaps it
 * in for economy. If both options would run the same model there is nothing to
 * choose, and saying "cheaper" would be a lie — so the row says so instead.
 */
export function tierChoice(
  row: "writing" | "photos",
  enricherModel: string,
): TierChoice {
  const efficientModel = ENRICHER_TIER_MODELS.efficient;
  const economyModel =
    row === "photos" ? enricherModel : ENRICHER_TIER_MODELS.economy;
  const standardModel = ENRICHER_TIER_MODELS.standard;
  // The rate card prices the default cheap model; a swapped-in sorting model
  // gets no price rather than a borrowed one.
  const economyLabel =
    economyModel === ENRICHER_TIER_MODELS.economy
      ? `${economyModel} · ${TIER_PRICE[row].economy}`
      : economyModel;
  const all: { tier: SynthesisQuality; model: string; label: string }[] = [
    { tier: "efficient", model: efficientModel, label: `${efficientModel} · ${TIER_PRICE[row].efficient}` },
    { tier: "economy", model: economyModel, label: economyLabel },
    { tier: "standard", model: standardModel, label: `${standardModel} · ${TIER_PRICE[row].standard}` },
  ];
  // Two tiers running one model are one choice: keep the first of each model.
  const seen = new Set<string>();
  const options = all.filter((o) => (seen.has(o.model) ? false : (seen.add(o.model), true)));
  if (options.length === 1) return { kind: "same", model: options[0].model };
  return { kind: "choice", options: options.map(({ tier, label }) => ({ tier, label })) };
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
