// Shared Memo Config types + model catalogs. Kept OUT of actions.ts because
// that file is a "use server" module — Next only exposes async functions from
// it to the client, so importing OPENAI_MODELS / PERPLEXITY_MODELS from there
// handed the client stubs and crashed Select's options.map (TypeError:
// c.map is not a function on /memo-config).

// The tunable surface an operator edits. Only `instructions` (memo_instructions)
// is read at runtime today — consumer-web-ask-memo takes it as its system
// prompt. The other five knobs are persisted and staged for the forthcoming
// Memo model rebuild; nothing reads them yet.
export type MemoConfig = {
  greeting: string;
  instructions: string;
  // OpenAI is Memo's brain (intent + orchestration + prose).
  provider: "openai";
  openaiModel: OpenaiModel;
  // Perplexity is the OPTIONAL web-grounding leg (live editorial color +
  // citations). Off by default — Google Places + the catalog do place
  // grounding. When on, Memo calls this Perplexity model for web color.
  webGrounding: boolean;
  perplexityModel: PerplexityModel;
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

export type OpenaiModel = (typeof OPENAI_MODELS)[number];
export type PerplexityModel = (typeof PERPLEXITY_MODELS)[number];

// The pre-load placeholder the page falls back to when the config read fails.
// These are NOT what's live — the EF's stored memo_* values are.
export const MEMO_DEFAULTS: MemoConfig = {
  greeting:
    "Hola ✨ I'm Memo, your Mesita concierge. Tell me what you're craving — try “rooftop date tonight under $$$” or just “tacos al pastor”.",
  instructions:
    "You are Memo, Mesita's warm, sharp local concierge for dining, nightlife, cafés, and experiences — deep taste for Monterrey, able to help anywhere. Reply in the user's language, plain text, 2–4 sentences, opinionated and specific. Be time-aware: prefer spots open and appropriate for the local hour. When the user is place-seeking, name the real places on the shortlist; for general questions just answer conversationally.",
  provider: "openai",
  openaiModel: "gpt-4o-mini",
  webGrounding: false,
  perplexityModel: "sonar-pro",
};
