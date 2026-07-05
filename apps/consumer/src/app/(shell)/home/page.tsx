import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiRecommendDeck,
  apiFetchPublicPlaces,
  type Place,
} from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import { errMsg } from "@/lib/utils";
import { HomeHub } from "@/components/consumer/home/HomeHub";
import {
  HOME_MODE_PARAM,
  parseHomeMode,
} from "@/components/consumer/home/home-mode";

export const dynamic = "force-dynamic";

// Home — the discovery hub. Three modes (Social / Swipe / Favorites) share
// ONE server-fetched deck: Swipe hands it to the existing SwipeDeck, Social
// resolves its live-feed rows against it, and Favorites uses it as the
// catalog behind the consumer's saved ids. Mode switching is instant client
// state inside HomeHub; ?mode= deep links land on the right pill.
//
// Fetch mirrors the home swipe deck: recommender deck first, public
// catalog as the fallback, partner rows floated to the top, overview
// enrichment applied so cards carry rating / zone / open-state.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialMode = parseHomeMode(params[HOME_MODE_PARAM]);

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
    <HomeHub
      places={enriched}
      fetchError={fetchError}
      initialMode={initialMode}
    />
  );
}
