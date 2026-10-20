// Frontend API surface for the consumer-facing place Edge Functions.
//
// Architectural constraints honoured:
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper here calls exactly one Edge Function and never composes
//   multiple Edge Functions (composition belongs inside the function).

import type { SupabaseClient } from "@supabase/supabase-js";
import { EFError, invokeEF } from "./_invoke";
import { placeRowToDetail } from "@/lib/adapters/place-to-detail";
import type { ResolvedTag } from "@/lib/adapters/place-to-detail";
import type { PlaceDetail } from "@/lib/place-detail";

export type Place = {
  /** Server's answer: did an Enrich run complete (`enriched_at` set,
   *  MESITA-2154)? Drives the Enriched colour and the Enriched ring. Absent
   *  on an older payload — the client falls back to `enriched_at` alone
   *  (lib/place-enriched.ts), never `content_state`. */
  enriched?: boolean | null;
  id: string;
  slug: string;
  name: string;
  category: string | null;
  /** Family from the EF. Exactly one when classified. */
  family_keys?: string[];
  category_label?: string | null;
  price_level: number | null;
  // ISO 4217 code from public.places.currency (default "MXN"). Every
  // monetary amount on this place — price ranges, future cover charges —
  // is denominated in this currency so the UI can render the right prefix
  // ("MX$", "$", "€") without hard-coding it.
  currency: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  closes_at: string | null;
  phone: string | null;
  pitch: string | null;
  story: string | null;
  photos: string[];
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
  created_at: string;

  // ── Overview parity (optional) ────────────────────────────────────
  //
  // The catalog cards used to show only what's strictly on the
  // places row (name, category, price_level, closes_at).
  // The "all info on the card too" checkpoint widens that to
  // mirror the place-detail overview grid. Every field below is
  // optional because the list-catalog / list-places EFs don't return
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
  /**
   * True while Enricher is still building the profile
   * (`places.content_state` = generating). Drives the
   * Enriching chip on swipe / catalog cards — same signal as place detail.
   */
  is_enriching?: boolean;
  /** Catalog-only: Google Nearby hit that is not a Mesita row yet. */
  googleOnly?: boolean;
  /** The Area pipeline's breakdown for this place, computed by the server
   *  (MESITA-2379); only the one-pool Feed wire carries it. */
  area?: AreaDiagnostics;
  /** Alias shipped on Google Nearby stubs (`from_google`). */
  from_google?: boolean;
  // Generic product payload. Menus are carried in products.menu.
  products?: Record<string, unknown> | null;
  /** Guest Reserve CTA. Absent or true offers Reserve; false = Not / walk-in. */
  reservations_enabled?: boolean | null;

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
  /** Enricher pipeline state (`generating` / `ready` / `failed`). */
  content_state?: string | null;
  /** Consumer Requests count. Requested is count > 0 and not enriched. */
  request_count?: number | null;
  google_place_id?: string | null;
};

// Discover surfaces (the Search map, Home's Feed) go through dedicated EFs.
// The helpers below are thin invokers; the selection logic lives in the EFs
// (the Area pipeline) so we can iterate on it without redeploying the web app.
/** The wire word for a Places scope (MESITA-2298): Google Places or Mesita
 *  Selected. The server also reads the retired `enriched`/`mesita` words. */

type ViewportPlaces = {
  places: Place[];
  reloadMinKm?: number;
  reloadMinSec?: number;
};

/**
 * Search map catalog: the Area pool around a camera, inside the operator's
 * radius (MESITA-2379: Google and Mesita places in one ranked set; the
 * guest never picks a source).
 *
 * Web Search posts Families and Near/Popular (MESITA-2425); it never posts a radius
 * (operator `map.radiusKm`) or a count (operator `map.mesitaPlaces`, one
 * Google call per load). `google: true` is web Search saying it CAN render
 * a Google-only stub, and the EF refuses a call without it (MESITA-2337).
 */
