// Frontend API surface for the consumer-facing place Edge Functions.
//
// Architectural constraints honoured:
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper here calls exactly one Edge Function and never composes
//   multiple Edge Functions (composition belongs inside the function).
//
// Business-side helpers (places autocomplete, create / update / delete
// place, enrichment) live in the business app — consumer never invokes them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { EFError, invokeEF } from "./_invoke";
import { placeRowToDetail } from "@/lib/adapters/place-to-detail";
import type { ResolvedTag } from "@/lib/adapters/place-to-detail";
import type { PlaceDetail } from "@/lib/mock/place";
import type { DiscoveryPredicatesWire } from "@/lib/discovery-filters-wire";

type PlaceListingType = "partner" | "web";
type PlaceStatus = "lead" | "active" | "paused" | "archived";
type FiscalType = "formal" | "informal";
// Place plan keys (public.membership enum): Free (default) + Mesita Partner
// (`plan=pro`) + legacy `ultra` (folds onto Verified). Paid membership runs an
// instant discount at the bill; sold SKU in the business console is Verified.
type PlacePlan = "free" | "pro" | "ultra";

export type Place = {
  /** Server-computed per request (MESITA-1150): a guest gets a discount here
   *  RIGHT NOW. The gate every reward surface reads — `listing_type` is the
   *  stale collapsed enum and no longer decides anything a guest sees. */
  promoting?: boolean | null;
  /** Server-computed per request: this place PAYS Mesita. Independent of
   *  `promoting` — a partner can be paused or running a zero strategy, and a
   *  non-partner never promotes. Computed like `promoting` rather than read
   *  off `listing_type`, which fuses the two and only updates when something
   *  writes the place. Absent ⇒ NOT a partner. */
  partner?: boolean | null;
  id: string;
  slug: string;
  name: string;
  category: string | null;
  /** Super-categories from the EF (MESITA-679); dual-family types list both. */
  family_keys?: string[];
  category_label?: string | null;
  vibe: string | null;
  price_level: number | null;
  // ISO 4217 code from public.places.currency (default "MXN"). Every
  // monetary amount on this place — price ranges, reward caps,
  // future cover charges — is denominated in this currency so the
  // UI can render the right prefix ("MX$", "$", "€") without
  // hard-coding it.
  currency: string;
  listing_type: PlaceListingType;
  status: PlaceStatus;
  fiscal_type: FiscalType;
  plan: PlacePlan;
  lat: number | null;
  lng: number | null;
  address: string | null;
  closes_at: string | null;
  phone: string | null;
  pitch: string | null;
  story: string | null;
  photos: string[];
  // v4 per-class rate columns (PLACE_PUBLIC_COLUMNS ships them; the type
  // under-declared until the ticket wizard needed strategyForPlaceRow on a
  // public place row — MESITA wizard, D9).
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  whatsapp_url: string | null;
  opentable_url: string | null;
  resy_url: string | null;
  uber_eats_url: string | null;
  x_url: string | null;
  threads_url: string | null;
  reddit_url: string | null;
  didi_food_url: string | null;
  google_maps_url: string | null;
  email: string | null;
  created_at: string;

  // ── Overview parity (optional) ────────────────────────────────────
  //
  // The swipe / catalog cards used to show only what's strictly on the
  // places row (name, vibe, category, price_level, closes_at, reward).
  // The "all info on the tinder card too" checkpoint widens that to
  // mirror the place-detail overview grid. Every field below is
  // optional because the recommend-swipe / list-places EFs don't return
  // them yet — the card hides cells when the field is null/undefined,
  // so the contract degrades cleanly until the EF starts populating
  // them (sourced from Google Places + cached on the row).
  google_rating?: number | null;
  google_count?: number | null;
  /** Place's Instagram follower count (read-only signal). */
  instagram_followers_count?: number | null;
  /** Pre-formatted with the currency prefix, e.g. "MX$200–300". */
  price_range?: string | null;
  /** Short relative timestamp like "2 days ago" (server-formatted). */
  last_updated_label?: string | null;
  open_now?: boolean | null;
  opens_at?: string | null;
  distance_km?: number | null;
  zone?: string | null;
  /** Per-visit reward ceiling in the place's currency. */
  reward_cap_mxn?: number | null;
  /**
   * True while Intaker is still building the profile
   * (`projects.content_status` ∈ {queued, generating}). Drives the
   * Enriching chip on swipe / catalog cards — same signal as place detail.
   */
  is_enriching?: boolean;
  /** Catalog-only: Google Nearby hit that is not a Mesita row yet. */
  googleOnly?: boolean;
  /** Alias shipped on Google Nearby stubs (`from_google`). */
  from_google?: boolean;
  // Generic product payload. Menus are carried in products.menu.
  products?: Record<string, unknown> | null;

  // ── Raw EF columns (optional) ─────────────────────────────────────
  //
  // Discover EFs return the full public places projection; these ride on
  // every Place at runtime and feed enrichPlaceOverview / discovery
  // filters. Declared here so call sites don't cast through Record.
  /** Google Places overall stars (source for `google_rating`). */
  google_stars_overall?: number | null;
  /** Google review count (source for `google_count`). */
  google_review_count?: number | null;
  /** Weekly hours jsonb — same shape `computeOpenState` reads. */
  hours?: unknown;
  timezone?: string | null;
  city?: string | null;
  enriched_at?: string | null;
  /** Per-visit promo cap in major currency units (source for `reward_cap_mxn`). */
  monthly_promo_cap?: number | null;
  /** Intaker pipeline status (`queued` / `generating` / `ready` / …). */
  content_status?: string | null;
  /** Consumer Requests count. Requested on the map is count > 0 and not ready. */
  request_count?: number | null;
  google_place_id?: string | null;
};

