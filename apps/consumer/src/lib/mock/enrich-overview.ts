// Overview enrichment for venue cards.
//
// The discover EFs return the FULL public venues projection on every row:
// consumer-recommend-deck → recommender-rank-deck pulls VENUE_PUBLIC_COLUMNS
// (only the two embedding columns are stripped), and consumer-list-venues
// selects the same set. So each Venue the client receives already carries
// the raw signal columns — google_stars_overall, google_review_count,
// instagram_followers_count, price_level, hours, timezone, zone, city,
// enriched_at. They just aren't on the `Venue` *type*, so nothing mapped
// them onto the derived overview names (google_rating, open_now,
// last_updated_label, …) that the card reads. Result: real cards stayed
// sparse while the detail modal — which DID derive them via
// venueRowToDetail — was rich.
//
// `enrichVenueOverview` closes that gap. `withRealOverview` derives the
// overview-parity fields from the raw columns already on the row, running
// the SAME open/closed math (computeOpenState) the detail modal uses, so
// the card mirrors the detail Overview grid with real data. Mock/seeded
// values only fill where the real column is absent:
//   - "deck"    → the Mochomos demo venue still gets the full fixture so
//     the showcase card is never empty; every other row keeps whatever
//     real data it has (a genuinely missing cell just hides).
//   - "catalog" → a deterministic seeded rating / distance / IG keeps every
//     tile lit even for venues that haven't been enriched yet.
//
// The `??` coalesce means a real value always wins over a mock.

import type { Venue } from "@/lib/api/venues";
import { mockVenue } from "@/lib/mock/venue";
import {
  computeOpenState,
  neighborhoodFromAddress,
} from "@/lib/adapters/venue-to-detail";
import { relativeLabel } from "@/lib/utils";

const PROMO_MOCK_PERCENT = 20;

type EnrichMode = "deck" | "catalog";

/**
 * Populates a Venue's overview-parity fields. `withRealOverview` derives
 * them from the raw venues columns the EF returned; `mode` then layers a
 * fallback for anything still missing:
 *   - `"deck"` — the canonical demo venue (Mochomos) gets the full
 *     VenueDetail fixture; every other row gets the minimal cashback +
 *     first-visit shim so the promo chip can render.
 *   - `"catalog"` — every row gets a deterministic seeded rating /
 *     distance / IG (keyed by venue id) so catalog tiles never look empty.
 */
export function enrichVenueOverview(v: Venue, mode: EnrichMode): Venue {
  const real = withRealOverview(v);
  if (mode === "deck") return enrichForDeck(real);
  return enrichForCatalog(real);
}

// Derives the overview-parity fields from the raw venues columns that ride
// along on every Venue at runtime (present even though they're absent from
// the `Venue` type). Mirrors venueRowToDetail so the card and the detail
// modal compute identical rating / status / zone / freshness.
function withRealOverview(v: Venue): Venue {
  const row = v as unknown as Record<string, unknown>;
  const rating = num(row.google_stars_overall);
  const count = num(row.google_review_count);
  const igFollowers = num(row.instagram_followers_count);
  const priceLevel = num(row.price_level);
  // Neighborhood (zone) priority: the real zone column → the colonia
  // parsed out of the formatted address → the city. Most venues have no
  // zone column yet but DO carry the colonia inside `address`
  // ("…, Valle del Campestre, 66266 …"), so deriving it here lights up the
  // neighborhood chip without a DB backfill, and degrades to city when the
  // address has none (e.g. US venues).
  const zone =
    str(row.zone) ?? neighborhoodFromAddress(str(row.address)) ?? str(row.city);
  const freshness = relativeLabel(str(row.enriched_at) ?? str(row.created_at));
  const rewardCapCents = num(row.reward_cap_cents);

  // Only trust the live open/closed math when the row actually carries an
  // hours table — otherwise leave the fields null so the status chip hides
  // (and the demo fallback can supply mock hours for Mochomos).
  const hasHours =
    !!row.hours &&
    typeof row.hours === "object" &&
    !Array.isArray(row.hours) &&
    Object.keys(row.hours as object).length > 0;
  const open = hasHours ? computeOpenState(row.hours, str(row.timezone)) : null;

  return {
    ...v,
    google_rating: v.google_rating ?? rating ?? null,
    google_count: v.google_count ?? count ?? null,
    instagram_followers_count:
      v.instagram_followers_count ?? igFollowers ?? null,
    price_range:
      v.price_range ?? (priceLevel != null ? "$".repeat(priceLevel) : null),
    open_now: v.open_now ?? open?.open_now ?? null,
    opens_at: v.opens_at ?? (open?.opens_at || null),
    // Prefer the computed close time; fall back to the raw closes_at column.
    closes_at: (open?.closes_at || null) ?? v.closes_at ?? null,
    zone: v.zone ?? zone ?? null,
    last_updated_label: v.last_updated_label ?? freshness ?? null,
    // The per-visit cashback ceiling (stored in cents) backs the promo
    // chip's "Capped MX$… / visit" tooltip. The per-tier rate itself is
    // resolved in PromoChip straight off the raw row columns.
    reward_cap_mxn:
      v.reward_cap_mxn ??
      (rewardCapCents != null ? Math.round(rewardCapCents / 100) : null),
  };
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
      closes_at: v.closes_at ?? mockVenue.closes_at,
      distance_km: v.distance_km ?? mockVenue.distance_km,
      zone: v.zone ?? mockVenue.zone,
      reward_cap_mxn: v.reward_cap_mxn ?? mockVenue.reward_cap_mxn,
      cashback_percent:
        v.cashback_percent ??
        mockVenue.promo_matrix.welcome[mockVenue.promo_matrix.current_tier] ??
        PROMO_MOCK_PERCENT,
      is_first_visit: v.is_first_visit ?? mockVenue.promo_matrix.is_first_visit,
    };
  }
  // Non-demo rows keep whatever real promo the row carries — PromoChip
  // resolves the per-tier rate and hides itself when there's none. No
  // forced mock cashback, so a web-listed place no longer shows a fake
  // ribbon.
  return {
    ...v,
    is_first_visit: v.is_first_visit ?? true,
  };
}

function enrichForCatalog(v: Venue): Venue {
  const seed = stringHash(v.id);
  const ratingTenths = seed % 10; // .0..9
  return {
    ...v,
    google_rating:
      v.google_rating ?? Number((4 + ratingTenths / 10).toFixed(1)),
    distance_km:
      v.distance_km ?? Number((0.4 + ((seed >> 4) % 50) / 10).toFixed(1)),
    instagram_followers_count:
      v.instagram_followers_count ?? 2000 + ((seed >> 6) % 80) * 1000,
    is_first_visit: v.is_first_visit ?? true,
  };
}

// ── local readers ─────────────────────────────────────────────────────
// Tiny defensive accessors for the raw row (same shape as the ones in
// venue-to-detail.ts). Kept local so this module doesn't widen that file's
// export surface just to read two scalars.
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

// Stable per-string hash so seeded mocks don't shuffle between renders.
function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
