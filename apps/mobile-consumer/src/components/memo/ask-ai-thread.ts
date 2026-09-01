import type { AiMessage } from '@/components/memo/types';
import type { MemoAnswer, MemoTurn } from '@/lib/api/memo';

export type { AiMessage } from '@/components/memo/types';

// In-code fallback when ask-memo bootstrap / turn metadata has no greeting.
// Product Rules §C Spanish-first — keep aligned with admin Memo Config DEFAULT.
const FALLBACK_GREETING =
  "Hola, soy Don Memo, la IA de Mesita. Dime qué se te antoja — prueba “rooftop date tonight” o “tacos al pastor”.";

export const AI_ERROR =
  'Hmm, my line dropped for a second — give it another try in a moment.';

const MAX_CARDS = 3;
const MAX_RELATED = 3;
const THREAD_CAP = 40;

let nextId = 0;
export function msgId(): string {
  nextId += 1;
  return `ai-msg-${nextId}`;
}

// Session-scoped configured opener from consumer-web-ask-memo (`greeting`).
let configuredGreeting: string | null = null;

export function setConfiguredGreeting(greeting: string | null | undefined) {
  const trimmed = (greeting ?? '').trim();
  if (trimmed.length > 0) configuredGreeting = trimmed;
}

function greetingText(): string {
  return configuredGreeting ?? FALLBACK_GREETING;
}

// Thread persistence — Home keep-alive usually keeps AskAiTab mounted; the
// module cache covers remounts within the session (web parity). Not
// AsyncStorage: a full reload starts fresh.
type StoredThread = { messages: AiMessage[]; related: string[] };

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
  return [{ id: msgId(), role: 'ai', kind: 'text', text: greetingText() }];
}

/** Replace the lone opener when the server greeting arrives (fresh thread). */
export function withServerGreeting(messages: AiMessage[]): AiMessage[] {
  if (messages.length !== 1 || messages[0]?.role !== 'ai') return messages;
  const text = greetingText();
  if (messages[0].text === text) return messages;
  return [{ ...messages[0], text }];
}

export function buildMemoHistory(messages: AiMessage[]): MemoTurn[] {
  return messages
    .filter((m): m is Extract<AiMessage, { kind: 'text' }> => m.kind === 'text')
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));
}

export function buildAiReply(reply: MemoAnswer | null): {
  message: AiMessage;
  related: string[];
} {
  if (reply?.greeting) setConfiguredGreeting(reply.greeting);
  const shown = (reply?.predictions ?? []).slice(0, MAX_CARDS);
  return {
    message: {
      id: msgId(),
      role: 'ai',
      kind: 'text',
      text: reply?.answer?.trim() ? reply.answer : AI_ERROR,
      predictions: shown,
    },
    related: (reply?.related ?? []).slice(0, MAX_RELATED),
  };
}