// Discover surfaces (swipe + catalog) go through dedicated EFs. The deck EF
// ranks the catalog behind the shared signal library (MESITA-1196) and, given
// `predicates`, cuts its pool with the guest's filters BEFORE ranking
// (MESITA-1153) — so a narrow filter searches the catalog instead of thinning a
// slice of it. The helpers below are thin invokers; the selection logic lives
// in the EFs so we can iterate on it without redeploying the web app.
type RecommendDeckInput = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
  /** The guest's four discovery predicates — see lib/discovery-filters-wire. */
  predicates?: DiscoveryPredicatesWire;
};
type RecommendDeckResponse = {
  deck: Place[];
  summary: { candidates: number; embedded: number; intent?: string };
};
export async function apiFetchPublicPlaces(
  client: SupabaseClient,
  limit = 50,
): Promise<Place[]> {
  const { places } = await invokeEF<{ places: Place[] }>(
    client,
    "consumer-web-list-places",
    { limit },
  );
  return places.map(stripInsecurePhotos);
}

export const LIST_PLACES_MAX = 200;
export const CATALOG_NEARBY_MAX = 60;
export const SEARCH_NEARBY_LIMIT = CATALOG_NEARBY_MAX;
export const BBOX_MAX_SPAN_DEG = 0.75;

export type PlacesBbox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type ViewportPlaces = {
  places: Place[];
  overspan: boolean;
  totalInBox: number | null;
  reloadMinKm?: number;
  reloadMinSec?: number;
};

/** Search map catalog: partners, then Mesita, then Google around a camera. */
export async function apiFetchNearbyCatalog(
  client: SupabaseClient,
  center: { lat: number; lng: number },
  limit = CATALOG_NEARBY_MAX,
): Promise<ViewportPlaces> {
  const data = await invokeEF<{
    places: Place[];
    overspan?: boolean;
    totalInBox?: number;
    reloadMinKm?: number;
    reloadMinSec?: number;
  }>(client, "consumer-web-list-places", {
    google: true,
    lat: center.lat,
    lng: center.lng,
    limit,
  });
  return {
    places: (data.places ?? []).map(stripInsecurePhotos),
    overspan: data.overspan === true,
    totalInBox: typeof data.totalInBox === "number" ? data.totalInBox : null,
    reloadMinKm:
      typeof data.reloadMinKm === "number" && Number.isFinite(data.reloadMinKm)
        ? data.reloadMinKm
        : undefined,
    reloadMinSec:
      typeof data.reloadMinSec === "number" && Number.isFinite(data.reloadMinSec)
        ? data.reloadMinSec
        : undefined,
  };
}

/** Listed nearby only — no Google stubs. Mobile Search uses this shape. */
export async function apiFetchNearbyPlaces(
  client: SupabaseClient,
  origin: { lat: number; lng: number },
  limit = SEARCH_NEARBY_LIMIT,
): Promise<Place[]> {
  const { places } = await invokeEF<{ places: Place[] }>(
    client,
    "consumer-web-list-places",
    { lat: origin.lat, lng: origin.lng, limit },
  );
  return (places ?? []).map(stripInsecurePhotos);
}

/** Optional camera rectangle. Search does not use this as the default pool. */
export async function apiFetchPlacesInBbox(
  client: SupabaseClient,
  bbox: PlacesBbox,
  limit = LIST_PLACES_MAX,
): Promise<ViewportPlaces> {
  const data = await invokeEF<{
    places: Place[];
    overspan?: boolean;
    totalInBox?: number;
  }>(client, "consumer-web-list-places", { limit, ...bbox });
  return {
    places: (data.places ?? []).map(stripInsecurePhotos),
    overspan: data.overspan === true,
    totalInBox: typeof data.totalInBox === "number" ? data.totalInBox : null,
  };
}

