// THE NAME PIPELINE (MESITA-2327): resolve a place by its name. Sources:
// Google Autocomplete · Google Text Search — GOOGLE'S NAME IS CANONICAL
// (Pato, MESITA-2896: "Kill Mesita Name from everywhere. Now we are only using
// Google Name which is canonic. If the Text Search API nor the Autocomplete
// API does shit, then the place is not visible"). The Mesita Places lane
// (name embeddings, MESITA-2327) and its `mesita` mode are gone. A Google hit
// Mesita holds (same google_place_id) is stamped as the Mesita place and
// carries its Mesita card; a place neither Google API returns is not found.
//
// TWO NAME PIPELINES SHARE THIS MODULE (MESITA-2922), one entry each:
// `runConsumerNamePipeline` (consumer Search, consumer-web-suggest-places)
// and `runAdminNamePipeline` (admin Manage Single Place,
// admin-web-suggest-places, mode deep). The Google fetchers, gate, stamp and
// merge below are one code path for both.
//
// Fast: Google Autocomplete only. Cap min(googleCount, count) — the two
// Fast numbers are the same list; they stay locked.
// Map Filters never cut this list. Autocomplete and Text Search never
// take a country code — both stay Any (guest pin may still bias).
// Deep: two independent queries, each capped, then concat. Overlaps drop;
// earlier query keeps the slot. Order:
//   1. Google Autocomplete (autoCount)
//   2. Google Text Search (googleCount)
// Never Nearby Search. Guest pin biases Autocomplete / Text.
// Discovery > General runs LAST on both modes: whatever a Google query
// returned, and whatever Mesita row it resolved to, has to clear Active
// (discovery-general-gate.ts) -- on-Mesita rows too: an operator who switched
// Active off meant it. No reviews floor (MESITA-2721: `map.googleMinReviews`
// is retired).
// Word answers with TWO entities (MESITA-1403): Places are places,
// Locations are regions/cities. Autocomplete returns both in one call;
// classification reads `types` off rows the response already carries —
// never a Details call while typing. Locations skip the place gates and
// Mesita resolution whole, and only the consumer caller opts into them
// (the matrix: Locations ride Word alone). Coordinates come later, on
// selection, through the anchor read (one Details call per PICK).
// ANY GOOGLE ENTITY IS A DESTINATION (MESITA-2778): on the consumer bar a
// Google establishment that is not one of Mesita's place types (a school,
// an office, a park) is a Location too, never a drop: the guest searches
// "my school" to find places near it. Only the type gate turns a row into
// a Location; a food place under the rating or review floors still drops.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";
import { adminClient, type EFEnv } from "./auth.ts";
import {
  classifyGoogleError,
  fetchLocationAnchor,
  fetchPlacePreview,
  friendlyGoogleError,
  GOOGLE_PLACES_AUTOCOMPLETE_URL,
  GOOGLE_PLACES_TEXT_SEARCH_URL,
  readGooglePlacesKey,
  stripPlacesPrefix,
} from "./google-places.ts";
import { googleFetch } from "./google-fetch.ts";
import {
  applyPlacesAutocompleteRegion,
  applyPlacesTextSearchRegion,
} from "./sourcing.ts";
import {
  type DiscoveryConfig,
  type GeneralConfig,
  loadDiscoveryConfig,
  type MapConfig,
  type NameConfig,
} from "./discovery-config.ts";
import {
  applyGeneralGateQuery,
  clearsGeneralGate,
  type GeneralGateQuery,
} from "./discovery-general-gate.ts";
import { evaluatePlaceForMap } from "./map-engine.ts";
import {
  isEnrichedPlace,
  type PlaceCategoryRow,
  withFamilyKeysList,
} from "./place-family-keys.ts";
import { PLACE_CARD_COLUMNS } from "./place-columns.ts";
import { clearsPopularityFloor } from "./pipeline-signals.ts";
import {
  fetchPlaceListing,
  type GooglePlaceListing,
  LISTING_FIELD_MASK,
  type GoogleHit,
  googleHitFromPlace,
} from "./google-listing.ts";
import { googleStub } from "./google-stub.ts";

export const GOOGLE_TEXT_MAX = 20;

/**
 * `fast` Autocomplete only (pickers, older clients).
 * `deep` Autocomplete + Text Search: the Search bar (MESITA-2896). A stale
 *        `mesita` caller (the retired Mesita Name lane) resolves here.
 */
export type SuggestPlacesMode = "fast" | "deep";

