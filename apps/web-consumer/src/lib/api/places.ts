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
  /** Mesita Premier (MESITA-2925, the paid tier since MESITA-2789):
   *  `places.boost_tier`, 0 none · 1 2X · 2 5X · 3 10X. Above 0 the name
   *  wears "Premier 2X" and the pin is red. Absent on an older payload
   *  reads as not Premier. */
  boost_tier?: number | null;
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
  /** A Google listing that is not a Mesita row yet (the bar's Google pick). */
  googleOnly?: boolean;
  /** The Area pipeline's breakdown for this place, computed by the server
   *  (MESITA-2379); only the one-pool Feed wire carries it. */
  area?: AreaDiagnostics;
  /** The Search map's score for this place (MESITA-2504 debug): the two
   *  signals, the sources that found it and the product. Only list-places
   *  sends it. */
  score?: MapScore;
  /** Alias shipped on Google-only stubs (`from_google`). */
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

/** One Search map place's score (MESITA-2504). `null` is "n/a", never 0. */
export type MapScore = {
  proximity: number | null;
  popularity: number | null;
  final: number;
  /** The factor `final` carries: Premier's tier number (2 · 5 · 10) for an
   *  Premier place, else 1 (MESITA-2925; the wire keeps the Selected-era
   *  name). Absent from an older EF. */
  selectedFactor?: number;
  /** The sources that found the place (MESITA-2703); diagnostics only. */
  foundBy?: string[];
  /** Km from the anchor and the Distance penalty k Proximity read
   *  (MESITA-2830); absent from an older EF. */
  distanceKm?: number | null;
  distancePenalty?: number;
};

type ViewportPlaces = {
  places: Place[];
  /** The circle the server gated on (km): the screen's, else the
   *  operator's (MESITA-2504). */
  radiusKm?: number;
  reloadMinKm?: number;
  reloadMinSec?: number;
  /** Seconds the map must be still before a guest move reloads it
   *  (MESITA-2440). The client defaults to 1.5 s until the EF sends it. */
  reloadIdleSec?: number;
  /** Min share of the last-reload screen a guest move must cover (MESITA-2732). */
  reloadMinViewportPct?: number;
};

/** The visible map, as the EF's `bounds` reads it (MESITA-2499). */
export type MapBounds = {
  low: { lat: number; lng: number };
  high: { lat: number; lng: number };
};

/**
 * Search map catalog: the Area pool on the visible map, best first
 * (MESITA-2499; MESITA-2379: Google and Mesita places in one ranked set;
 * the guest never picks a source).
 *
 * Web Search posts the camera centre, the visible `bounds` and Families;
 * the zoom decides how wide the set is. No bounds (or a box the EF finds
 * too wide) falls back to the centre inside the operator's `map.radiusKm`.
 * It never posts a count (the operator's four Area sources decide; at most two Google calls per
 * load). `google: true` is web Search saying it CAN render a Google-only
 * stub, and the EF refuses a call without it (MESITA-2337).
 */