// Fetch one fully-enriched place (by uuid or slug) and adapt it into the
// rich PlaceDetail shape the detail modal renders. Returns null so the 4
// detail server components can fall back gracefully (redirect to swipe)
// instead of throwing into a 500 — the app has no error boundary. A genuine
// 404 is silent (expected); any other failure (401 expired session, 500 EF
// bug, network) is logged first so it stops masquerading invisibly as a
// deleted place.
export async function apiFetchPlaceDetail(
  client: SupabaseClient,
  idOrSlug: string,
): Promise<PlaceDetail | null> {
  try {
    const { place, tags } = await invokeEF<{
      place: Record<string, unknown>;
      tags?: ResolvedTag[];
    }>(client, "consumer-web-get-place", { id: idOrSlug }, "Place not found");
      return place ? placeRowToDetail(place, tags) : null;
  } catch (err) {
    if (!(err instanceof EFError && err.status === 404)) {
      console.error(
        `[apiFetchPlaceDetail] consumer-get-place failed for "${idOrSlug}":`,
        err,
      );
    }
    return null;
  }
}

export type PlaceRequestResult = {
  request_count: number;
  request_threshold: number;
  requested: boolean;
  is_profile_ready: boolean;
  request_lifecycle: "listed" | "requested" | "enriched";
  enrichment_triggered: boolean;
};

export async function apiRequestPlace(
  client: SupabaseClient,
  placeId: string,
): Promise<PlaceRequestResult> {
  return invokeEF<PlaceRequestResult>(
    client,
    "consumer-web-request-place",
    { placeId },
  );
}
export async function apiRecommendDeck(
  client: SupabaseClient,
  input: RecommendDeckInput = {},
): Promise<RecommendDeckResponse> {
  const data = await invokeEF<RecommendDeckResponse>(
    client,
    "consumer-web-recommend-swipe",
    input,
  );
  return { deck: data.deck.map(stripInsecurePhotos), summary: data.summary };
}

// Per-row status mirrored from atlas-suggest-places. Drives the badge
// in the consumer search picker:
//   - not_in_mesita: Google has it, Mesita doesn't — show "Not on
//     Mesita yet" + nudge users to ping us.
//   - web_listed: Mesita has a web-listed (unclaimed) entry — show
//     "Listed · unclaimed" so consumers know they can still see the
//     basic profile.
//   - verified_partner_other: A claimed partner row — primary CTA.
//   - verified_partner_self: The caller owns this place.
type PlacePredictionStatus =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: PlacePredictionStatus;
  /** True when the place PAYS Mesita (plan, not strategy). Google-only is false. */
  partner?: boolean;
  // Forward-compatible Mesita identity: consumer-suggest-places is adding
  // these to its payload for on-Mesita rows. When present, clients navigate
  // via placeHref(slug ?? id) directly instead of the fuzzy name join.
  mesitaId?: string;
  mesitaSlug?: string;
  lat?: number | null;
  lng?: number | null;
};

export type SuggestPlacesMode = "fast" | "deep";

/**
 * Name search for the consumer /search bar and pickers.
 * Fast (default) = Autocomplete. Deep = Partners · Mesita · Google.
 */
export async function apiSuggestPlaces(
  client: SupabaseClient,
  input: string,
  sessionToken: string,
  origin?: { lat: number; lng: number } | null,
  country?: string | null,
  mode: SuggestPlacesMode = "fast",
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];
  const { predictions } = await invokeEF<{ predictions: PlacePrediction[] }>(
    client,
    "consumer-web-suggest-places",
    {
      input: trimmed,
      sessionToken,
      mode,
      ...(origin
        ? { lat: origin.lat, lng: origin.lng }
        : {}),
      ...(country ? { country } : {}),
    },
  );
  return predictions;
}

export type CatalogRail = {
  key: string;
  label: string;
  source: "seed" | "generated";
  places: Place[];
};

/** Home Catalog rails — one EF, Atlas seeds + vibe-query Mesita search. */
export async function apiListCatalog(
  client: SupabaseClient,
  origin?: { lat: number; lng: number } | null,
): Promise<CatalogRail[]> {
  const data = await invokeEF<{ rails: CatalogRail[] }>(
    client,
    "consumer-web-list-catalog",
    origin ? { lat: origin.lat, lng: origin.lng } : {},
  );
  return (data.rails ?? []).map((rail) => ({
    ...rail,
    places: (rail.places ?? []).map((place) =>
      stripInsecurePhotos({
        ...place,
        photos: Array.isArray(place.photos) ? place.photos : [],
      }),
    ),
  }));
}

// Legacy rows may carry http:// photos. Next.js Image rejects them and
// would crash the whole page; filter to https before render.
function stripInsecurePhotos<T extends { photos: string[] }>(v: T): T {
  return { ...v, photos: v.photos.filter((p) => p.startsWith("https://")) };
}
