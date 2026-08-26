// Google type → family map. Search and Add eligibility is Discovery › Map
// (`evaluatePlaceForMap`); this file expands Table A types onto those five
// Nearby batteries. `app_config.sourcing_config` is a leftover blob — unread
// by Search/Add. Keep the family keys in lock-step with
// apps/web-admin/src/app/(app)/sourcing-config/catalog.ts. A Google
// primaryType in no family is ineligible (hotels, schools, shops).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type FamilyKey =
  | "restaurants"
  | "bars_nightlife"
  | "cafes_bakeries"
  | "wellness_spa"
  | "experiences"
  | "culture_arts";

export type ChannelKey =
  | "admin_search"
  | "admin_add"
  | "business_search"
  | "business_add"
  | "consumer_search"
  | "consumer_add"
  | "memo_search";

/**
 * Leftover blob shape. Country / pin / restrict are NOT a sourcing gate —
 * Google does not require a country, and the operator types a CLDR code
 * (if at all) on Manage name search. Guest lat/lng, when a caller has it,
 * still bias Text Search / Autocomplete toward the pin.
 */
export type RegionPolicy = {
  country: string;
  lat: number;
  lng: number;
  radiusKm: number;
  restrict: boolean;
};

export const DEFAULT_REGION: RegionPolicy = {
  country: "MX",
  lat: 19.4326,
  lng: -99.1332,
  radiusKm: 0,
  restrict: false,
};

export type ChannelPolicy = {
  enabled: boolean;
  families: FamilyKey[];
  minRating: number;
  minReviews: number;
  region: RegionPolicy;
};

// Machine expansion of each family — the Google `primaryType` values a place
// must match to count as that family. Mirror of the admin catalog's
// FAMILIES[].googleTypes; keep both in sync when Google adds Table A types.
const FAMILY_GOOGLE_TYPES: Record<FamilyKey, readonly string[]> = {
  restaurants: [
    "restaurant", "fine_dining_restaurant", "steak_house", "seafood_restaurant",
    "sushi_restaurant", "japanese_restaurant", "mexican_restaurant", "italian_restaurant",
    "pizza_restaurant", "mediterranean_restaurant", "american_restaurant", "asian_restaurant",
    "chinese_restaurant", "thai_restaurant", "indian_restaurant", "french_restaurant",
    "spanish_restaurant", "korean_restaurant", "vietnamese_restaurant", "middle_eastern_restaurant",
    "vegan_restaurant", "vegetarian_restaurant", "barbecue_restaurant", "hamburger_restaurant",
    "taco_restaurant", "ramen_restaurant", "tapas_restaurant", "brunch_restaurant",
    "breakfast_restaurant", "bistro", "diner", "gastropub", "buffet_restaurant", "food_court",
  ],
  bars_nightlife: [
    "bar", "cocktail_bar", "wine_bar", "sports_bar", "lounge_bar", "pub", "irish_pub",
    "gastropub", "beer_garden", "brewery", "brewpub", "hookah_bar", "night_club",
    "dance_hall", "live_music_venue", "karaoke", "comedy_club", "casino",
  ],
  cafes_bakeries: [
    "cafe", "coffee_shop", "coffee_roastery", "coffee_stand", "cat_cafe", "dog_cafe",
    "tea_house", "bakery", "cake_shop", "pastry_shop", "bagel_shop", "donut_shop",
    "dessert_shop", "dessert_restaurant", "ice_cream_shop", "acai_shop", "juice_shop",
    "chocolate_shop", "confectionery",
  ],
  wellness_spa: [
    "spa", "massage_spa", "massage", "sauna", "wellness_center", "yoga_studio", "skin_care_clinic",
  ],
  experiences: [
    "tourist_attraction", "amusement_park", "amusement_center", "water_park", "aquarium",
    "zoo", "bowling_alley", "video_arcade", "go_karting_venue", "paintball_center",
    "miniature_golf_course", "ice_skating_rink", "escape_room", "winery", "vineyard",
    "botanical_garden", "planetarium", "observation_deck", "marina", "event_venue",
    "banquet_hall", "wedding_venue",
  ],
  culture_arts: [
    "museum", "art_museum", "history_museum", "art_gallery", "cultural_center",
    "cultural_landmark", "historical_place", "monument", "performing_arts_theater",
    "concert_hall", "opera_house", "philharmonic_hall", "movie_theater",
  ],
};

const ALL_FAMILY_KEYS = Object.keys(FAMILY_GOOGLE_TYPES) as FamilyKey[];

