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
};

type AskMemoResponse = {
  answer: string;
  predictions: PlacePrediction[] | null;
  related: string[] | null;
  mocked?: boolean;
};

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
  return {
    answer: data.answer,
    predictions: data.predictions ?? [],
    related: data.related ?? [],
    mocked: data.mocked ?? false,
  };
}
