// memo-trace.ts — an OPTIONAL, admin-only trace of Memo's reasoning process.
//
// When a `trace` sink is attached to the AirlockContext, the agent records each
// step it takes: the RAG-first Lineup recall, every OpenAI reasoning round (the
// model's thought + which tools it chose to call), and every tool dispatch
// (which source it hit — the Lineup engine, Perplexity, or the Mesita catalog —
// with args and a public-safe result summary).
//
// This powers the admin Memo Playground's "how Memo thought" inspector. It is
// NEVER attached on the consumer path (the trace field is simply absent), so
// the live concierge is byte-for-byte unchanged and pays zero overhead.

// The upstream source a step read from — the label the playground shows.
export type TraceSource =
  | "OpenAI"
  | "Lineup engine"
  | "Perplexity (web)"
  | "Mesita catalog";

export type TraceStep =
  // The RAG-first seed: recall Mesita candidates before the model's first turn.
  | {
    kind: "recall";
    title: string;
    source: "Lineup engine";
    intent: string;
    poolSize: number; // candidates recalled near the caller before ranking
    embedded: boolean; // did we embed the intent + cosine-rank the pool?
    cards: { name: string; rating: number | null }[];
    ms: number;
  }
  // One OpenAI reasoning round: the model's plan + the tools it decided to call.
  | {
    kind: "model";
    title: string;
    source: "OpenAI";
    model: string;
    step: number; // 0-based round index
    toolsOffered: boolean; // were tools available this round?
    thought: string | null; // the model's planning text (null on the answering round)
    toolCalls: { name: string; args: Record<string, unknown> }[];
    ms: number;
  }
  // One airlock tool dispatch: which source, the args, and a public-safe summary.
  | {
    kind: "tool";
    title: string;
    source: TraceSource;
    tool: string; // the airlock tool name
    args: Record<string, unknown>;
    summary: string; // public-safe result text (truncated)
    predictions: number; // # place cards this tool surfaced
    citations: number; // # web citations this tool surfaced
    ms: number;
  };

// The sink the caller owns and reads back. A plain array kept mutation-simple.
export type TraceSink = TraceStep[];

// The source a given airlock tool reads from — used to label tool steps.
export function toolSource(tool: string): TraceSource {
  switch (tool) {
    case "lineup_recommend":
      return "Lineup engine";
    case "web_search":
      return "Perplexity (web)";
    case "place_facts":
      return "Mesita catalog";
    default:
      return "Mesita catalog";
  }
}

const SUMMARY_MAX = 600;

// Truncate a tool's result text for the trace summary (the model sees the full
// text; the inspector shows a bounded slice).
export function clampSummary(s: string): string {
  const t = (s ?? "").trim();
  return t.length > SUMMARY_MAX ? `${t.slice(0, SUMMARY_MAX)}…` : t;
}
