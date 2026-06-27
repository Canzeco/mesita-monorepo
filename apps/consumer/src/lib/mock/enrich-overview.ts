// Overview enrichment for place cards — REAL data only.
//
// The discover EFs return the FULL public places projection on every row:
// consumer-recommend-swipe → recommender-rank-swipe pulls PLACE_PUBLIC_COLUMNS
// (only the two embedding columns are stripped), and consumer-list-places
// selects the same set. So each Place the client receives already carries
// the raw signal columns — google_stars_overall, google_review_count,
// instagram_followers_count, price_level, hours, timezone, zone, city,
// address, enriched_at. They just aren't on the `Place` *type*, so nothing
// mapped them onto the derived overview names (google_rating, open_now,
// last_updated_label, …) that the card reads. Result: real cards stayed
// sparse while the detail modal — which DID derive them via
// placeRowToDetail — was rich.
//
// `enrichPlaceOverview` closes that gap. It derives the overview-parity
// fields from the raw columns already on the row, running the SAME
// open/closed math (computeOpenState) the detail modal uses, so the card
// mirrors the detail Overview grid with real data.
//
// There is no mock/seeded fallback: the demo fixture and the deterministic
// rating/distance/IG seeds were removed. A genuinely missing cell stays
// null and its chip simply hides — the card shows only what the place
// actually has. The `??` chains here are real-vs-real (an already-mapped
// value wins over a freshly-derived one), never real-vs-fabricated.

import type { Place } from "@/lib/api/places";
import {
  computeOpenState,
  neighborhoodFromAddress,
} from "@/lib/adapters/place-to-detail";
import { relativeLabel } from "@/lib/utils";

// Derives the overview-parity fields from the raw places columns that ride
// along on every Place at runtime (present even though they're absent from
// the `Place` type). Mirrors placeRowToDetail so the card and the detail
// modal compute identical rating / status / zone / freshness.
export function enrichPlaceOverview(v: Place): Place {
  const row = v as unknown as Record<string, unknown>;
  const rating = num(row.google_stars_overall);
  const count = num(row.google_review_count);
  const igFollowers = num(row.instagram_followers_count);
  const priceLevel = num(row.price_level);
  // Neighborhood (zone) priority: the real zone column → the colonia
  // parsed out of the formatted address → the city. Most places have no
  // zone column yet but DO carry the colonia inside `address`
  // ("…, Valle del Campestre, 66266 …"), so deriving it here lights up the
  // neighborhood chip without a DB backfill, and degrades to city when the
  // address has none (e.g. US places).
  const zone =
    str(row.zone) ?? neighborhoodFromAddress(str(row.address)) ?? str(row.city);
  const freshness = relativeLabel(str(row.enriched_at) ?? str(row.created_at));
  // Ticket cap, in pesos — the promo applies to the first `monthly_promo_cap`
  // of the bill, the same column the business sets on the Promos page.
  const rewardCapMxn = num(row.monthly_promo_cap);

  // Only trust the live open/closed math when the row actually carries an
  // hours table — otherwise leave the fields null so the status chip hides.
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
    // The ticket cap (pesos) backs the promo chip's "first MX$… / visit"
    // tooltip. The per-tier rate itself is resolved in PromoChip straight off
    // the raw row columns — and only for Verified Partners (web-listed places
    // never offer rewards).
    reward_cap_mxn: v.reward_cap_mxn ?? rewardCapMxn ?? null,
  };
}

// ── local readers ─────────────────────────────────────────────────────
// Tiny defensive accessors for the raw row (same shape as the ones in
// place-to-detail.ts). Kept local so this module doesn't widen that file's
// export surface just to read two scalars.
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
