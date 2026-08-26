import type { ReactNode } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiRecommendDeck,
  apiFetchPublicPlaces,
  type Place,
} from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import { errMsg } from "@/lib/utils";
import { HomeDeckProvider } from "./HomeDeckContext";
import { isPromoting } from "@/lib/promo-rates";

// Async server component that fetches the Home deck ONCE and hands it to
// every /home sub-route via context. It lives inside the /home layout's
// Suspense boundary, so the pill nav paints immediately while this resolves,
// and — because it's part of the layout subtree — it is NOT re-run when
// navigating between sibling tabs (only the leaf page segment changes).
//
// Fetch mirrors the swipe deck: the deck EF (a random sample of active
// places) first, public catalog as the fallback, partner rows floated to the
// top HERE on the client, overview enrichment applied so cards carry
// rating / zone / open-state.
export async function HomeDeckBoundary({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();

  let places: Place[] = [];
  let fetchError: string | null = null;
  try {
    const result = await apiRecommendDeck(supabase, { limit: 50 });
    places = result.deck;
  } catch (err) {
    console.warn(
      "[home] consumer-web-recommend-swipe failed, falling back:",
      errMsg(err, "recommend failed"),
    );
    try {
      places = await apiFetchPublicPlaces(supabase);
    } catch (err2) {
      fetchError = errMsg(err2, "Failed to load places.");
    }
  }

  const sorted = [...places]
    .filter((p) => !p.googleOnly && !p.from_google)
    .sort((a, b) => {
      const aRank = isPromoting(a) ? 0 : 1;
      const bRank = isPromoting(b) ? 0 : 1;
      return aRank - bRank;
    });
  const enriched = sorted.map((v) => enrichPlaceOverview(v));

  return (
    <HomeDeckProvider places={enriched} fetchError={fetchError}>
      {children}
    </HomeDeckProvider>
  );
}
