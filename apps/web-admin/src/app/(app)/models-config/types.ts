// Shared Models Config types + catalog. Kept OUT of actions.ts because that
// file is a "use server" module (it may only export async functions to the
// client) and it pulls in efInvoke / next/headers — importing the catalog or
// SUBSYSTEMS from there would hand the client stubs and crash the picker. Same
// footgun the Memo types file documents.
//
// This page is the SoT for app_config.models_config (MESITA-941). Live readers
// (_shared/models-config.ts → get-memo-config, Intaker stages, embeddings,
// business-web-suggest-promo, ojo-engine) bind supabase / enricher.model /
// embeddings / memo.* / ojo.model.
// Intaker Perplexity is NOT read from this blob — app_config's
// atlas_perplexity_preset is the live search preset (enricher.perplexity here
// is staged). The synthesis / vision quality tiers are atlas_* columns too;
// Intake (MESITA-1287) edits those three. This page does not.

import type { LucideIcon } from "lucide-react";
import { Database, Eye, Layers, MessagesSquare, Sparkles } from "lucide-react";

type SubsystemKey = "supabase" | "enricher" | "embeddings" | "memo" | "ojo";

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

// One-line "what is this" per model, shown beside each option in the picker.
// Descriptions are intentionally short; the gpt-5.6 tiers follow OpenAI's own
// framing (Sol = flagship, Terra = balanced, Luna = cost-efficient).
export const OPENAI_MODEL_INFO: Record<string, string> = {
  "gpt-4o-mini": "fast · cheapest — safe default",
  "gpt-4o": "stronger multimodal · pricier",
  "gpt-4.1-mini": "fast · 1M-token context",
  "gpt-4.1": "strong · 1M-token context",
  "gpt-5.6-luna": "most cost-efficient of the 5.6 family",
  "gpt-5.6-terra": "balanced 5.6 — everyday work",
  "gpt-5.6-sol": "flagship 5.6 — most capable",
};

// Perplexity values accepted in the blob's enricher/memo legs ("off" = none).
export const PERPLEXITY_OPTIONS = [
  "off",
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
] as const;

// ── Subsystem map ──────────────────────────────────────────────────────────
// Drives the page. `editableHere` is true for rows this page owns (supabase +
// memo). Intaker / Embeddings stay read-only — their values live in atlas_*
// columns and models_config. Intake edits the atlas_* quality/preset knobs;
// this page does not.
export type ModelStatus = "live" | "staged" | "locked";

// A model shown "up front" on a card — the id (rendered as a mono chip) plus a
// short note on what it is / what it's for.
export type ModelChip = { id: string; note?: string };

type SubsystemMeta = {
  key: SubsystemKey;
  label: string;
  Icon: LucideIcon;
  status: ModelStatus;
  // The model(s) this subsystem uses, shown as chips at the top of the card.
  // Omitted when the card renders live picks from cfg instead.
  models?: ModelChip[];
  // One line of context under the title.
  detail: string;
  editableHere: boolean;
  // Where the model is really controlled (or shown). null → owned here.
  owner: { label: string; href: string } | null;
};

export const SUBSYSTEMS: readonly SubsystemMeta[] = [
  {
    key: "supabase",
    label: "Supabase Edge Functions",
    Icon: Database,
    status: "live",
    detail:
      "General OpenAI default for EFs without their own model (today: business-web-suggest-promo). Read live via models_config.supabase.model (MESITA-941).",
    editableHere: true,
    owner: null,
  },
  {
    key: "enricher",
    label: "Intaker",
    Icon: Sparkles,
    status: "live",
    models: [
      { id: "gpt-4o-mini · gpt-4o", note: "text — by the stored atlas_synthesis_quality" },
      { id: "gpt-4o-mini · gpt-4o", note: "vision — by the stored atlas_vision_quality" },
      {
        id: "atlas_perplexity_preset",
        note: "live search preset — models_config.enricher.perplexity is staged (unread)",
      },
    ],
    detail:
      "OpenAI quality tiers + Perplexity Agent preset are atlas_* columns the Intaker reads live. models_config.enricher.model binds the cheap/default OpenAI id; enricher.perplexity in this blob is staged. Intake edits the three atlas_* knobs.",
    editableHere: false,
    owner: null,
  },
  {
    key: "embeddings",
    label: "Embeddings",
    Icon: Layers,
    status: "locked",
    models: [
      { id: "text-embedding-3-small", note: "1536-d — place ↔ intent · models_config.embeddings.model" },
    ],
    detail:
      "Place vectors behind Memo recall. Fixed by design — changing it re-vectors the whole catalog. Read live as models_config.embeddings.model by _shared/embeddings.ts.",
    editableHere: false,
    owner: null,
  },
  {
    key: "memo",
    label: "Memo",
    Icon: MessagesSquare,
    status: "live",
    detail:
      "Live OpenAI + Perplexity picks for Memo. Served by supabase-edgefunc-get-memo-config from models_config.memo.* (the openai/perplexity fields under Filters › Chat › Memo are legacy fallback / not wired).",
    editableHere: true,
    owner: null,
  },
  {
    key: "ojo",
    label: "Ojo",
    Icon: Eye,
    status: "live",
    detail:
      "Vision model reading a guest's story/review screenshot (MESITA-1034). Defaults to gpt-4o, not the enricher's gpt-4o-mini — Ojo decides whether a guest earns money, not whether a photo is worth ranking. Enabled / threshold / fail-action live on Visits.",
    editableHere: true,
    owner: null,
  },
];

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
  // Keyed by string, not SubsystemKey: the coercer also has to reach the
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
