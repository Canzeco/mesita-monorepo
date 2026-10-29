// THE NAME PIPELINE'S GOOGLE I/O (MESITA-2987, split out of name-pipeline.ts):
// the two Google calls the Name pipeline makes (Autocomplete, Text Search),
// the classifiers that read their rows, and the stamp that resolves a Google
// hit onto the Mesita row holding the same google_place_id. The pipeline's
// order, merge and wire stay in name-pipeline.ts.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  classifyGoogleError,
  friendlyGoogleError,
  GOOGLE_PLACES_AUTOCOMPLETE_URL,
  GOOGLE_PLACES_TEXT_SEARCH_URL,
  stripPlacesPrefix,
} from "./google-places.ts";
import { googleFetch } from "./google-fetch.ts";
import {
  applyPlacesAutocompleteRegion,
  applyPlacesTextSearchRegion,
} from "./sourcing.ts";
import type { GeneralConfig, MapConfig } from "./discovery-config.ts";
import { clearsGeneralGate } from "./discovery-general-gate.ts";
import { evaluatePlaceForMap } from "./map-engine.ts";
import {
  isEnrichedPlace,
  type PlaceCategoryRow,
  withFamilyKeysList,
} from "./place-family-keys.ts";
import { PLACE_CARD_COLUMNS } from "./place-columns.ts";
import {
  fetchPlaceListing,
  type GoogleHit,
  googleHitFromPlace,
  type GooglePlaceListing,
  LISTING_FIELD_MASK,
} from "./google-listing.ts";
import { googleStub } from "./google-stub.ts";
import type { LaneItem, LaneKind } from "./name-pipeline.ts";
import { errorMessage } from "./errors.ts";

export const GOOGLE_TEXT_MAX = 20;

// Autocomplete (New) marks regions, cities and areas with these types.
// administrative_area_level_* matches by prefix. An establishment marker
// wins outright: a place carries "establishment"/"point_of_interest" next
// to its specific types, while a locality is political/geocode-family only.
const LOCATION_TYPE_MARKERS = new Set([
  "locality",
  "postal_code",
  "political",
  "geocode",
]);
const ESTABLISHMENT_TYPE_MARKERS = new Set([
  "establishment",
  "point_of_interest",
]);

/**
 * Classify an Autocomplete row from the `types` the response already
 * carries — never a Details call while typing. Missing/empty types read
 * as "place", so an unexpected payload behaves exactly as today.
 */
export function classifyPredictionKind(
  types?: readonly string[] | null,
): LaneKind {
  if (!Array.isArray(types) || types.length === 0) return "place";
  let location = false;
  for (const t of types) {
    if (ESTABLISHMENT_TYPE_MARKERS.has(t)) return "place";
    if (
      LOCATION_TYPE_MARKERS.has(t) ||
      t.startsWith("administrative_area_level_")
    ) {
      location = true;
    }
  }
  return location ? "location" : "place";
}

/**
 * What a Google-only row becomes after the Map gate: a Place when it
 * clears, a Location when it fails on its type alone and the caller takes
 * Locations (MESITA-2778), else nothing.
 */
export function gatedGoogleKind(
  gate: { eligible: boolean; code?: string },
  locations: boolean,
): LaneKind | null {
  if (gate.eligible) return "place";
  if (locations && gate.code === "family_not_eligible") return "location";
  return null;
}

/**
 * Display type for a Location row: the most specific type. Google orders
 * most-specific first; "political"/"geocode" are blanket markers, so the
 * first type outside them names the entity ("locality", "neighborhood").
 */
export function locationTypeOf(
  types?: readonly string[] | null,
): string | undefined {
  if (!Array.isArray(types) || types.length === 0) return undefined;
  for (const t of types) {
    if (t !== "political" && t !== "geocode") return t;
  }
  return types[0];
}

export type ListedRow = {
  id: string;
  slug: string;
  google_place_id: string | null;
  name: string | null;
  /** Google's own label (MESITA-2828): Search's alias of the Mesita name. */
  google_name?: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  content_state: string | null;
  enriched_at: string | null;
  /** Premier's paid tier, 0..3 (MESITA-2925). */
  boost_tier?: number | null;
  business_state: string | null;
  google_review_count: number | null;
  google_stars_overall?: number | null;
  family_keys?: string[] | null;
  /** The About, read only for the few hits `nameGooglePlaces` returns. */
  description?: string | null;
};