export async function apiFetchNearbyCatalog(
  client: SupabaseClient,
  center: { lat: number; lng: number },
  bounds: MapBounds | null,
  familyKeys: readonly string[] = [],
): Promise<ViewportPlaces> {
  const data = await invokeEF<{
    places: Place[];
    radiusKm?: number;
    reloadMinKm?: number;
    reloadMinSec?: number;
    reloadIdleSec?: number;
    reloadMinViewportPct?: number;
  }>(client, "consumer-web-list-places", {
    google: true,
    familyKeys: [...familyKeys],
    lat: center.lat,
    lng: center.lng,
    ...(bounds ? { bounds } : {}),
  });
  return {
    places: (data.places ?? []).map(stripInsecurePhotos),
    radiusKm:
      typeof data.radiusKm === "number" && Number.isFinite(data.radiusKm)
        ? data.radiusKm
        : undefined,
    reloadMinKm:
      typeof data.reloadMinKm === "number" && Number.isFinite(data.reloadMinKm)
        ? data.reloadMinKm
        : undefined,
    reloadMinSec:
      typeof data.reloadMinSec === "number" &&
      Number.isFinite(data.reloadMinSec)
        ? data.reloadMinSec
        : undefined,
    reloadIdleSec:
      typeof data.reloadIdleSec === "number" &&
      Number.isFinite(data.reloadIdleSec)
        ? data.reloadIdleSec
        : undefined,
    reloadMinViewportPct:
      typeof data.reloadMinViewportPct === "number" &&
      Number.isFinite(data.reloadMinViewportPct)
        ? data.reloadMinViewportPct
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

/** One place as a list card (MESITA-2683): the row consumer-web-get-place
 *  returns, for a list swapping a just-created place's Google card for it.
 *  Null when the place cannot be read; a list then keeps the card it has. */
export async function apiFetchPlaceCard(
  client: SupabaseClient,
  id: string,
): Promise<Place | null> {
  try {
    const { place } = await invokeEF<{ place?: Place }>(
      client,
      "consumer-web-get-place",
      { id },
      "Place not found",
    );
    return place ? cleanPlace(place) : null;
  } catch (err) {
    if (!(err instanceof EFError && err.status === 404)) {
      console.error(`[apiFetchPlaceCard] consumer-get-place failed for "${id}":`, err);
    }
    return null;
  }
}

/** The server's Area breakdown for one place (MESITA-2379). `null` is
 *  "n/a", never 0; the client never recomputes any of it. */
export type AreaDiagnostics = {
  /** The families the Family gate read: a list, none primary (MESITA-2808). */
  familyKeys: string[];
  gates: {
    family: 0 | 1;
    /** Territory is gone (MESITA-2500, MESITA-2603): Radius is the only
     *  location gate. */
    radius: 0 | 1 | null;
    active: 1;
    ready: 1 | null;
    reviews: 1 | null;
    /** The Popularity floor (MESITA-2714); null = off, absent = older EF. */
    popularity?: 0 | 1 | null;
  };
  signals: { proximity: number | null; popularity: number | null };
  /** Where the card came from; diagnostics and events only. `selected`
   *  died with the operator's mark (MESITA-2925). */
  source: "mesita" | "google";
  /** The factor `final` carries: Premier's tier number (2 · 5 · 10) for an
   *  Premier place, else 1 (MESITA-2925; the wire keeps the Selected-era
   *  name). Absent from an older EF. */
  selectedFactor?: number;
  /** The sources that found the place (MESITA-2703); diagnostics only,
   *  no card draws it. */
  foundBy?: string[];
  /** Km from the anchor and the Distance penalty k (MESITA-2830); absent
   *  from an older EF. */
  distanceKm?: number | null;
  distancePenalty?: number;
  final: number;
  formula: "point" | "none";
};

/** Where Places ranks from: always a point (MESITA-2501) — the device, a
 *  confirmed saved pin, or the city's centre. No radius (MESITA-2914). */
export type AreaOrigin = { lat: number; lng: number };

/** Home's ranked Catalog (MESITA-2379, the Catalog pipeline since
 *  MESITA-2909): every Mesita place, best first. */
export type AreaPool = {
  kind: "point" | "none";
  places: Place[];
  /** Tiles per page, the operator's `map.catalogPageSize` (MESITA-2909). */
  pageSize?: number;
};

function cleanPlace(place: Place): Place {
  return stripInsecurePhotos({
    ...place,
    photos: Array.isArray(place.photos) ? place.photos : [],
  });
}

/**
 * Places' Catalog (MESITA-2384, MESITA-2909): every Mesita place the server
 * scored and ranked, Proximity × Popularity from `origin`, with no radius;
 * the client pages it in the server's order by the server's `pageSize`.
 * `familyKeys` is a family row's question (MESITA-2438). None = every
 * family. No `prefer`.
 */
export async function apiListAreaPool(
  client: SupabaseClient,
  origin: AreaOrigin | null,
  familyKeys: readonly string[] = [],
): Promise<AreaPool> {
  const data = await invokeEF<{
    places?: Place[];
    location?: { kind?: "point" | "none" };
    pageSize?: number;
  }>(client, "consumer-web-list-catalog", {
    unified: true,
    ...(familyKeys.length > 0 ? { familyKeys: [...familyKeys] } : {}),
    // The point only scores: the Catalog has no radius (MESITA-2909).
    ...(origin ? { lat: origin.lat, lng: origin.lng, google: true } : {}),
  });
  const size = data.pageSize;
  return {
    kind: data.location?.kind ?? (origin ? "point" : "none"),
    places: (data.places ?? []).map(cleanPlace),
    ...(typeof size === "number" && Number.isFinite(size) && size > 0 ? { pageSize: size } : {}),
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
  /** The row's card (MESITA-2678): on a Google-only row the stub Text Search
   *  sends (MESITA-2325: readable type, price, stars, open now, links), on a
   *  Mesita row the place's own catalog card. */
  card?: Partial<Place>;
  /** Server's answer: did an Enrich run complete (`enriched_at` set)? No
   *  column fallback on this lane, so an older payload reads as
   *  not-enriched (gray understates). */
  enriched?: boolean;
  /** Server's answer: the place's Premier tier, `places.boost_tier`
   *  (MESITA-2925), 0..3; above 0 the pin is red. An older payload without
   *  it (here or on `card`) reads as not Premier (gray understates). */
  boost_tier?: number | null;
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
  /** A Google-only place under the Area box's Minimum Popularity
   *  (MESITA-2849). The bar lists it last (MESITA-2724); a pick of it is a
   *  destination — camera and Area reload land there — and never card ONE,
   *  since the Area pipeline hides every place under that floor. Absent on
   *  Mesita rows, Locations and an older EF. */
  underFloor?: boolean;
};

/** `fast` Autocomplete · `deep` Autocomplete + Text Search, the Search
 *  tab's bar. Google's name is canonical (MESITA-2896): the Mesita Name
 *  mode (`mesita`, MESITA-2883) is gone. */
type SuggestPlacesMode = "fast" | "deep";

/**
 * Name search for the consumer /search bar and pickers.
 * Fast (default) = Autocomplete. Deep = Autocomplete + Text Search.
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
export function stripInsecurePhotos<T extends { photos?: string[] | null }>(
  v: T,
): Omit<T, "photos"> & { photos: string[] } {
  const photos = Array.isArray(v.photos) ? v.photos : [];
  return { ...v, photos: photos.filter((p) => p.startsWith("https://")) };
}
