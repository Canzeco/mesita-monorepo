import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiRecommendDeck,
  apiFetchPublicPlaces,
  type Place,
} from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import { SwipeDeck } from "../../discover/swipe/SwipeDeck";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ExploreSwipePage() {
  const supabase = await createServerSupabase();

  let places: Place[] = [];
  let fetchError: string | null = null;
  try {
    const result = await apiRecommendDeck(supabase, { limit: 50 });
    places = result.deck;
  } catch (err) {
    console.warn(
      "[explore/swipe] consumer-recommend-swipe failed, falling back:",
      err,
    );
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

  return <SwipeDeck places={enriched} fetchError={fetchError} />;
}