/** A stored `boost_tier` as Premier's tier, 0..3; anything else reads 0. */
export function premierTier(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(Math.trunc(v), 0), 3) : 0;
}

function listedToLane(row: ListedRow): LaneItem | null {
  const gid = row.google_place_id?.trim();
  if (!gid && !row.id) return null;
  return {
    placeId: gid ?? "",
    // Mesita display name (`places.name`), never the raw google_name column.
    mainText: String(row.name ?? ""),
    secondaryText: row.address ?? "",
    state: "web_listed",
    // Membership colour is the SERVER's answer on this lane too, so the
    // list dot and the map pin cannot disagree (Pato, 2026-08-29).
    // `enriched_at` set (MESITA-2154): a Created row reads gray here.
    enriched: isEnrichedPlace(row),
    // The Premier tag (MESITA-2925): the paid tier, never `enriched_at`.
    premierTier: premierTier(row.boost_tier),
    mesitaId: row.id,
    mesitaSlug: row.slug,
    lat: row.lat,
    lng: row.lng,
    businessStatus: row.business_state,
    reviewCount: row.google_review_count,
  };
}

/**
 * After a Google candidate resolves to a catalog row, the entity is Mesita's.
 * Label with `places.name`, not the Autocomplete / Text Search string.
 */
export function applyResolvedMesitaName(
  item: LaneItem,
  mesita: LaneItem,
): LaneItem {
  return {
    ...item,
    state: mesita.state,
    // The entity is Mesita's now, so its enrichment fact and its Premier
    // tier travel with it.
    enriched: mesita.enriched,
    premierTier: mesita.premierTier,
    mesitaId: mesita.mesitaId,
    mesitaSlug: mesita.mesitaSlug,
    lat: item.lat ?? mesita.lat,
    lng: item.lng ?? mesita.lng,
    mainText: mesita.mainText || item.mainText,
    secondaryText: mesita.secondaryText || item.secondaryText,
    // The entity is Mesita's now, so its State-box facts are the ones
    // Discovery > General judges — the operator's Active beats Google's.
    businessStatus: mesita.businessStatus ?? item.businessStatus ?? null,
    reviewCount: mesita.reviewCount ?? item.reviewCount ?? null,
  };
}

/** The columns a Google hit resolves onto: a Mesita row's lane fields and
 *  the Discovery › General inputs. */
export const LISTED_COLUMNS =
  "id, slug, google_place_id, name, google_name, address, lat, lng, content_state, enriched_at, boost_tier, business_state, google_review_count, google_stars_overall, family_keys";

// A network failure or an unreadable body is an error envelope like any
// Google error, never a throw: in fast mode a throw escaped the handler as a
// CORS-less 500, and in deep mode it rejected the whole Promise.all even
// though Deep treats a failed Autocomplete lane as empty (MESITA-2855).
export async function fetchAutocomplete(
  input: string,
  sessionToken: string,
  apiKey: string,
  origin: { lat: number; lng: number } | null,
): Promise<{ predictions: LaneItem[]; errorEnvelope?: Record<string, unknown> }> {
  const body: Record<string, unknown> = { input, sessionToken };
  applyPlacesAutocompleteRegion(body, origin);
  let r: Response;
  let data: {
    suggestions?: Array<{
      placePrediction?: {
        placeId: string;
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
        text?: { text?: string };
        types?: string[];
      };
    }>;
  };
  try {
    r = await googleFetch(GOOGLE_PLACES_AUTOCOMPLETE_URL, { apiKey, body });
    if (!r.ok) {
      const text = await r.text();
      const code = classifyGoogleError(r.status, text);
      return {
        predictions: [],
        errorEnvelope: {
          ok: false,
          code,
          error: friendlyGoogleError(code, r.status, text),
          httpStatus: r.status,
        },
      };
    }
    data = await r.json();
  } catch (err) {
    console.error(
      "[name-pipeline] autocomplete unreachable:",
      errorMessage(err),
    );
    return {
      predictions: [],
      errorEnvelope: {
        ok: false,
        code: "google_unreachable",
        error: "Search is unavailable right now. Try again.",
      },
    };
  }
  const predictions = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map<LaneItem>((p) => {
      const kind = classifyPredictionKind(p.types);
      return {
        placeId: stripPlacesPrefix(p.placeId),
        mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
        state: "not_in_mesita",
        ...(kind === "location"
          ? { kind, locationType: locationTypeOf(p.types) }
          : {}),
      };
    })
    .filter((p) => p.placeId && p.mainText);
  return { predictions };
}

