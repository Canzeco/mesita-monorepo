import {
  callPerplexityChat,
  type PplxMessage,
} from "../_shared/perplexity-chat.ts";
import { localMoment } from "../_shared/memo-local-moment.ts";
import { DEFAULT_MODELS_CONFIG } from "../_shared/models-config.ts";
import {
  candidateBlock,
} from "./memo-catalog-helpers.ts";
import { knowledgeBlock } from "../_shared/memo-knowledge.ts";
import type { Prediction } from "./memo-google-text-search.ts";

const MAX_HISTORY = 8;
const MAX_CARDS = 3;
const DEFAULT_PERPLEXITY = DEFAULT_MODELS_CONFIG.memo.perplexity!;

type MemoHistory = { role?: unknown; content?: unknown }[] | undefined;

export async function answerWithPerplexity(
  key: string,
  systemPrompt: string,
  query: string,
  lat: number | null,
  lng: number | null,
  profileCtx: string | null,
  history: MemoHistory,
  candidates: Prediction[],
  perplexityModel = DEFAULT_PERPLEXITY,
): Promise<{ text: string; related: string[]; citations: string[] } | null> {
  if (!key) return null;

  const messages: PplxMessage[] = [{ role: "system", content: systemPrompt }];

  // Clamp + sanitize prior turns.
  for (const turn of (history ?? []).slice(-MAX_HISTORY)) {
    const role = turn?.role === "assistant" ? "assistant" : "user";
    const content = typeof turn?.content === "string"
      ? turn.content.trim()
      : "";
    if (content) messages.push({ role, content });
  }

  // Hidden context the model reasons over but must not echo: the user's
  // "where" (location) AND "when" (local time + daypart). Feeding the moment is
  // what stops Memo pitching dinner at 5am — it can now favour open, time-fit
  // spots and flag off-hours asks.
  const ctx = hiddenMemoContext(profileCtx, lat, lng);

  // Mesita's own words, for asks about Mesita itself (MESITA-1201). This engine
  // has no tool loop — Perplexity IS the answer — so the grounding has to ride
  // the prompt: without it "¿qué significa Gold?" is a web search over
  // vocabulary the web has never heard of, and the model declines or invents.
  // Always the guest audience; the internal rows have no path to this prompt.
  // Empty when the ask isn't about Mesita, which is most asks.
  const knowledge = knowledgeBlock(query, "guest");

  // Feed the exact cards the user will see so the recommendation stays
  // coherent with the rail — Memo names the real cards instead of drifting to
  // web-only spots. Empty/absent when the ask isn't place-seeking or nothing
  // matched.
  messages.push({
    role: "user",
    content: `${query}${ctx}${knowledge}${candidateBlock(candidates, MAX_CARDS)}`,
  });

  const res = await callPerplexityChat(key, messages, {
    model: perplexityModel,
    maxTokens: 700,
    temperature: 0.3,
    returnRelated: true,
  });
  if (!res) return null;
  return { text: res.text, related: res.related, citations: res.citations };
}

function hiddenMemoContext(
  profileCtx: string | null,
  lat: number | null,
  lng: number | null,
): string {
  const { clock, daypart } = localMoment(lng);
  const ctxBits: string[] = [];
  if (profileCtx) ctxBits.push(profileCtx);
  if (lat !== null && lng !== null) {
    ctxBits.push(
      `near latitude ${lat.toFixed(4)}, longitude ${lng.toFixed(4)}`,
    );
  }
  if (clock) ctxBits.push(`local time ${clock} (${daypart})`);
  return ctxBits.length > 0
    ? ` [context, do not repeat back: the user is ${ctxBits.join("; ")}. ` +
      `Favour places open and appropriate for this time of day.]`
    : "";
}
