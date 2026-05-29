// Demo-time enrichment for the venue overview parity checkpoint.
//
// consumer-recommend-deck / consumer-recommend-catalog / consumer-list-venues
// don't yet return the optional overview fields on the Venue row
// (google_rating, distance_km, price_range, last_updated_label,
// reward_cap_mxn, open_now, opens_at, zone, is_first_visit). Every
// surface that renders a venue card was therefore growing its own
// little adapter that filled the missing fields with mocks. The
// shapes diverged over time:
//
//   - swipe: spliced the full VenueDetail fixture onto Mochomos and
//     a `cashback_percent ?? 20` + `is_first_visit ?? true` minimum
//     onto every other deck row.
//   - catalog: a deterministic seeded mock per-venue (rating in
//     [4.0..4.9], distance in [0.4..5.4]km) so every row lit up.
//   - saved: pre-stamped fields directly on the SAVED_VENUES rows.
//
// One helper now owns all three modes via `enrichVenueWithMockOverview`.
// The `??` coalesce means a real EF value always wins — these mocks
// only fill the gap during the placeholder phase.

import type { Venue } from "@/lib/api/venues";
import { mockVenue } from "@/lib/mock/venue";

const PROMO_MOCK_PERCENT = 20;

type EnrichMode = "deck" | "catalog";

/**
 * Wraps a Venue with mock overview fields where the EF didn't provide
 * its own. `mode` selects the fill strategy:
 *   - `"deck"` — the canonical demo venue (Mochomos) gets the full
 *     VenueDetail payload; every other row gets the minimal
 *     cashback + first-visit shim so the promo chip can render.
 *   - `"catalog"` — every row gets a deterministic seeded mock
 *     (rating + distance keyed by venue id) so the catalog tiles all
 *     surface stars + distance without singling out the demo venue.
 */
export function enrichVenueWithMockOverview(
  v: Venue,
  mode: EnrichMode,
): Venue {
  if (mode === "deck") return enrichForDeck(v);
  return enrichForCatalog(v);
}

function enrichForDeck(v: Venue): Venue {
  const isMochomos =
    v.id === mockVenue.id ||
    v.slug === mockVenue.id ||
    v.name === mockVenue.name;
  if (isMochomos) {
    return {
      ...v,
      google_rating: v.google_rating ?? mockVenue.google.rating,
      google_count: v.google_count ?? mockVenue.google.count,
      instagram_followers_count:
        v.instagram_followers_count ?? mockVenue.instagram.followers,
      price_range: v.price_range ?? mockVenue.price_range,
      last_updated_label: v.last_updated_label ?? mockVenue.last_updated_label,
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
}

function enrichForCatalog(v: Venue): Venue {
  const seed = stringHash(v.id);
  const ratingTenths = seed % 10; // .0..9
  return {
    ...v,
    google_rating: v.google_rating ?? Number((4 + ratingTenths / 10).toFixed(1)),
    distance_km:
      v.distance_km ?? Number((0.4 + ((seed >> 4) % 50) / 10).toFixed(1)),
    instagram_followers_count:
      v.instagram_followers_count ?? 2000 + ((seed >> 6) % 80) * 1000,
    is_first_visit: v.is_first_visit ?? true,
  };
}

// Stable per-string hash so seeded mocks don't shuffle between renders.
function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
