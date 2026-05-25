import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiRecommendDeck,
  apiFetchPublicVenues,
  type Venue,
} from "@/lib/api/venues";
import { SwipeDeck } from "./SwipeDeck";

// Fetched on every request: this is a discover surface and freshness matters.
export const dynamic = "force-dynamic";

// Lat/lng aren't on the cookie yet — the consumer geolocate prompt happens
// client-side. For now the SSR pass passes no location, so consumer-recommend-deck
// falls back to "newest 200 active venues, RAG-rank by generic intent".
// Once the client knows lat/lng we'll move the deck fetch into the client
// or pass it via search params.
export default async function SwipePage() {
  const supabase = await createServerSupabase();

  let venues: Venue[] = [];
  let fetchError: string | null = null;
  try {
    // Try the curated path first. If consumer-recommend-deck isn't deployed yet
    // (or returns an error), fall back to the flat list. Either way the
    // SwipeDeck UI gets a Venue[].
    const result = await apiRecommendDeck(supabase, { limit: 20 });
    venues = result.deck;
  } catch (err) {
    console.warn("[swipe] consumer-recommend-deck failed, falling back:", err);
    try {
      venues = await apiFetchPublicVenues(supabase);
    } catch (err2) {
      fetchError =
        err2 instanceof Error ? err2.message : "Failed to load venues.";
    }
  }

  // The EF already partner-biases + diversifies, but if we fell back to
  // the flat list we still want partners first.
  const sorted = [...venues].sort((a, b) => {
    const aRank = a.listing_type === "partner" ? 0 : 1;
    const bRank = b.listing_type === "partner" ? 0 : 1;
    return aRank - bRank;
  });

  return <SwipeDeck venues={sorted} fetchError={fetchError} />;
}
