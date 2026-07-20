import type { AiMessage } from '@/components/memo/types';
import type { MemoAnswer, MemoTurn } from '@/lib/api/memo';

export type { AiMessage } from '@/components/memo/types';

export const GREETING =
  "Hello 👋 I'm Memo, the AI of Mesita. Tell me what you're craving — try “rooftop date tonight” or just “tacos al pastor”.";

export const AI_ERROR =
  'Hmm, my line dropped for a second — give it another try in a moment.';

export const MAX_CARDS = 3;
export const MAX_RELATED = 3;
export const THREAD_CAP = 40;

let nextId = 0;
export function msgId(): string {
  nextId += 1;
  return `ai-msg-${nextId}`;
}

// Thread persistence — Home keep-alive usually keeps AskAiTab mounted; the
// module cache covers remounts within the session (web parity). Not
// AsyncStorage: a full reload starts fresh.
export type StoredThread = { messages: AiMessage[]; related: string[] };

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
  return [{ id: msgId(), role: 'ai', kind: 'text', text: GREETING }];
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
