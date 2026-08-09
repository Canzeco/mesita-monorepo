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
  // Staged — memo_provider is unread (serving path is OpenAI-fixed).
  provider: "openai";
  // Legacy fallback behind models_config.memo.model (Models Config).
  openaiModel: string;
  // Staged — memo_web_grounding unread; Perplexity is bound via
  // models_config.memo.perplexity, not this switch.
  webGrounding: boolean;
  // Staged — live pick is models_config.memo.perplexity (Models Config).
  perplexityModel: string;
  updatedAt?: string;
};

/** Pre-load / failed-load placeholder — never Save this over a failed GET (MESITA-737). */
export const DEFAULT_MEMO_CONFIG: MemoConfig = {
  // Staged only — consumers hardcode the Ask AI opener in ask-ai-thread.ts
  // (web + mobile). Keep this aligned with that constant for operator honesty;
  // changing it here does not change what users see until consumers are wired.
  greeting:
    "Hola, soy Don Memo, la IA de Mesita. Dime qué se te antoja — prueba “rooftop date tonight” o “tacos al pastor”.",
  instructions:
    "You are Memo, Mesita's warm, sharp local concierge for dining, nightlife, cafés, and experiences — deep taste for Monterrey, able to help anywhere. Reply in the user's language, plain text, 2–4 sentences, opinionated and specific. Be time-aware: prefer spots open and appropriate for the local hour. When the user is place-seeking, name the real places on the shortlist; for general questions just answer conversationally.",
  // Staged — no serving path branches on memo_provider today (OpenAI is fixed).
  provider: "openai",
  openaiModel: "gpt-4o-mini",
  // Staged — Perplexity is not optional on the serving path.
  webGrounding: false,
  // Staged — live pick is models_config.memo.perplexity (Models Config).
  perplexityModel: "sonar-pro",
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

// ── Playground ────────────────────────────────────────────────────────────
// The concierge's place suggestion. Mirrors the Prediction contract returned by
// consumer-web-ask-memo (see its memo-google-text-search.ts) — the Playground
// only renders a subset.
type MemoPredictionStatus =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

export type MemoPrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: MemoPredictionStatus;
  rating?: number | null;
  ratingCount?: number | null;
  openNow?: boolean | null;
};

// ── Playground · reasoning trace ────────────────────────────────────────
// Mirrors _shared/memo-trace.ts (the admin-web-ask-memo engine emits this).
// It surfaces Memo's internal process — the RAG-first Lineup recall, each
// OpenAI reasoning round, and every tool call (Lineup / Perplexity / catalog).
export type TraceSource =
  | "OpenAI"
  | "Lineup engine"
  | "Perplexity (web)"
  | "Mesita catalog";

export type TraceStep =
  | {
      kind: "recall";
      title: string;
      source: "Lineup engine";
      intent: string;
      poolSize: number;
      embedded: boolean;
      cards: { name: string; rating: number | null }[];
      ms: number;
    }
  | {
      kind: "model";
      title: string;
      source: "OpenAI";
      model: string;
      step: number;
      toolsOffered: boolean;
      thought: string | null;
      toolCalls: { name: string; args: Record<string, unknown> }[];
      ms: number;
    }
  | {
      kind: "tool";
      title: string;
      source: TraceSource;
      tool: string;
      args: Record<string, unknown>;
      summary: string;
      predictions: number;
      citations: number;
      ms: number;
    };

// What the run resolved to — echoed back so the operator sees exactly what ran.
export type AskMemoMeta = {
  engine: string;
  model: string;
  personaSource: "saved" | "override";
  profile: "consumer" | "mock" | "guest";
  hiddenContext: string | null;
};

// Result of one Memo turn from the Playground (admin-web-ask-memo).
export type AskMemoResult =
  | {
      ok: true;
      answer: string;
      predictions: MemoPrediction[];
      related: string[];
      citations: string[];
      trace: TraceStep[];
      meta?: AskMemoMeta;
    }
  | { ok: false; error: string };

// ── Playground · session ────────────────────────────────────────────────
// A real consumer sampled from the DB (admin-web-get-scoring-sample) for the
// "talk as a real user" picker. First name only + coarse demographics — the
// same signals Memo itself reasons over.
export type SampleConsumer = {
  id: string;
  label: string | null;
  sex: string | null;
  age: number | null;
  class_key: string;
  instagram_followers: number | null;
  country: string | null;
  saved_taste: string[];
  visited_taste: string[];
};

export type SampleConsumersResult =
  | { ok: true; consumers: SampleConsumer[] }
  | { ok: false; error: string };

// Who Memo thinks it's talking to this session.
export type PersonaMode = "consumer" | "mock" | "guest";

// A location preset — Memo is location-first, so every session picks a metro.
type LocationPreset = {
  key: string;
  label: string;
  lat: number | null;
  lng: number | null;
};

export const LOCATION_PRESETS: readonly LocationPreset[] = [
  { key: "mty", label: "Monterrey", lat: 25.6866, lng: -100.3161 },
  { key: "gdl", label: "Guadalajara", lat: 20.6597, lng: -103.3496 },
  { key: "cdmx", label: "Mexico City", lat: 19.4326, lng: -99.1332 },
  { key: "cun", label: "Cancún", lat: 21.1619, lng: -86.8515 },
  { key: "none", label: "No location", lat: null, lng: null },
] as const;

// One message in the playground chat thread.
type ChatRole = "user" | "assistant";
export type MemoTurn = {
  role: ChatRole;
  content: string;
  // Assistant-only extras (present on Memo's turns).
  predictions?: MemoPrediction[];
  related?: string[];
  citations?: string[];
  trace?: TraceStep[];
  meta?: AskMemoMeta;
  // Set when this turn is Memo's opening greeting (no trace to show).
  greeting?: boolean;
  // Set when the turn failed (renders as an error note in place of a reply).
  error?: string;
};
