import type { MemoAnswer, MemoTurn } from "@/lib/api/memo";
import type { PlacePrediction } from "@/lib/api/place-search";

// Ask AI has no place cards — Memo's suggestions live inline in the prose as
// underlined links (see MemoAnswerText). Each AI turn carries the predictions
// its answer refers to so the names can be linkified.
export type AiMessage = {
  id: string;
  role: "user" | "ai";
  kind: "text";
  text: string;
  predictions?: PlacePrediction[];
};

export const GREETING =
  "Hello 👋 I'm Memo, the AI of Mesita. Tell me what you're craving — try “rooftop date tonight” or just “tacos al pastor”.";

export const AI_ERROR =
  "Hmm, my line dropped for a second — give it another try in a moment.";

// Cap how many cards one reply drops into the thread — a tight, curated
// shortlist reads like a recommendation, not search results.
export const MAX_CARDS = 3;
// Cap the follow-up chips Memo suggests under a reply.
export const MAX_RELATED = 3;

let nextId = 0;
export function msgId(): string {
  nextId += 1;
  return `ai-msg-${nextId}`;
}

// Thread persistence — the Ask AI tab is a route now, so switching Home tabs
// unmounts it. Keep the conversation in a module-level cache so it survives
// remounts within the session. Writes happen only on the client (in a save
// effect / event handlers), so the server module stays null across requests
// and the first render always matches SSR (greeting) — no hydration mismatch,
// and no set-state-in-effect. Intentionally NOT localStorage: a full reload
// starts fresh, which keeps this clean and avoids a client-only initial read.
export type StoredThread = { messages: AiMessage[]; related: string[] };
export const THREAD_CAP = 40; // bound the retained history

let threadCache: StoredThread | null = null;

export function getThreadCache(): StoredThread | null {
  return threadCache;
}

export function saveThreadCache(messages: AiMessage[], related: string[]) {
  threadCache =
    messages.length > 1
      ? { messages: messages.slice(-THREAD_CAP), related }
      : null;
}

export function clearThreadCache() {
  threadCache = null;
}

export function greetingThread(): AiMessage[] {
  return [{ id: msgId(), role: "ai", kind: "text", text: GREETING }];
}

export function buildMemoHistory(messages: AiMessage[]): MemoTurn[] {
  return messages
    .filter((m): m is Extract<AiMessage, { kind: "text" }> => m.kind === "text")
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));
}

export function buildAiReply(reply: MemoAnswer | null): {
  message: AiMessage;
  related: string[];
} {
  const shown = (reply?.predictions ?? []).slice(0, MAX_CARDS);
  return {
    message: {
      id: msgId(),
      role: "ai",
      kind: "text",
      text: reply?.answer?.trim() ? reply.answer : AI_ERROR,
      predictions: shown,
    },
    related: (reply?.related ?? []).slice(0, MAX_RELATED),
  };
}