/** Word's two entities: a place, or a region/city from Autocomplete. */
export type LaneKind = "place" | "location";

type PredictionState =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

export type LaneItem = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  state: PredictionState;
  /** Server's answer: did we write a profile for this place? */
  enriched?: boolean;
  /** Premier (MESITA-2925): the row's paid tier, `places.boost_tier`
   *  (0 · 1 · 2 · 3 = none · 2X · 5X · 10X); 1 or more is Premier. Absent
   *  on a Google-only row (0 on the wire). */
  boostTier?: number;
  /**
   * Absent = "place". Only Autocomplete rows are classified; the Text and
   * Mesita lanes are places by construction. A Location never carries
   * enrichment, mesitaId, or coordinates — those arrive on selection.
   */
  kind?: LaneKind;
  /** Most specific Google type on a Location row (e.g. "locality"). */
  locationType?: string;
  mesitaId?: string;
  mesitaSlug?: string;
  lat?: number | null;
  lng?: number | null;
  /** Discovery > General inputs. Never sent to the client. */
  businessStatus?: string | null;
  reviewCount?: number | null;
  /** Google stars, beside `reviewCount`: the guest bar's Popularity order
   *  reads both (MESITA-2724). Never sent to the client. */
  rating?: number | null;
  /** Google-only rows: the Google-only card (`googleStub`), from Text Search
   *  (MESITA-2325) or an Autocomplete row's Details call (MESITA-2678). Sent
   *  only while the row is not on Mesita. */
  card?: Record<string, unknown>;
  /** Mesita rows: the place's own catalog card (MESITA-2678), the one the
   *  wire sends for a Mesita row instead of any Google card. */
  mesitaCard?: Record<string, unknown>;
  /** A Google-only place under the Area box's Minimum Popularity
   *  (MESITA-2849): the bar still lists it, after every other row
   *  (MESITA-2724), and a pick of it is a destination — the camera lands
   *  there, the Area reloads there — but it never becomes card ONE, because
   *  the Area pipeline would never admit it. Sent on the wire as is. */
  underFloor?: boolean;
};

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

export function laneDedupeKeys(item: {
  placeId?: string | null;
  mesitaId?: string | null;
  mainText?: string;
  secondaryText?: string;
}): string[] {
  const keys: string[] = [];
  const gid = item.placeId?.trim();
  const mid = item.mesitaId?.trim();
  if (gid) keys.push(`g:${gid}`);
  if (mid) keys.push(`m:${mid}`);
  if (keys.length === 0) {
    keys.push(
      `n:${(item.mainText ?? "").trim().toLowerCase()}|${
        (item.secondaryText ?? "").trim().toLowerCase()
      }`,
    );
  }
  return keys;
}

export type NameDeepQueries = {
  autocomplete: LaneItem[];
  text: LaneItem[];
};

/**
 * Concatenate query arrays. Overlaps drop. Earlier query keeps the slot.
 * Name Deep order: Autocomplete → Text.
 */
export function concatQueryLanes(lanes: LaneItem[][]): LaneItem[] {
  const byKey = new Map<string, LaneItem>();
  const order: LaneItem[] = [];

  const seen = (item: LaneItem): boolean => {
    for (const key of laneDedupeKeys(item)) {
      if (byKey.has(key)) return true;
    }
    return false;
  };

  for (const items of lanes) {
    for (const raw of items) {
      if (!raw.placeId && !raw.mesitaId) continue;
      if (seen(raw)) continue;
      const item: LaneItem = { ...raw };
      order.push(item);
      for (const key of laneDedupeKeys(item)) byKey.set(key, item);
    }
  }
  return order;
}

export function mergeNameDeepQueries(queries: NameDeepQueries): LaneItem[] {
  return concatQueryLanes([
    queries.autocomplete,
    queries.text,
  ]);
}

/** Fast Search: Autocomplete order, unique places, cap. */
export function takeFastLane(items: LaneItem[], cap: number): LaneItem[] {
  const byKey = new Map<string, LaneItem>();
  const order: LaneItem[] = [];
  for (const raw of items) {
    if (!raw.placeId && !raw.mesitaId) continue;
    if (order.length >= cap) break;
    let hit = false;
    for (const key of laneDedupeKeys(raw)) {
      if (byKey.has(key)) {
        hit = true;
        break;
      }
    }
    if (hit) continue;
    const item: LaneItem = { ...raw };
    order.push(item);
    for (const key of laneDedupeKeys(item)) byKey.set(key, item);
  }
  return order;
}

