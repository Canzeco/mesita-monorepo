import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiRecommendDeck,
  apiFetchPublicVenues,
  type Venue,
} from "@/lib/api/venues";
import { enrichVenueOverview } from "@/lib/mock/enrich-overview";
import { SwipeDeck } from "../../discover/swipe/SwipeDeck";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ExploreSwipePage() {
  const supabase = await createServerSupabase();

  let venues: Venue[] = [];
  let fetchError: string | null = null;
  try {
    const result = await apiRecommendDeck(supabase, { limit: 50 });
    venues = result.deck;
  } catch (err) {
    console.warn(
      "[explore/swipe] consumer-recommend-deck failed, falling back:",
      err,
    );
    try {
      venues = await apiFetchPublicVenues(supabase);
    } catch (err2) {
      fetchError = errMsg(err2, "Failed to load venues.");
    }
  }

  const sorted = [...venues].sort((a, b) => {
    const aRank = a.listing_type === "partner" ? 0 : 1;
    const bRank = b.listing_type === "partner" ? 0 : 1;
    return aRank - bRank;
  });

  const enriched = sorted.map((v) => enrichVenueOverview(v));

  return <SwipeDeck venues={enriched} fetchError={fetchError} />;
}
