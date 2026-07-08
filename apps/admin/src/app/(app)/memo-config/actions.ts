"use server";

// Server actions for Memo Config. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws) — same contract as the
// Atlas config actions.
//
// NOTE: the backing service (admin-web-get-memo-config / -update-memo-config +
// the memo_config table) ships with the Memo OpenAI rebuild. Until then these
// calls resolve to a clean { ok: false } and the page falls back to local
// defaults + surfaces a "not deployed yet" note. No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";

// The tunable surface an operator edits. Mirrors the knobs Memo actually reads
// at runtime (persona prose, model params, retrieval shape).
export type MemoConfig = {
  greeting: string;
  instructions: string;
  // OpenAI is Memo's brain (intent + orchestration + prose).
  provider: "openai";
  openaiModel: string;
  temperature: number;
  maxTokens: number;
  // Perplexity is the OPTIONAL web-grounding leg (live editorial color +
  // citations). Off by default — Google Places + the catalog do place
  // grounding. When on, Memo calls this Perplexity model for web color.
  webGrounding: boolean;
  perplexityModel: string;
  maxCards: number;
  radiusM: number;
  preferMesita: boolean;
  demoteClosed: boolean;
  updatedAt?: string;
};

// Selectable model ids surfaced in the admin picker (kept here so the page and
// any future EF share one list).
export const OPENAI_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
] as const;

export const PERPLEXITY_MODELS = [
  "sonar",
  "sonar-pro",
  "sonar-reasoning",
  "sonar-reasoning-pro",
] as const;

export type GetMemoConfigResult =
  | { ok: true; data: MemoConfig }
  | { ok: false; error: string };

export async function getMemoConfig(): Promise<GetMemoConfigResult> {
  const r = await efInvoke<MemoConfig>("admin-web-get-memo-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

export type UpdateMemoConfigResult =
  | { ok: true; data: MemoConfig }
  | { ok: false; error: string };

export async function updateMemoConfig(
  patch: Partial<MemoConfig>,
): Promise<UpdateMemoConfigResult> {
  const r = await efInvoke<MemoConfig>("admin-web-update-memo-config", patch);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
