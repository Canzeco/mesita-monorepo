// memo-agent.ts — Memo v-next entry point.
//
// Assembles the airlock (fixed read-only tools), seeds the loop RAG-first with
// a Lineup recall so the model always reasons over real Mesita candidates, runs
// the OpenAI tool-calling loop, and returns the SAME response shape the legacy
// Perplexity pipeline did — so the (already-enabled) frontend is unchanged.
// Gated behind MEMO_ENGINE=agent in index.ts; falls back gracefully.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  Airlock,
  type AirlockContext,
  type ChatMessage,
  runAgent,
} from "./airlock.ts";
import { buildMemoTools, lineupRecall } from "./airlock-tools.ts";
import { buildAgentSystemPrompt } from "./airlock-prompt.ts";
import { isPlaceSeeking } from "../_shared/memo-intent.ts";
import { fallbackAnswer } from "../_shared/memo-fallback.ts";
import { toPlainText } from "./memo-text.ts";
import type { Prediction } from "./memo-google-text-search.ts";

const MAX_CARDS = 3;
const MAX_HISTORY = 6;

export type AgentAnswer = {
  answer: string;
  predictions: Prediction[];
  related: string[];
  citations: string[];
};

export type AgentOpts = {
  admin: SupabaseClient;
  userId: string | null;
  query: string;
  lat: number | null;
  lng: number | null;
  persona: string; // readMemoSystemPrompt result (DB-tunable voice)
  hiddenContext: string | null; // location + local time + (signed-in) profile
  history?: { role?: unknown; content?: unknown }[];
  keys: { openai: string; perplexity: string; google: string };
  model: string;
};

export async function answerWithAgent(opts: AgentOpts): Promise<AgentAnswer> {
  const ctx: AirlockContext = {
    admin: opts.admin,
    userId: opts.userId,
    lat: opts.lat,
    lng: opts.lng,
    keys: opts.keys,
    model: opts.model,
  };
  const airlock = new Airlock(buildMemoTools(), ctx);

  const messages: ChatMessage[] = [
    { role: "system", content: buildAgentSystemPrompt(opts.persona, opts.hiddenContext) },
    ...clampHistory(opts.history),
  ];

  // RAG-first: for place-seeking asks, recall the Lineup once up front so the
  // model's very first turn already has real Mesita candidates to reason over
  // (Pato: "RAG is the central methodology"). The recall's cards also become
  // the base of the rail, so even a text-only model turn shows relevant places.
  const placeSeeking = isPlaceSeeking(opts.query);
  let seed: Prediction[] = [];
  if (placeSeeking) {
    const recall = await lineupRecall(ctx, opts.query);
    seed = recall.predictions ?? [];
    const userContent = recall.text && seed.length > 0
      ? `${opts.query}\n\n[${recall.text}\nRecommend from these when they fit — they show as cards, so reference them naturally and never list them mechanically.]`
      : opts.query;
    messages.push({ role: "user", content: userContent });
  } else {
    messages.push({ role: "user", content: opts.query });
  }

  const out = await runAgent(airlock, ctx, messages);

  // RAG cards lead, then any the model surfaced via tools; dedupe, cap 3.
  const predictions = dedupeCap([...seed, ...out.predictions], MAX_CARDS);
  const onMesita = predictions.length;

  const answer = toPlainText(
    out.answer && out.answer.length > 0
      ? out.answer
      : fallbackAnswer(opts.query, onMesita, 0, placeSeeking),
  );

  return { answer, predictions, related: out.related, citations: out.citations };
}

// Coerce client-supplied history to valid chat turns (user/assistant, string
// content), keeping only the most recent few. Untrusted like any input — the
// system prompt already tells the model to treat message content as data.
function clampHistory(
  history: { role?: unknown; content?: unknown }[] | undefined,
): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  const out: ChatMessage[] = [];
  for (const h of history.slice(-MAX_HISTORY)) {
    const role = h?.role === "assistant" ? "assistant" : h?.role === "user" ? "user" : null;
    const content = typeof h?.content === "string" ? h.content : null;
    if (role && content) out.push({ role, content });
  }
  return out;
}

function dedupeCap(preds: Prediction[], cap: number): Prediction[] {
  const seen = new Set<string>();
  const out: Prediction[] = [];
  for (const p of preds) {
    if (seen.has(p.placeId)) continue;
    seen.add(p.placeId);
    out.push(p);
    if (out.length >= cap) break;
  }
  return out;
}
