// memo-trace.ts — an OPTIONAL, admin-only trace of Memo's reasoning process.
//
// When a `trace` sink is attached to the AirlockContext, the agent records each
// step it takes: the RAG-first catalog recall, every OpenAI reasoning round
// (the model's thought + which tools it chose to call), and every tool dispatch
// (which source it hit, with args and a public-safe result summary).
//
// This powers the admin Memo Playground's "how Memo thought" inspector. It is
// NEVER attached on the consumer path (the trace field is simply absent), so
// the live concierge is byte-for-byte unchanged and pays zero overhead.

// The upstream source a step read from — the label the playground shows.
//
// "Place recall" is the trace label for the catalog RAG tool. It replaced
// "Lineup engine" in MESITA-1216: MESITA-1048 deleted
// the Lineup engine, and the label outlived it. The label and the tool
// name that maps to it) is mirrored in apps/web-admin's own TraceSource union
// and its badge colour map. Renaming it here alone breaks that inspector, so
// both flip together in a follow-up. It labels Memo's cosine recall over the
// place catalog — which is alive and unchanged.
export type TraceSource =
  | "OpenAI"
  | "Place recall"
  | "Perplexity (web)"
  | "Mesita catalog";

export type TraceStep =
  // The RAG-first seed: recall Mesita candidates before the model's first turn.
  | {
    kind: "recall";
    title: string;
    source: "Place recall";
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
    case "places_recommend":
      return "Place recall";
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