// A Google type can belong to more than one family — gastropub is listed
// under both restaurants and bars_nightlife — so keep every family it maps
// to. This used to be first-match-wins, which silently bound gastropub to
// restaurants alone and made a bars-only policy reject it (MESITA-631).
const GOOGLE_TYPE_TO_FAMILIES: Record<string, FamilyKey[]> = (() => {
  const m: Record<string, FamilyKey[]> = {};
  for (const fam of ALL_FAMILY_KEYS) {
    for (const t of FAMILY_GOOGLE_TYPES[fam]) {
      (m[t] ??= []).push(fam);
    }
  }
  return m;
})();

/**
 * Every family a Google type (or places.category slug) belongs to.
 * Empty = not a Mesita type. Dual-family types return every match
 * (MESITA-631). The `_restaurant` alias covers truncated taxonomy
 * slugs (fine_dining → fine_dining_restaurant) so consumer payloads
 * stay classifiable when category drops Google's suffix.
 */
export function familiesForGoogleType(
  primaryType: string | null | undefined,
): FamilyKey[] {
  if (!primaryType) return [];
  const slug = primaryType.trim().toLowerCase();
  if (!slug) return [];
  const direct = GOOGLE_TYPE_TO_FAMILIES[slug];
  if (direct) return direct;
  if (!slug.endsWith("_restaurant")) {
    return GOOGLE_TYPE_TO_FAMILIES[`${slug}_restaurant`] ?? [];
  }
  return [];
}

/** The primary (catalog-order first) family a Google type belongs to. */
export function familyForGoogleType(primaryType: string | null | undefined): FamilyKey | null {
  return familiesForGoogleType(primaryType)[0] ?? null;
}

// The launch policy — must match the admin catalog's DEFAULT_CONFIG. Used as
// the fallback when the app_config read fails or a channel key is absent, so
// a transient error still enforces the intended floors rather than failing open
// to "allow anything". Live floors are authored in app_config; historical
// migration seeds (20260708120000_sourcing_config.sql) may differ.
function withRegion(
  p: Omit<ChannelPolicy, "region">,
  region: RegionPolicy = DEFAULT_REGION,
): ChannelPolicy {
  return { ...p, region: { ...region } };
}

const DEFAULT_POLICY: Record<ChannelKey, ChannelPolicy> = {
  admin_search: withRegion({ enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 0, minReviews: 0 }),
  admin_add: withRegion({ enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 0, minReviews: 0 }),
  business_search: withRegion({ enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 0, minReviews: 0 }),
  business_add: withRegion({ enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 0, minReviews: 0 }),
  consumer_search: withRegion({ enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 1, minReviews: 50 }),
  consumer_add: withRegion({ enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 2, minReviews: 50 }),
  memo_search: withRegion({ enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 4.0, minReviews: 50 }),
};

// Coerce the stored jsonb for one channel into a well-typed ChannelPolicy,
// filling missing/invalid fields from the channel default and dropping unknown
// families. Mirror of the admin catalog's coerceConfig (per-channel slice).
export function coerceChannelPolicy(raw: unknown, channel: ChannelKey): ChannelPolicy {
  const d = DEFAULT_POLICY[channel];
  if (!raw || typeof raw !== "object") return { ...d, families: [...d.families] };
  const o = raw as Record<string, unknown>;
  const families = Array.isArray(o.families)
    ? (o.families.filter(
        (f): f is FamilyKey => typeof f === "string" && (ALL_FAMILY_KEYS as string[]).includes(f),
      ) as FamilyKey[])
    : [...d.families];
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : d.enabled,
    families,
    minRating: typeof o.minRating === "number" ? o.minRating : d.minRating,
    minReviews: typeof o.minReviews === "number" ? o.minReviews : d.minReviews,
    region: coerceRegion(o.region, d.region),
  };
}

export function coerceRegion(raw: unknown, fallback: RegionPolicy = DEFAULT_REGION): RegionPolicy {
  const o = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  let country: string;
  if (typeof o.country === "string") {
    const c = o.country.trim().toUpperCase();
    country = c === "" ? "" : /^[A-Z]{2}$/.test(c) ? c : fallback.country;
  } else {
    country = fallback.country;
  }
  const lat = typeof o.lat === "number" && Number.isFinite(o.lat)
    ? Math.min(90, Math.max(-90, o.lat))
    : fallback.lat;
  const lng = typeof o.lng === "number" && Number.isFinite(o.lng)
    ? Math.min(180, Math.max(-180, o.lng))
    : fallback.lng;
  const radiusKm = typeof o.radiusKm === "number" && Number.isFinite(o.radiusKm)
    ? Math.min(2000, Math.max(0, Math.round(o.radiusKm * 10) / 10))
    : fallback.radiusKm;
  return {
    country,
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
    radiusKm,
    restrict: typeof o.restrict === "boolean" ? o.restrict : fallback.restrict,
  };
}

type GeoOrigin = { lat: number; lng: number };

