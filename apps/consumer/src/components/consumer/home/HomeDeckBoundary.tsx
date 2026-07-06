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

// Async server component that fetches the Home recommendation deck ONCE and
// hands it to every /home sub-route via context. It lives inside the /home
// layout's Suspense boundary, so the pill nav paints immediately while this
// resolves, and — because it's part of the layout subtree — it is NOT re-run
// when navigating between sibling tabs (only the leaf page segment changes).
//
// Fetch mirrors the swipe deck: recommender deck first, public catalog as the
// fallback, partner rows floated to the top, overview enrichment applied so
// cards carry rating / zone / open-state.
export async function HomeDeckBoundary({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();

  let places: Place[] = [];
  let fetchError: string | null = null;
  try {
    const result = await apiRecommendDeck(supabase, { limit: 50 });
    places = result.deck;
  } catch (err) {
    console.warn("[home] consumer-recommend-swipe failed, falling back:", err);
    try {
      places = await apiFetchPublicPlaces(supabase);
    } catch (err2) {
      fetchError = errMsg(err2, "Failed to load places.");
    }
  }

  const sorted = [...places].sort((a, b) => {
    const aRank = a.listing_type === "partner" ? 0 : 1;
    const bRank = b.listing_type === "partner" ? 0 : 1;
    return aRank - bRank;
  });
  const enriched = sorted.map((v) => enrichPlaceOverview(v));

  return (
    <HomeDeckProvider places={enriched} fetchError={fetchError}>
      {children}
    </HomeDeckProvider>
  );
}
