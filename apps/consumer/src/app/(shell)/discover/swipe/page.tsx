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

  // Demo-only enrichment for the venue overview parity checkpoint.
  //
  // 1. Mochomos (mockVenue.id) gets the full overview payload from the
  //    VenueDetail fixture — rating, distance, zone, freshness label,
  //    reward cap, etc.
  // 2. Every other deck row gets a minimal mock so the promo chip can
  //    still render across the board: a placeholder cashback_percent
  //    + is_first_visit flag, both labelled "MOCK" on the chip itself.
  //
  // recommend-deck / list-venues don't yet return any of these fields;
  // the EF + a Google snapshot table land later and override these
  // mocked values per-venue.
  const PROMO_MOCK_PERCENT = 20;
  const enriched = sorted.map((v) => {
    const isMochomos =
      v.id === mockVenue.id ||
      v.slug === mockVenue.id ||
      v.name === mockVenue.name;
    if (isMochomos) {
      return {
        ...v,
        google_rating: v.google_rating ?? mockVenue.google.rating,
        google_count: v.google_count ?? mockVenue.google.count,
        price_range: v.price_range ?? mockVenue.price_range,
        last_updated_label:
          v.last_updated_label ?? mockVenue.last_updated_label,
        open_now: v.open_now ?? mockVenue.open_now,
        opens_at: v.opens_at ?? mockVenue.opens_at,
        distance_km: v.distance_km ?? mockVenue.distance_km,
        zone: v.zone ?? mockVenue.zone,
        reward_cap_mxn: v.reward_cap_mxn ?? mockVenue.reward_cap_mxn,
        cashback_percent:
          v.cashback_percent ??
          mockVenue.promo_matrix.welcome[mockVenue.promo_matrix.current_tier] ??
          PROMO_MOCK_PERCENT,
        is_first_visit:
          v.is_first_visit ?? mockVenue.promo_matrix.is_first_visit,
      };
    }
    return {
      ...v,
      cashback_percent: v.cashback_percent ?? PROMO_MOCK_PERCENT,
      is_first_visit: v.is_first_visit ?? true,
    };
  });

  return <SwipeDeck venues={enriched} fetchError={fetchError} />;
}
