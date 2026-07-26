// Shared Models Config types + catalogs. Kept OUT of actions.ts because that
// file is a "use server" module (it can only export async functions to the
// client) and it pulls in efInvoke / next/headers — importing the catalogs or
// SUBSYSTEMS from there would hand the client stubs and crash the pickers. Same
// footgun the Memo Config types file documents.

import type { LucideIcon } from "lucide-react";
import { Database, Layers, MessagesSquare, Sparkles } from "lucide-react";

export type ModelProvider = "openai" | "perplexity";
export type ModelKind = "chat" | "embedding";

export type SubsystemModel = { provider: ModelProvider; model: string };

export type SubsystemKey = "supabase" | "enricher" | "lineup" | "memo";

// The persisted blob (app_settings.models_config). One { provider, model } per
// subsystem. STAGED today — see the migration + EF headers: the page
// round-trips the blob; the subsystems are pointed at it in a follow-up.
export type ModelsConfig = {
  v: number;
  supabase: SubsystemModel;
  enricher: SubsystemModel;
  lineup: SubsystemModel;
  memo: SubsystemModel;
};

// ── Model catalogs ─────────────────────────────────────────────────────────
// Selectable model ids per provider, surfaced in the pickers. The gpt-5.6 family
// (Sol / Terra / Luna — GA 2026-07-09) is included; treat those ids as
// PROVISIONAL until confirmed against platform.openai.com when enforcement is
// wired. Model is stored as a free string, so editing this list never breaks a
// saved blob.
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

export const PERPLEXITY_MODELS = [
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
] as const;

export const PROVIDER_LABEL: Record<ModelProvider, string> = {
  openai: "OpenAI",
  perplexity: "Perplexity",
};

/** Model options for a subsystem, given its selected provider + kind. */
export function modelsFor(
  provider: ModelProvider,
  kind: ModelKind,
): readonly string[] {
  if (kind === "embedding") return OPENAI_EMBEDDING_MODELS; // OpenAI only
  return provider === "openai" ? OPENAI_CHAT_MODELS : PERPLEXITY_MODELS;
}

// ── Subsystem descriptors ──────────────────────────────────────────────────
// Drives the page: one card per entry, rendering provider-appropriate options.
export type SubsystemMeta = {
  key: SubsystemKey;
  label: string;
  subtitle: string;
  kind: ModelKind;
  providers: readonly ModelProvider[];
  Icon: LucideIcon;
};

export const SUBSYSTEMS: readonly SubsystemMeta[] = [
  {
    key: "supabase",
    label: "Supabase Edge Functions",
    subtitle:
      "The general default model for Edge Functions that call an LLM and don't have a more specific override.",
    kind: "chat",
    providers: ["openai", "perplexity"],
    Icon: Database,
  },
  {
    key: "enricher",
    label: "Enricher",
    subtitle:
      "The place-intelligence pipeline (Atlas / Enricher) — its web validation + extraction leg. Perplexity sonar-pro today.",
    kind: "chat",
    providers: ["openai", "perplexity"],
    Icon: Sparkles,
  },
  {
    key: "lineup",
    label: "Lineup",
    subtitle:
      "The recommendation engine's embedding model for place embeddings. OpenAI embeddings only.",
    kind: "embedding",
    providers: ["openai"],
    Icon: Layers,
  },
  {
    key: "memo",
    label: "Memo",
    subtitle:
      "The consumer AI concierge (consumer-web-ask-memo). Overlaps the Memo Config model knob — centralised here going forward.",
    kind: "chat",
    providers: ["openai", "perplexity"],
    Icon: MessagesSquare,
  },
];

// Defaults — mirror the migration's app_settings.models_config seed. The client
// shows these before load; the server coerces a null/partial blob to them.
export const DEFAULT_MODELS_CONFIG: ModelsConfig = {
  v: 1,
  supabase: { provider: "openai", model: "gpt-4o-mini" },
  enricher: { provider: "perplexity", model: "sonar-pro" },
  lineup: { provider: "openai", model: "text-embedding-3-small" },
  memo: { provider: "openai", model: "gpt-4o-mini" },
};

/** Merge a null / partial / untrusted blob into a complete, valid config. */
export function coerceModelsConfig(raw: unknown): ModelsConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const byKey = Object.fromEntries(
    SUBSYSTEMS.map((s) => [s.key, s]),
  ) as Record<SubsystemKey, SubsystemMeta>;

  const pick = (key: SubsystemKey): SubsystemModel => {
    const meta = byKey[key];
    const fb = DEFAULT_MODELS_CONFIG[key];
    const o = (r[key] && typeof r[key] === "object"
      ? r[key]
      : {}) as Record<string, unknown>;
    const provider = meta.providers.includes(o.provider as ModelProvider)
      ? (o.provider as ModelProvider)
      : fb.provider;
    const model =
      typeof o.model === "string" && o.model.trim().length > 0
        ? o.model.trim()
        : fb.model;
    return { provider, model };
  };

  return {
    v: 1,
    supabase: pick("supabase"),
    enricher: pick("enricher"),
    lineup: pick("lineup"),
    memo: pick("memo"),
  };
}