export type NamePipelineArgs = {
  input?: string;
  sessionToken?: string;
  lat?: number | null;
  lng?: number | null;
  /** Default fast — pickers and older clients stay Autocomplete. */
  mode?: SuggestPlacesMode | string | null;
};

/** What separates the two Name pipelines; everything else is shared. */
type NamePipelineShape = {
  /** `admin` in the search-lane log line. */
  admin: boolean;
  /** The Name caps this pipeline runs with. */
  name: (cfg: DiscoveryConfig) => NameConfig;
  /**
   * Locations ride Word alone (the matrix, MESITA-1402): only the consumer
   * pipeline opts in. Off, Location rows drop BEFORE the stamp, so a place
   * picker never pays a Details call for a city it would discard.
   */
  locations: (cfg: DiscoveryConfig) => boolean;
  /** The guest bar's popularity order (MESITA-2724); Admin keeps Google's. */
  demoteUnderFloor: boolean;
};

/**
 * Consumer Name: the guest searchbar. The operator can switch Locations off
 * for it on Discovery › Word (MESITA-2319); Google-only places under the
 * popularity floor sort last.
 */
export function runConsumerNamePipeline(
  env: EFEnv,
  args: NamePipelineArgs,
): Promise<Response> {
  return runNamePipeline(env, "consumer-web-suggest-places", args, {
    admin: false,
    name: (cfg) => cfg.name,
    locations: (cfg) => cfg.name.locations,
    demoteUnderFloor: true,
  });
}

/**
 * Admin Name: Single Place › Find. Word by Admin swaps in its own caps
 * (MESITA-2322): Autocomplete rows for `fast` (Text Search is the Find
 * page's own call). Places only, Google's own order.
 */