export async function apiFetchNearbyCatalog(
  client: SupabaseClient,
  center: { lat: number; lng: number },
  familyKeys: readonly string[] = [],
  prefer: AreaPrefer = "near",
): Promise<ViewportPlaces> {
  const data = await invokeEF<{
    places: Place[];
    reloadMinKm?: number;
    reloadMinSec?: number;
  }>(client, "consumer-web-list-places", {
    google: true,
    familyKeys: [...familyKeys],
    prefer,
    lat: center.lat,
    lng: center.lng,
  });
  return {
    places: (data.places ?? []).map(stripInsecurePhotos),
    reloadMinKm:
      typeof data.reloadMinKm === "number" && Number.isFinite(data.reloadMinKm)
        ? data.reloadMinKm
        : undefined,
    reloadMinSec:
      typeof data.reloadMinSec === "number" &&
      Number.isFinite(data.reloadMinSec)
        ? data.reloadMinSec
        : undefined,
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

type PlaceRequestResult = {
  request_count: number;
  request_threshold: number;
  requested: boolean;
  is_profile_ready: boolean;
  is_enriched: boolean;
  request_lifecycle: "listed" | "requested" | "enriched";
  enrichment_triggered: boolean;
};

export async function apiRequestPlace(
  client: SupabaseClient,
  placeId: string,
): Promise<PlaceRequestResult> {
  return invokeEF<PlaceRequestResult>(client, "consumer-web-request-place", {
    placeId,
  });
}
/** The server's Area breakdown for one place (MESITA-2379). `null` is
 *  "n/a", never 0; the client never recomputes any of it. */
export type AreaDiagnostics = {
  /** The families the Family gate read, primary first. */
  familyKeys: string[];
  /** The place's primary family (MESITA-2438); absent from an older EF. */
  primaryFamily?: string | null;
  gates: {
    family: 0 | 1;
    territory: 0 | 1 | null;
    radius: 0 | 1 | null;
    active: 1;
    ready: 1 | null;
    reviews: 1 | null;
  };
  signals: { proximity: number | null; popularity: number | null };
  selected: number;
  source: "selected" | "mesita" | "google";
  /** The mode's exponents (MESITA-2428); absent from an older EF. */
  weights?: { proximity: number; popularity: number };
  base: number;
  final: number;
  formula: "point" | "area" | "none";
};

/** The guest's mode on the wire (MESITA-2428): near is Nearby. */
export type AreaPrefer = "near" | "popular" | "family";

/** Where Places searches from: a point, or a saved area's rectangle. */
export type AreaOrigin = {
  lat: number;
  lng: number;
  bounds?: {
    low: { lat: number; lng: number };
    high: { lat: number; lng: number };
  };
};

/** The Feed's answer: the one ranked pool, or — from an Edge Function that
 *  predates MESITA-2379 — the old rails. */
export type AreaPool =
  | { shape: "unified"; kind: "point" | "area" | "none"; places: Place[] }
  | { shape: "legacy"; rails: CatalogRail[] };

function cleanPlace(place: Place): Place {
  return stripInsecurePhotos({
    ...place,
    photos: Array.isArray(place.photos) ? place.photos : [],
  });
}

/**
 * Places' one ranked Area pool (MESITA-2384): Google and Mesita places the
 * server merged, scored and ranked; the client pages it in the server's
 * order. `familyKeys` is a family row's question (MESITA-2438): the server
 * asks Google for that family's full type list and lists its primary
 * places first. None = every family. A legacy rails answer is passed
 * through so the screen can still draw it.
 */
export async function apiListAreaPool(
  client: SupabaseClient,
  origin: AreaOrigin | null,
  prefer: AreaPrefer = "near",
  familyKeys: readonly string[] = [],
): Promise<AreaPool> {
  const data = await invokeEF<{
    places?: Place[];
    location?: { kind?: "point" | "area" | "none" };
    rails?: CatalogRail[];
  }>(client, "consumer-web-list-catalog", {
    unified: true,
    prefer,
    ...(familyKeys.length > 0 ? { familyKeys: [...familyKeys] } : {}),
    ...(origin
      ? {
          lat: origin.lat,
          lng: origin.lng,
          google: true,
          ...(origin.bounds ? { bounds: origin.bounds } : {}),
        }
      : {}),
  });
  if (Array.isArray(data.places)) {
    return {
      shape: "unified",
      kind: data.location?.kind ?? (origin ? "point" : "none"),
      places: data.places.map(cleanPlace),
    };
  }
  return {
    shape: "legacy",
    rails: (data.rails ?? []).map((rail) => ({
      ...rail,
      places: (rail.places ?? []).map(cleanPlace),
    })),
  };
}

export type CatalogRail = {
  key: string;
  label: string;
  emoji?: string;
  source: "signal" | "family" | "seed" | "generated";
  places: Place[];
};

// Per-row state mirrored from atlas-suggest-places — the server's words,
// kept verbatim because they are the wire:
//   - not_in_mesita: Google has it, Mesita doesn't — show "Not on
//     Mesita yet" + nudge users to ping us.
//   - web_listed: Mesita has an unclaimed entry — the basic profile is there.
//   - verified_partner_other / verified_partner_self: a claimed row (the
//     caller's own, in the second case). This app reads neither apart.
type PlacePredictionState =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  state: PlacePredictionState;
  /** A Google-only Text Search row's card, the same stub Nearby sends
   *  (MESITA-2325): readable type, price, stars, open now, links. */
  card?: Partial<Place>;
  /** Server's answer: did an Enrich run complete (`enriched_at` set)? No
   *  column fallback on this lane, so an older payload reads as
   *  not-enriched (gray understates). */
  enriched?: boolean;
  /**
   * Word's second entity (MESITA-1403). Absent = "place" — a place row
   * reads exactly as before. A Location is a region/city from
   * Autocomplete: no membership, no mesitaId, and no coordinates until
   * the anchor resolve on pick (apiResolveLocationAnchor).
   */
  kind?: "place" | "location";
  /** Most specific Google type on a Location row (e.g. "locality"). */
  locationType?: string;
  // Forward-compatible Mesita identity: consumer-suggest-places is adding
  // these to its payload for on-Mesita rows. When present, clients navigate
  // via placeHref(slug ?? id) directly instead of the fuzzy name join.
  mesitaId?: string;
  mesitaSlug?: string;
  lat?: number | null;
  lng?: number | null;
};

/** `fast` Search while typing · `deep` Search after idle. */
type SuggestPlacesMode = "fast" | "deep";

/**
 * Name search for the consumer /search bar and pickers.
 * Fast (default) = Autocomplete. Deep = Mesita · Google.
 * Map Filters never ride this call — power and Family are map-only.
 * Country is always Any: Autocomplete and Text Search do not take a region.
 */
export async function apiSuggestPlaces(
  client: SupabaseClient,
  input: string,
  sessionToken: string,
  origin?: { lat: number; lng: number } | null,
  mode: SuggestPlacesMode = "fast",
): Promise<PlacePrediction[]> {
  const { predictions } = await apiSuggestPlacesWithIdle(
    client,
    input,
    sessionToken,
    origin,
    mode,
  );
  return predictions;
}

/** The same call, plus Word's idle seconds from Discovery › Word
 *  (`name.idleSec`, MESITA-2322): the bar waits that long before it
 *  searches. Null when the EF did not say (an older EF). */
export async function apiSuggestPlacesWithIdle(
  client: SupabaseClient,
  input: string,
  sessionToken: string,
  origin?: { lat: number; lng: number } | null,
  mode: SuggestPlacesMode = "fast",
): Promise<{ predictions: PlacePrediction[]; idleSec: number | null }> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return { predictions: [], idleSec: null };
  const data = await invokeEF<{
    predictions: PlacePrediction[];
    idleSec?: unknown;
  }>(client, "consumer-web-suggest-places", {
    input: trimmed,
    sessionToken,
    mode,
    ...(origin ? { lat: origin.lat, lng: origin.lng } : {}),
  });
  const idle =
    typeof data.idleSec === "number" && Number.isFinite(data.idleSec)
      ? data.idleSec
      : null;
  return { predictions: data.predictions ?? [], idleSec: idle };
}

// Legacy rows may carry http:// photos. Next.js Image rejects them and
// would crash the whole page; filter to https before render. A Google
// photoUri (https://lh3.googleusercontent.com/…) passes.
export function stripInsecurePhotos<T extends { photos: string[] }>(v: T): T {
  return { ...v, photos: v.photos.filter((p) => p.startsWith("https://")) };
}