export async function fetchTextSearch(
  input: string,
  apiKey: string,
  gate: MapConfig,
  origin: { lat: number; lng: number } | null,
  limit: number,
  locations = false,
  seen?: Map<string, GoogleHit>,
): Promise<LaneItem[]> {
  const body: Record<string, unknown> = {
    textQuery: input,
    maxResultCount: Math.min(GOOGLE_TEXT_MAX, Math.max(1, limit)),
  };
  applyPlacesTextSearchRegion(body, origin);
  let r: Response;
  try {
    r = await googleFetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
      apiKey,
      // The listing mask (MESITA-2325): Text Search bills the same
      // Pro/Enterprise tiers, and `rating` already puts the call on
      // Enterprise, so the card's other fields add no spend.
      fieldMask: LISTING_FIELD_MASK,
      body,
    });
  } catch (err) {
    console.error(
      "[name-pipeline] text search threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
  if (!r.ok) {
    const t = await r.text();
    console.error(
      "[name-pipeline] text search:",
      friendlyGoogleError(classifyGoogleError(r.status, t), r.status, t),
    );
    return [];
  }
  let data: { places?: GooglePlaceListing[] };
  try {
    data = await r.json();
  } catch (err) {
    console.error(
      "[name-pipeline] text search body:",
      errorMessage(err),
    );
    return [];
  }
  const out: LaneItem[] = [];
  for (const p of data.places ?? []) {
    const hit = googleHitFromPlace(p);
    if (!hit.placeId || !hit.name) continue;
    seen?.set(hit.placeId, hit);
    const kind = gatedGoogleKind(
      evaluatePlaceForMap(gate, {
        primaryType: hit.primaryType,
        rating: hit.rating,
        reviewCount: hit.reviewCount,
      }),
      locations,
    );
    if (!kind) continue;
    if (kind === "location") {
      out.push({
        placeId: hit.placeId,
        mainText: hit.name,
        secondaryText: hit.address,
        state: "not_in_mesita",
        kind,
        locationType: hit.primaryType ?? undefined,
        lat: hit.lat,
        lng: hit.lng,
        businessStatus: hit.businessStatus,
      });
      if (out.length >= limit) break;
      continue;
    }
    out.push({
      placeId: hit.placeId,
      mainText: hit.name,
      secondaryText: hit.address,
      state: "not_in_mesita",
      lat: hit.lat,
      lng: hit.lng,
      businessStatus: hit.businessStatus,
      reviewCount: hit.reviewCount,
      rating: hit.rating,
      // The same Google-only card Text Search sends, so a typed pick opens a
      // draft as rich as a Feed card's (MESITA-2325).
      card: googleStub(hit, null),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Which Google-only rows pay a Place Details call (MESITA-2881). Details
 * bills ~$20/1k on this mask, and a search used to fire one per row, in
 * parallel, for every row Autocomplete returned. Now a row whose listing the
 * same request already bought (Deep's Text Search) reuses it, and Details
 * runs only for the first `cap` rows left: the lane shows at most `cap`, so a
 * row past it was paid for and cut. A row past the cap carries no listing and
 * drops, as a failed Details call always did.
 */
export function detailsTargets(
  ids: string[],
  known: Map<string, GoogleHit> | undefined,
  cap: number,
): { reused: Map<string, GoogleHit>; fetch: string[] } {
  const reused = new Map<string, GoogleHit>();
  const fetch: string[] = [];
  for (const id of ids) {
    if (reused.size + fetch.length >= cap) break;
    if (reused.has(id) || fetch.includes(id)) continue;
    const hit = known?.get(id);
    if (hit) reused.set(id, hit);
    else fetch.push(id);
  }
  return { reused, fetch };
}

export async function stampGoogleAgainstCatalog(
  items: LaneItem[],
  admin: SupabaseClient,
  apiKey: string,
  gate: MapConfig,
  general: GeneralConfig,
  opts: {
    alreadyHasSignals?: boolean;
    locations?: boolean;
    known?: Map<string, GoogleHit>;
    detailsCap?: number;
  } = {},
): Promise<LaneItem[]> {
  const byGoogleId = new Map<string, ListedRow>();
  const missingIds = items
    .filter((p) => p.state === "not_in_mesita" && p.placeId)
    .map((p) => p.placeId);
  const extra = missingIds.length > 0
    ? await fetchListedByGoogleIds(admin, missingIds)
    : [];
  for (const row of extra) {
    if (row.google_place_id) byGoogleId.set(row.google_place_id, row);
  }

  const stamped = items.map((item) => {
    const row = byGoogleId.get(item.placeId);
    if (!row) return item;
    const mesita = listedToLane(row);
    if (!mesita) return item;
    return applyResolvedMesitaName(item, mesita);
  });

  if (opts.alreadyHasSignals) {
    return stamped
      .filter((p) => p.state !== "not_in_mesita" || Boolean(p.placeId))
      .filter((p) => clearsGeneralGate(general, p));
  }

  const googleOnly = stamped.filter((p) => p.state === "not_in_mesita");
  // On-Mesita rows never needed a Details call — their own columns answer
  // the gate. Google-only rows still do, and that same answer is their card
  // (MESITA-2678): Autocomplete alone gives a name and an address, so a
  // typed pick used to land as a bare first card.
  if (googleOnly.length === 0) {
    return stamped.filter((p) => clearsGeneralGate(general, p));
  }
  const { reused, fetch: toFetch } = detailsTargets(
    googleOnly.map((p) => p.placeId),
    opts.known,
    opts.detailsCap ?? googleOnly.length,
  );
  const listingById = new Map<string, GoogleHit>(reused);
  await Promise.all(toFetch.map(async (placeId) => {
    const hit = await fetchPlaceListing(placeId, apiKey);
    if (hit) listingById.set(placeId, hit);
  }));
  return stamped.filter((p) => {
    if (p.state !== "not_in_mesita") return clearsGeneralGate(general, p);
    const hit = listingById.get(p.placeId);
    if (!hit) return false;
    const kind = gatedGoogleKind(
      evaluatePlaceForMap(gate, {
        primaryType: hit.primaryType,
        rating: hit.rating,
        reviewCount: hit.reviewCount,
      }),
      opts.locations === true,
    );
    if (!kind || !clearsGeneralGate(general, { businessStatus: hit.businessStatus })) {
      return false;
    }
    if (kind === "location") {
      // A destination, not a business card (MESITA-2778): the pick anchors
      // the map on it, so it carries its point and its type, nothing else.
      p.kind = "location";
      p.locationType = hit.primaryType ?? undefined;
      if (hit.lat != null) p.lat = hit.lat;
      if (hit.lng != null) p.lng = hit.lng;
      return true;
    }
    if (p.lat == null && hit.lat != null) p.lat = hit.lat;
    if (p.lng == null && hit.lng != null) p.lng = hit.lng;
    p.card = googleStub(hit, null);
    // The Details numbers the guest bar's Popularity order reads (MESITA-2724).
    p.rating = hit.rating;
    p.reviewCount = hit.reviewCount;
    return true;
  });
}

/**
 * A Mesita row's card is its own catalog row (MESITA-2678), the card
 * projection the Map and the Feed send, so a picked Mesita place lands as
 * the card it would be in the carousel before any reload returns it. ONE
 * read for the few Mesita rows an answer holds, listed rows only. A failed
 * read keeps the answer; those rows simply carry no card.
 */
export async function attachMesitaCards(
  admin: SupabaseClient,
  items: LaneItem[],
): Promise<LaneItem[]> {
  const ids = [
    ...new Set(items.flatMap((item) => (item.mesitaId ? [item.mesitaId] : []))),
  ];
  if (ids.length === 0) return items;
  const { data, error } = await admin
    .from("profiles")
    .select(PLACE_CARD_COLUMNS)
    .in("id", ids)
    .eq("state", "active");
  if (error) {
    console.error("[name-pipeline] mesita cards:", error.message);
    return items;
  }
  const rows = (data ?? []) as unknown as Array<
    PlaceCategoryRow & { id: string } & Record<string, unknown>
  >;
  const cards = new Map(withFamilyKeysList(rows).map((row) => [row.id, row]));
  return items.map((item) => {
    const card = item.mesitaId ? cards.get(item.mesitaId) : undefined;
    return card ? { ...item, mesitaCard: card } : item;
  });
}

async function fetchListedByGoogleIds(
  admin: SupabaseClient,
  placeIds: string[],
): Promise<ListedRow[]> {
  const { data, error } = await admin
    .from("profiles")
    // The path that resolves a Google hit onto a Mesita row: the lane fields
    // and the Discovery › General inputs.
    .select(LISTED_COLUMNS)
    .in("google_place_id", placeIds)
    .eq("state", "active");
  if (error) {
    console.error("[name-pipeline] enrich:", error.message);
    return [];
  }
  return (data ?? []) as ListedRow[];
}