export function runAdminNamePipeline(
  env: EFEnv,
  args: NamePipelineArgs,
): Promise<Response> {
  return runNamePipeline(env, "admin-web-suggest-places", args, {
    admin: true,
    name: (cfg) => ({
      ...cfg.name,
      fast: {
        ...cfg.name.fast,
        count: cfg.name.admin.autoCount,
        googleCount: cfg.name.admin.autoCount,
      },
    }),
    locations: () => false,
    demoteUnderFloor: false,
  });
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
function premierTier(v: unknown): number {
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
    boostTier: premierTier(row.boost_tier),
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
    boostTier: mesita.boostTier,
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

/**
 * The Name pipeline for a caller that is not a search bar — the Chat Agent
 * (MESITA-2339). Google's name is canonical (MESITA-2896): ONE Text Search
 * for the named place near the anchor, kept only where Mesita holds its
 * google_place_id and the row is listed and clears Discovery › General, in
 * Google's order. A place Text Search does not return is not found.
 */
export async function nameGooglePlaces(
  admin: SupabaseClient,
  map: MapConfig,
  general: GeneralConfig,
  text: string,
  origin: { lat: number; lng: number } | null,
  cap: number,
): Promise<ListedRow[]> {
  const query = text.trim();
  if (!query || cap <= 0) return [];
  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return [];
  const hits = await fetchTextSearch(query, keyRes.key, map, origin, cap);
  const order = [...new Set(hits.map((h) => h.placeId).filter(Boolean))];
  if (order.length === 0) return [];
  const base = admin
    .from("profiles")
    .select(`${LISTED_COLUMNS}, description`)
    .in("google_place_id", order)
    .eq("state", "active");
  const { data, error } = await (applyGeneralGateQuery(
    base as unknown as GeneralGateQuery,
    general,
  ) as unknown as typeof base);
  if (error) {
    console.error("[name-pipeline] name google:", error.message);
    return [];
  }
  const rank = new Map(order.map((id, i) => [id, i]));
  return ((data ?? []) as unknown as ListedRow[])
    .filter((row) => row.google_place_id && rank.has(row.google_place_id))
    .sort((a, b) => rank.get(a.google_place_id!)! - rank.get(b.google_place_id!)!)
    .slice(0, cap);
}

function originOf(
  lat?: number | null,
  lng?: number | null,
): { lat: number; lng: number } | null {
  if (
    typeof lat === "number" && Number.isFinite(lat) &&
    typeof lng === "number" && Number.isFinite(lng)
  ) {
    return { lat, lng };
  }
  return null;
}

export function resolveMode(raw?: string | null): SuggestPlacesMode {
  // `mesita` was the Mesita Name lane (retired, MESITA-2896): its callers
  // get Google's names now.
  if (raw === "deep" || raw === "mesita") return "deep";
  return "fast";
}

/**
 * The guest bar's Popularity order (MESITA-2724): a stable partition. A
 * Google-only place row whose Popularity, ln(1 + reviews × stars), is under
 * the floor moves after every other row; Mesita rows, Locations and Google
 * rows that clear the floor keep their order in front. Nothing is removed. A
 * floor of 0 or less returns the list unchanged. `unknown` counts demoted rows
 * with no rating or no review count (they read Popularity 0).
 *
 * A demoted row is also MARKED `underFloor` (MESITA-2849, Pato: a pick is
 * the first card "only if it can be a mesita place … above the allowed
 * popularity"): the client anchors the camera on such a pick and reloads
 * the Area there, but draws no card for it — the Area pipeline hides every
 * place under this same floor, so a card for one would be a place Mesita
 * does not list. Mesita rows are Mesita places already and are never marked.
 */
export function demoteGoogleUnderFloor(
  items: readonly LaneItem[],
  floor: number,
): { items: LaneItem[]; demoted: number; unknown: number } {
  if (!(floor > 0)) return { items: [...items], demoted: 0, unknown: 0 };
  const front: LaneItem[] = [];
  const back: LaneItem[] = [];
  let unknown = 0;
  for (const item of items) {
    const isGooglePlace = item.kind !== "location" && item.state === "not_in_mesita";
    if (isGooglePlace && !clearsPopularityFloor(item, floor)) {
      back.push({ ...item, underFloor: true });
      if (typeof item.rating !== "number" || typeof item.reviewCount !== "number") unknown++;
    } else {
      front.push(item);
    }
  }
  return { items: [...front, ...back], demoted: back.length, unknown };
}

async function runNamePipeline(
  env: EFEnv,
  callerName: string,
  args: NamePipelineArgs,
  shape: NamePipelineShape,
): Promise<Response> {
  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;
  const apiKey = keyRes.key;

  const input = (args.input ?? "").toString().trim();
  const sessionToken = (args.sessionToken ?? "").toString();
  if (input.length < 2) return json({ ok: true, predictions: [] });
  if (!sessionToken) return json({ ok: false, error: "Missing sessionToken" }, 400);

  const admin = adminClient(env);
  const origin = originOf(args.lat, args.lng);
  const cfg = await loadDiscoveryConfig(admin);
  const mode = resolveMode(args.mode);
  const locations = shape.locations(cfg);
  const name = shape.name(cfg);

  const predictions = mode === "deep"
    ? await runDeepSearch(
      admin,
      apiKey,
      cfg.map,
      name,
      cfg.general,
      input,
      sessionToken,
      origin,
      locations,
    )
    : await runFastSearch(
      admin,
      apiKey,
      cfg.map,
      name,
      cfg.general,
      input,
      sessionToken,
      origin,
      locations,
    );

  // Every Google failure is a 502, rate limits included: one rule, the same
  // as reverse-geocode, and a 429 would invite automatic retries from proxies
  // and SDKs. Fast mode answers the error rather than a partial list; Deep
  // drops a failed Autocomplete lane instead (MESITA-2855).
  if ("errorEnvelope" in predictions) {
    return json(predictions.errorEnvelope, 502);
  }

  // THE GUEST BAR'S POPULARITY ORDER (MESITA-2724): after the caps and the
  // Deep merge, Google-only places under the Area box's Minimum Popularity
  // sort after the rest. Nothing is removed (a guest typing an exact name
  // must still find it), unlike Home, the Map and Chat, where the same floor
  // hides a place. Admin Find and Word keep Google's own order.
  const ordered = shape.demoteUnderFloor
    ? demoteGoogleUnderFloor(predictions, cfg.map.popularityFloor)
    : { items: predictions, demoted: 0, unknown: 0 };
  console.info(JSON.stringify({
    fn: "search-lane",
    caller: callerName,
    mode,
    admin: shape.admin,
    popularityFloor: cfg.map.popularityFloor,
    popularityDemoted: ordered.demoted,
    popularityUnknown: ordered.unknown,
  }));

  return json({
    ok: true,
    predictions: ordered.items.map(toWire),
    caller: callerName,
    mode,
    // Word's idle seconds: the consumer bar waits this long before it
    // searches (MESITA-2322). A client cannot read app_config.
    idleSec: cfg.name.idleSec,
  });
}

async function runFastSearch(
  admin: SupabaseClient,
  apiKey: string,
  map: MapConfig,
  name: NameConfig,
  general: GeneralConfig,
  input: string,
  sessionToken: string,
  origin: { lat: number; lng: number } | null,
  locations: boolean,
): Promise<LaneItem[] | { errorEnvelope: Record<string, unknown> }> {
  const cap = Math.min(name.fast.count, name.fast.googleCount);
  if (cap <= 0) {
    return [];
  }
  const gate = map;
  const googleAuto = await fetchAutocomplete(
    input,
    sessionToken,
    apiKey,
    origin,
  );
  if (googleAuto.errorEnvelope) return { errorEnvelope: googleAuto.errorEnvelope };
  const stamped = await stampAutocompleteLane(
    keepWantedKinds(googleAuto.predictions, locations),
    admin,
    apiKey,
    gate,
    general,
    locations,
    { cap },
  );
  return takeFastLane(stamped, cap);
}

/** Callers that answer with Places alone drop Location rows pre-stamp. */
function keepWantedKinds(items: LaneItem[], locations: boolean): LaneItem[] {
  return locations ? items : items.filter((row) => row.kind !== "location");
}

/**
 * Locations skip the place machinery whole: no catalog resolve, no
 * Details call, no Map or General gate — those ask questions about a
 * business, and a city has none of the answers. Survivors return in
 * Autocomplete order with Location rows holding their slots.
 */
export function weaveStampedAutocomplete(
  original: LaneItem[],
  stampedPlaces: LaneItem[],
): LaneItem[] {
  const byId = new Map<string, LaneItem>();
  for (const p of stampedPlaces) byId.set(p.placeId, p);
  const out: LaneItem[] = [];
  for (const row of original) {
    if (row.kind === "location") {
      out.push(row);
      continue;
    }
    const stamped = byId.get(row.placeId);
    if (stamped) out.push(stamped);
  }
  return out;
}

async function stampAutocompleteLane(
  items: LaneItem[],
  admin: SupabaseClient,
  apiKey: string,
  gate: MapConfig,
  general: GeneralConfig,
  locations: boolean,
  budget: { cap: number; known?: Map<string, GoogleHit> },
): Promise<LaneItem[]> {
  const places = items.filter((row) => row.kind !== "location");
  const stamped = await stampGoogleAgainstCatalog(
    places,
    admin,
    apiKey,
    gate,
    general,
    { locations, detailsCap: budget.cap, known: budget.known },
  );
  return weaveStampedAutocomplete(items, stamped);
}

function takeLane(items: LaneItem[], cap: number): LaneItem[] {
  if (cap <= 0) return [];
  return items.slice(0, cap);
}

/** Which Deep modules fire: a cap of 0 skips that Google module. The family
 *  switches that once gated both (`supers`) retired in MESITA-2767. */
export function deepModuleFlags(args: {
  autoCount: number;
  googleCount: number;
}): { wantAuto: boolean; wantText: boolean } {
  return {
    wantAuto: args.autoCount > 0,
    wantText: args.googleCount > 0,
  };
}

async function runDeepSearch(
  admin: SupabaseClient,
  apiKey: string,
  map: MapConfig,
  name: NameConfig,
  general: GeneralConfig,
  input: string,
  sessionToken: string,
  origin: { lat: number; lng: number } | null,
  locations: boolean,
): Promise<LaneItem[]> {
  const deep = name.deep;
  const gate = map;
  const { wantAuto, wantText } = deepModuleFlags({
    autoCount: deep.autoCount,
    googleCount: deep.googleCount,
  });

  // Every listing Text Search returned, kept or gated out: already paid
  // for, so an Autocomplete row with the same Place ID needs no Details.
  const textListings = new Map<string, GoogleHit>();
  const [googleAuto, googleText] = await Promise.all([
    wantAuto
      ? fetchAutocomplete(input, sessionToken, apiKey, origin)
      : Promise.resolve({ predictions: [] as LaneItem[] }),
    wantText
      ? fetchTextSearch(
        input,
        apiKey,
        gate,
        origin,
        deep.googleCount,
        locations,
        textListings,
      )
      : Promise.resolve([] as LaneItem[]),
  ]);

  const autoPreds = "errorEnvelope" in googleAuto && googleAuto.errorEnvelope
    ? []
    : googleAuto.predictions;

  // Deep keeps Location rows from its Autocomplete query only: Text Search
  // returns Places even for "Ciudad de México".
  const [stampedAuto, stampedText] = await Promise.all([
    stampAutocompleteLane(
      keepWantedKinds(autoPreds, locations),
      admin,
      apiKey,
      gate,
      general,
      locations,
      { cap: deep.autoCount, known: textListings },
    ),
    stampGoogleAgainstCatalog(
      googleText,
      admin,
      apiKey,
      gate,
      general,
      { alreadyHasSignals: true },
    ),
  ]);

  return await attachMesitaCards(
    admin,
    mergeNameDeepQueries({
      autocomplete: takeLane(stampedAuto, deep.autoCount),
      text: takeLane(stampedText, deep.googleCount),
    }),
  );
}

export function toWire(item: LaneItem) {
  return {
    placeId: item.placeId,
    mainText: item.mainText,
    secondaryText: item.secondaryText,
    state: item.state,
    enriched: item.enriched === true,
    // Premier's tier, 0..3 (MESITA-2925); 0 for a Google-only row.
    boost_tier: premierTier(item.boostTier),
    // `kind` rides Location rows only — absent reads "place", and the
    // Places path stays byte-identical for a place query.
    ...(item.kind === "location"
      ? {
        kind: "location" as const,
        ...(item.locationType ? { locationType: item.locationType } : {}),
      }
      : {}),
    ...(item.mesitaId ? { mesitaId: item.mesitaId } : {}),
    ...(item.mesitaSlug ? { mesitaSlug: item.mesitaSlug } : {}),
    ...(item.lat != null ? { lat: item.lat } : {}),
    ...(item.lng != null ? { lng: item.lng } : {}),
    // Under the Area floor (MESITA-2849): a destination, never card ONE.
    ...(item.underFloor ? { underFloor: true as const } : {}),
    // A Mesita row sends its own catalog card, never the Google card a
    // resolved hit still holds; a Google-only row sends Google's.
    ...(item.mesitaId
      ? (item.mesitaCard ? { card: item.mesitaCard } : {})
      : (item.card ? { card: item.card } : {})),
  };
}
// businessStatus / reviewCount are deliberately NOT on the wire. They are
// gate inputs, and `business_state` stays an operator fact (place-columns.ts
// keeps it out of the public payload for the same reason).

/**
 * Selection-time anchor read for a picked Location (consumed by the map
 * anchor, MESITA-1405): ONE Location-shaped Details call per pick, never
 * per keystroke. Errors carry real statuses (MESITA-2855): the client's
 * invokeEF reads the body of a non-2xx reply, so nothing is swallowed.
 */
export async function runLocationAnchor(rawPlaceId: string): Promise<Response> {
  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;
  const placeId = stripPlacesPrefix(rawPlaceId.trim());
  if (!placeId) return json({ ok: false, error: "Missing anchorPlaceId" }, 400);
  const res = await fetchLocationAnchor(placeId, keyRes.key);
  if (!res.ok) {
    return res.reason === "not_found"
      ? json({ ok: false, code: "anchor_not_found", error: "Couldn't find that location." }, 404)
      : json({
        ok: false,
        code: "google_unreachable",
        error: "Couldn't resolve that location right now.",
      }, 502);
  }
  return json({ ok: true, anchor: res.anchor });
}

/**
 * The Generate dialog's Google preview (MESITA-2941): one Details call and
 * one photo per dialog open, so a guest sees the photo, category and stars
 * of the place before they create it. Errors carry real statuses like the
 * anchor read; the dialog still offers Generate without a preview.
 */
export async function runPlacePreview(rawPlaceId: string): Promise<Response> {
  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;
  const placeId = stripPlacesPrefix(rawPlaceId.trim());
  if (!placeId) return json({ ok: false, error: "Missing previewPlaceId" }, 400);
  const res = await fetchPlacePreview(placeId, keyRes.key);
  if (!res.ok) {
    return res.reason === "not_found"
      ? json({ ok: false, code: "preview_not_found", error: "Couldn't find that place on Google." }, 404)
      : json({
        ok: false,
        code: "google_unreachable",
        error: "Couldn't load that place right now.",
      }, 502);
  }
  return json({ ok: true, preview: res.preview });
}

/** The columns a Google hit resolves onto: a Mesita row's lane fields and
 *  the Discovery › General inputs. */
const LISTED_COLUMNS =
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
      err instanceof Error ? err.message : String(err),
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
      err instanceof Error ? err.message : String(err),
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

async function stampGoogleAgainstCatalog(
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
async function attachMesitaCards(
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
