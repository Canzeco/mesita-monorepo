// Shared Memo Config types + model catalogs. Kept OUT of actions.ts because
// that file is a "use server" module — Next only exposes async functions from
// it to the client, so importing OPENAI_MODELS / PERPLEXITY_MODELS from there
// handed the client stubs and crashed Select's options.map (TypeError:
// c.map is not a function on /memo-config).

// The tunable surface an operator edits. Mirrors the knobs Memo actually reads
// at runtime (persona prose, model params, retrieval shape).
export type MemoConfig = {
  greeting: string;
  instructions: string;
  // OpenAI is Memo's brain (intent + orchestration + prose).
  provider: "openai";
  openaiModel: string;
  // Perplexity is the OPTIONAL web-grounding leg (live editorial color +
  // citations). Off by default — Google Places + the catalog do place
  // grounding. When on, Memo calls this Perplexity model for web color.
  webGrounding: boolean;
  perplexityModel: string;
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
