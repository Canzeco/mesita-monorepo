import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiRecommendDeck,
  apiFetchPublicVenues,
  type Venue,
} from "@/lib/api/venues";
import { mockVenue } from "@/lib/mock/venue";
import { SwipeDeck } from "./SwipeDeck";
import { errMsg } from "@/lib/utils";

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
      fetchError = errMsg(err2, "Failed to load venues.");
    }
  }

  // The EF already partner-biases + diversifies, but if we fell back to
  // the flat list we still want partners first.
  const sorted = [...venues].sort((a, b) => {
    const aRank = a.listing_type === "partner" ? 0 : 1;
    const bRank = b.listing_type === "partner" ? 0 : 1;
    return aRank - bRank;
  });

  // Demo-only enrichment for the venue overview parity checkpoint: the
  // swipe card now renders the same eight metadata cells as the venue
  // detail overview, but recommend-deck / list-venues don't yet return
  // the Google rating, distance, zone, price range, freshness label, or
  // reward cap. The detail page already has a fully populated
  // VenueDetail fixture for Mochomos Monterrey (mockVenue) — splice
  // those values onto the matching deck row so the card lights up for
  // the demo venue. Other rows degrade gracefully (chips hide when null)
  // until the EF starts populating these columns directly.
  const enriched = sorted.map((v) => {
    if (
      v.id !== mockVenue.id &&
      v.slug !== mockVenue.id &&
      v.name !== mockVenue.name
    ) {
      return v;
    }
    return {
      ...v,
      google_rating: v.google_rating ?? mockVenue.google.rating,
      google_count: v.google_count ?? mockVenue.google.count,
      price_range: v.price_range ?? mockVenue.price_range,
      last_updated_label: v.last_updated_label ?? mockVenue.last_updated_label,
      open_now: v.open_now ?? mockVenue.open_now,
      opens_at: v.opens_at ?? mockVenue.opens_at,
      distance_km: v.distance_km ?? mockVenue.distance_km,
      zone: v.zone ?? mockVenue.zone,
      reward_cap_mxn: v.reward_cap_mxn ?? mockVenue.reward_cap_mxn,
    };
  });

  return <SwipeDeck venues={enriched} fetchError={fetchError} />;
}
