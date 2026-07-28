// Shared Models Config types + catalog. Kept OUT of actions.ts because that
// file is a "use server" module (it may only export async functions to the
// client) and it pulls in efInvoke / next/headers — importing the catalog or
// SUBSYSTEMS from there would hand the client stubs and crash the picker. Same
// footgun the Memo Config types file documents.
//
// This page is a MODEL MAP, not a second control panel. Almost every subsystem
// already chooses its model on its own page (Enricher Config, Memo Config), and
// those knobs are richer + live. The only thing this page owns is the Supabase
// Edge Functions general default — every other row is read-only and links to
// the page that actually controls it. See SUBSYSTEMS below for the ownership.

import type { LucideIcon } from "lucide-react";
import { Database, Layers, MessagesSquare, Sparkles } from "lucide-react";

export type SubsystemKey = "supabase" | "enricher" | "lineup" | "memo";

// The persisted blob (app_settings.models_config). Only `supabase.model` is
// edited on this page today; the enricher/lineup/memo entries are retained in
// the shape (the EF contract) but are informational — their real, live model
// settings live on their own pages. STAGED: nothing reads the blob yet.
export type ModelsConfig = {
  v: number;
  supabase: { model: string };
  enricher: { model: string; perplexity: string };
  lineup: { model: string };
  memo: { model: string; perplexity: string };
};

// OpenAI chat catalog for the one editable knob (the Supabase general default).
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
// Kept for the EF contract + coercion; the page no longer edits them (Enricher
// Config / Memo Config own those legs).
const PERPLEXITY_OPTIONS = [
  "off",
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
] as const;

// ── Subsystem map ──────────────────────────────────────────────────────────
// Drives the page. `editableHere` is true for exactly one row (Supabase); every
// other row shows its status + a link to the page that actually owns the model.
export type ModelStatus = "live" | "staged" | "locked";

// A model shown "up front" on a card — the id (rendered as a mono chip) plus a
// short note on what it is / what it's for.
export type ModelChip = { id: string; note?: string };

export type SubsystemMeta = {
  key: SubsystemKey;
  label: string;
  Icon: LucideIcon;
  status: ModelStatus;
  // The model(s) this subsystem uses, shown as chips at the top of the card.
  // Omitted for the editable Supabase row — it renders its selected model live.
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
    status: "staged",
    detail:
      "General default for Edge Functions that call an LLM without a model of their own. The only knob this page owns — nothing reads it yet.",
    editableHere: true,
    owner: null,
  },
  {
    key: "enricher",
    label: "Enricher",
    Icon: Sparkles,
    status: "live",
    models: [
      { id: "gpt-4o-mini · gpt-4o", note: "text — by synthesis quality" },
      { id: "gpt-4o", note: "vision" },
      { id: "perplexity", note: "web search preset" },
    ],
    detail: "Set on, and read live by, Enricher Config.",
    editableHere: false,
    owner: { label: "Enricher Config", href: "/enricher-config" },
  },
  {
    key: "lineup",
    label: "Lineup",
    Icon: Layers,
    status: "locked",
    models: [
      { id: "text-embedding-3-small", note: "1536-d — place ↔ intent" },
    ],
    detail:
      "Fixed by design — changing it re-vectors the whole catalog. Shown read-only on Enricher Config.",
    editableHere: false,
    owner: { label: "Enricher Config", href: "/enricher-config" },
  },
  {
    key: "memo",
    label: "Memo",
    Icon: MessagesSquare,
    status: "staged",
    models: [
      { id: "gpt-4o-mini", note: "OpenAI brain" },
      { id: "sonar-pro", note: "Perplexity grounding — optional" },
    ],
    detail:
      "Model knob owned by Memo Config (also staged — Memo's instructions run live).",
    editableHere: false,
    owner: { label: "Memo Config", href: "/memo-config" },
  },
];

// Defaults — mirror the migration's app_settings.models_config seed. The client
// shows these before load; the server coerces a null/partial blob to them.
export const DEFAULT_MODELS_CONFIG: ModelsConfig = {
  v: 1,
  supabase: { model: "gpt-4o-mini" },
  enricher: { model: "gpt-4o-mini", perplexity: "sonar-pro" },
  lineup: { model: "text-embedding-3-small" },
  memo: { model: "gpt-4o-mini", perplexity: "sonar-pro" },
};

/** Merge a null / partial / untrusted blob into a complete, valid config. */
export function coerceModelsConfig(raw: unknown): ModelsConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const obj = (k: SubsystemKey): Record<string, unknown> =>
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
    lineup: { model: str(obj("lineup").model, d.lineup.model) },
    memo: {
      model: str(obj("memo").model, d.memo.model),
      perplexity: perp(obj("memo").perplexity, d.memo.perplexity),
    },
  };
}