/** CLDR / ISO-3166-1 alpha-2. Empty = omit Google's optional country params. */
export function parseCldrRegionCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : "";
}

/**
 * Places (New): `regionCode` is optional (format + soft bias; Text Search has
 * no country restrict). Autocomplete may also send `includedRegionCodes` (hard
 * list; empty = no restrict). Callers pass this from the name searchbar.
 */
export function applyPlacesCallerRegion(
  body: Record<string, unknown>,
  raw: unknown,
  kind: "autocomplete" | "text",
): void {
  const code = parseCldrRegionCode(raw);
  if (!code) return;
  body.regionCode = code;
  if (kind === "autocomplete") body.includedRegionCodes = [code];
}

function circleAround(center: GeoOrigin, radiusKm: number) {
  return {
    circle: {
      center: { latitude: center.lat, longitude: center.lng },
      radius: Math.min(50_000, Math.max(1, radiusKm * 1000)),
    },
  };
}

function applyGuestLocationBias(
  body: Record<string, unknown>,
  origin?: GeoOrigin | null,
): void {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    return;
  }
  body.locationBias = circleAround(
    { lat: origin.lat, lng: origin.lng },
    8,
  );
}

/** Autocomplete (New): guest pin bias only. */
export function applyPlacesAutocompleteRegion(
  body: Record<string, unknown>,
  origin?: GeoOrigin | null,
): void {
  applyGuestLocationBias(body, origin);
}

/** Text Search (New): guest pin bias only. */
export function applyPlacesTextSearchRegion(
  body: Record<string, unknown>,
  origin?: GeoOrigin | null,
): void {
  applyGuestLocationBias(body, origin);
}

export function evaluatePlaceRegion(
  _policy: ChannelPolicy,
  _geo: { lat: number | null; lng: number | null; country?: string | null },
): EligibilityResult {
  return { eligible: true };
}

type PlaceSignals = {
  primaryType: string | null;
  rating: number | null;
  reviewCount: number | null;
};

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; code: string; reason: string };

// Evaluate one place against one channel policy. Order: disabled → family →
// rating → reviews, returning the first failing gate with consumer-friendly
// copy. minRating/minReviews of 0 mean "no floor". A null rating/reviewCount
// fails any non-zero floor (an unrated place hasn't cleared the bar).
//
// Note: Google Autocomplete is intentionally NOT pre-filtered by a
// one-type-per-family map. Broad types (`bar`, `cafe`) do not match exact
// primaryTypes (`night_club`, `cake_shop`), and the API caps the list at 5 —
// leftover: channel blob unread by Search/Add. evaluatePlaceForMap is the gate.

export type SourcingConfigRow = Partial<Record<ChannelKey, unknown>>;

// Read one channel slice from app_config.sourcing_config, coerced with the
// launch-policy fallback. Shared by add-paths and search-paths. Callers
// must not accept a request-body override of minRating/minReviews — this
// blob is the only Google quality-floor SoT (MESITA-1348).
export async function readChannelPolicy(
  admin: SupabaseClient,
  channel: ChannelKey,
): Promise<ChannelPolicy> {
  try {
    const { data } = await admin
      .from("app_config")
      .select("sourcing_config")
      .eq("id", 1)
      .maybeSingle();
    const raw = (data?.sourcing_config as SourcingConfigRow | null)?.[channel];
    return coerceChannelPolicy(raw, channel);
  } catch {
    return coerceChannelPolicy(null, channel);
  }
}

export function evaluatePlaceForChannel(
  policy: ChannelPolicy,
  signals: PlaceSignals,
  geo?: { lat: number | null; lng: number | null; country?: string | null },
): EligibilityResult {
  if (!policy.enabled) {
    return { eligible: false, code: "channel_disabled", reason: "Adding new places is currently turned off." };
  }

  // Any family the type belongs to being enabled admits it.
  const families = familiesForGoogleType(signals.primaryType);
  if (!families.some((f) => policy.families.includes(f))) {
    return {
      eligible: false,
      code: "family_not_eligible",
      reason: "This kind of place can't be added to Mesita — we only list restaurants, bars, cafés, wellness, experiences and culture spots.",
    };
  }

  if (policy.minRating > 0 && (signals.rating === null || signals.rating < policy.minRating)) {
    return {
      eligible: false,
      code: "below_min_rating",
      reason: `This place doesn't meet Mesita's minimum Google rating (${policy.minRating}★).`,
    };
  }

  if (policy.minReviews > 0 && (signals.reviewCount === null || signals.reviewCount < policy.minReviews)) {
    return {
      eligible: false,
      code: "below_min_reviews",
      reason: `This place doesn't have enough Google reviews yet (min ${policy.minReviews}).`,
    };
  }

  if (geo) return evaluatePlaceRegion(policy, geo);
  return { eligible: true };
}
