// Shared Models Config types + catalogs. Kept OUT of actions.ts because that
// file is a "use server" module (it can only export async functions to the
// client) and it pulls in efInvoke / next/headers — importing the catalogs or
// SUBSYSTEMS from there would hand the client stubs and crash the pickers. Same
// footgun the Memo Config types file documents.

import type { LucideIcon } from "lucide-react";
import { Database, Layers, MessagesSquare, Sparkles } from "lucide-react";

export type SubsystemKey = "supabase" | "enricher" | "lineup" | "memo";

// The MAIN model is always OpenAI (a chat model, or an embedding model for
// Lineup). Perplexity is NEVER a main model — it's an optional web-grounding /
// validation leg, and ONLY Enricher and Memo have one ("off" disables it).
export type ModelsConfig = {
  v: number;
  supabase: { model: string };
  enricher: { model: string; perplexity: string };
  lineup: { model: string };
  memo: { model: string; perplexity: string };
};

// ── Model catalogs ─────────────────────────────────────────────────────────
// OpenAI is the main brain everywhere. The gpt-5.6 family (Sol / Terra / Luna —
// GA 2026-07-09) is included; treat those ids as PROVISIONAL until confirmed
// against platform.openai.com when enforcement is wired. Model is stored as a
// free string, so editing these lists never breaks a saved blob.
export const OPENAI_CHAT_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
] as const;

export const OPENAI_EMBEDDING_MODELS = [
  "text-embedding-3-small",
  "text-embedding-3-large",
] as const;

// Perplexity grounding options — Enricher + Memo only. "off" = no grounding leg.
export const PERPLEXITY_OPTIONS = [
  "off",
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
] as const;

export type MainKind = "chat" | "embedding";

/** OpenAI catalog for a subsystem's main model, by kind. */
export function mainModelsFor(kind: MainKind): readonly string[] {
  return kind === "embedding" ? OPENAI_EMBEDDING_MODELS : OPENAI_CHAT_MODELS;
}

// ── Subsystem descriptors ──────────────────────────────────────────────────
// Drives the page: one card per entry. Only Enricher + Memo expose a Perplexity
// leg — Supabase + Lineup are OpenAI-only.
export type SubsystemMeta = {
  key: SubsystemKey;
  label: string;
  subtitle: string;
  mainKind: MainKind;
  hasPerplexity: boolean;
  Icon: LucideIcon;
};

export const SUBSYSTEMS: readonly SubsystemMeta[] = [
  {
    key: "supabase",
    label: "Supabase Edge Functions",
    subtitle:
      "General default OpenAI model for Edge Functions that call an LLM without a more specific override.",
    mainKind: "chat",
    hasPerplexity: false,
    Icon: Database,
  },
  {
    key: "enricher",
    label: "Enricher",
    subtitle:
      "The place-intelligence pipeline (Atlas / Enricher). OpenAI is the main model; Perplexity is its optional web-grounding / validation leg.",
    mainKind: "chat",
    hasPerplexity: true,
    Icon: Sparkles,
  },
  {
    key: "lineup",
    label: "Lineup",
    subtitle:
      "The recommendation engine's embedding model for place embeddings. OpenAI embeddings only.",
    mainKind: "embedding",
    hasPerplexity: false,
    Icon: Layers,
  },
  {
    key: "memo",
    label: "Memo",
    subtitle:
      "The consumer AI concierge (consumer-web-ask-memo). OpenAI is its brain; Perplexity is an optional web-grounding leg. Overlaps the Memo Config model knob — centralised here going forward.",
    mainKind: "chat",
    hasPerplexity: true,
    Icon: MessagesSquare,
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
