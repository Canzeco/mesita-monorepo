// business-web-suggest-promo — Memo-backed next-promo advice (MESITA-892).
//
// Advisory only. Never writes rates. Never returns consumer class.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF, withPlaceId } from "./_invoke";

type PromoSuggestionFocus =
  | "rates"
  | "welcome"
  | "story"
  | "review"
  | "visibility"
  | "retention";

export type PromoSuggestion = {
  headline: string;
  rationale: string;
  strategyId: "zero" | "conservative" | "aggressive" | null;
  focus: PromoSuggestionFocus;
};

export type PromoCopilotResult = {
  answer: string;
  suggestions: PromoSuggestion[];
  model: string | null;
  source: "memo" | "fallback";
};

export async function suggestNextPromo(
  client: SupabaseClient,
  projectId: string,
  query?: string,
): Promise<PromoCopilotResult> {
  return invokeEF<PromoCopilotResult>(
    client,
    "business-web-suggest-promo",
    withPlaceId({
      projectId,
      ...(query?.trim() ? { query: query.trim() } : {}),
    }),
    "Could not get promo suggestions.",
  );
}
