// Memo — the consumer AI concierge (consumer-web-ask-memo).
//
// Memo is Mesita's third agent (with the Enricher and the Reservationist).
// One call runs the server-side pipeline (Perplexity sonar-pro + Google Places
// Text Search + Mesita catalog) and returns a natural-language answer plus
// real place cards. See supabase/functions/consumer-web-ask-memo.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { PlacePrediction } from "./places";

// One prior chat turn, sent as context so Memo can follow up ("cheaper?",
// "what about near the office?"). Keep it to text turns only.
export type MemoTurn = { role: "user" | "assistant"; content: string };

export type MemoAnswer = {
  answer: string;
  predictions: PlacePrediction[];
  // Suggested follow-up questions Memo surfaces as tappable chips.
  related: string[];
  // True when the card rail is a Mesita sample (Google leg empty) rather
  // than query-specific results — the prose stays real either way.
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
    "consumer-web-ask-memo",
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
