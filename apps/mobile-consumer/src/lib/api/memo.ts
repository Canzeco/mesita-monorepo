// Memo — consumer AI concierge (consumer-web-ask-memo). Port of
// apps/web-consumer/src/lib/api/memo.ts.

import type { SupabaseClient } from '@supabase/supabase-js';

import { invokeEF } from '@/lib/ef';
import type { PlacePrediction } from '@/lib/api/places';

export type MemoTurn = { role: 'user' | 'assistant'; content: string };

export type MemoAnswer = {
  answer: string;
  predictions: PlacePrediction[];
  related: string[];
  mocked: boolean;
  // Operator-configured Ask AI opener (app_config.memo_greeting).
  greeting?: string | null;
};

type AskMemoResponse = {
  answer: string;
  predictions: PlacePrediction[] | null;
  related: string[] | null;
  mocked?: boolean;
  greeting?: string | null;
};

function shapeAnswer(data: AskMemoResponse): MemoAnswer {
  const greeting =
    typeof data.greeting === 'string' && data.greeting.trim().length > 0
      ? data.greeting.trim()
      : null;
  return {
    answer: data.answer,
    predictions: data.predictions ?? [],
    related: data.related ?? [],
    mocked: data.mocked ?? false,
    greeting,
  };
}

export async function apiAskMemo(
  client: SupabaseClient,
  args: {
    query: string;
    location?: { lat: number; lng: number } | null;
    history?: MemoTurn[];
  },
): Promise<MemoAnswer> {
  const data = await invokeEF<AskMemoResponse>(
    client,
    'consumer-web-ask-memo',
    {
      query: args.query.trim(),
      latitude: args.location?.lat,
      longitude: args.location?.lng,
      history: args.history ?? [],
    },
  );
  return shapeAnswer(data);
}

/** Lightweight ask-memo bootstrap — configured opener, no AI spend. */
export async function apiMemoGreeting(
  client: SupabaseClient,
): Promise<string | null> {
  const data = await invokeEF<AskMemoResponse>(client, 'consumer-web-ask-memo', {
    query: '',
  });
  const g = typeof data.greeting === 'string' ? data.greeting.trim() : '';
  return g.length > 0 ? g : null;
}
