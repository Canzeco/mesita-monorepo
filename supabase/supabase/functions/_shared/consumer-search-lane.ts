// THE NAME PIPELINE (MESITA-2327): resolve a place by its name. Sources:
// Google Autocomplete · Google Text Search · Mesita Places Search. Signal:
// Name (`nameSimilarity`, pipeline-signals.ts). No gate, no weight. The
// consumer bar runs it once after the guest stops typing (MESITA-2322); the
// modes below are this one pipeline's callers and passes.
//
// THREE NAME BARS RUN THIS LANE: consumer Search, admin Manage Single Place
// (admin-web-suggest-places, mode deep), and — from MESITA-1874 until
// MESITA-2090 retired it — the business console's Add place. That one used to
// run `suggestPlaces` (Autocomplete + a Mesita ILIKE), which returned one
// establishment from anywhere on earth for a partial name; `suggestPlaces`
// went with its last caller, consumer-mcp (retired, MESITA-2090).
//
// Fast: Google Autocomplete only. Cap min(googleCount, count) — the two
// Fast numbers are the same list; they stay locked.
// Map Filters never cut this list. Autocomplete and Text Search never
// take a country code — both stay Any (guest pin may still bias).
// Deep: three independent queries, each capped, then concat. Overlaps drop;
// earlier query keeps the slot. Order:
//   1. Google Autocomplete (autoCount)
//   2. Google Text Search (googleCount)
//   3. Mesita Places — the Name signal (mesitaCount)
// Never Nearby Search. Guest pin biases Autocomplete / Text / name match.
// Discovery > General runs LAST on both modes: whatever a Google query
// returned, and whatever Mesita row it resolved to, has to clear Active
// (discovery-general-gate.ts) -- on-Mesita rows too: an operator who switched
// Active off meant it. The one reviews floor, `map.googleMinReviews`, cuts
// Google-only rows alone (MESITA-2702): a Mesita place is never cut by its
// review count.
// A Google hit that resolves to Mesita stays in its Google query; later
// Mesita queries skip it. The Mesita lane ranks by the Name signal alone
// (`rankMesitaByName`): name-embedding cosine, or the lexical fallback for a
// row or a request without a vector.
// Word answers with TWO entities (MESITA-1403): Places are places,
// Locations are regions/cities. Autocomplete returns both in one call;
// classification reads `types` off rows the response already carries —
// never a Details call while typing. Locations skip the place gates and
// Mesita resolution whole, and only the consumer caller opts into them
// (the matrix: Locations ride Word alone). Coordinates come later, on
// selection, through the anchor read (one Details call per PICK).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";
import { adminClient, type EFEnv } from "./auth.ts";
import {
  classifyGoogleError,
  fetchLocationAnchor,
  friendlyGoogleError,
  GOOGLE_PLACES_AUTOCOMPLETE_URL,
  GOOGLE_PLACES_TEXT_SEARCH_URL,
  readGooglePlacesKey,
  stripPlacesPrefix,
} from "./google-places.ts";
import {
  applyPlacesAutocompleteRegion,
  applyPlacesTextSearchRegion,
} from "./sourcing.ts";
import {
  type GeneralConfig,
  loadDiscoveryConfig,
  type MapConfig,
  type NameConfig,
  type SuperParamKey,
} from "./discovery-config.ts";
import {
  applyGeneralGateQuery,
  clearsGeneralGate,
  type GeneralGate,
  type GeneralGateQuery,
  googleGate,
  mesitaGate,
} from "./discovery-general-gate.ts";
import { evaluatePlaceForMap } from "./map-engine.ts";
import { embedSingle } from "./embeddings-http.ts";
import { resolveEmbeddingModel } from "./embeddings.ts";
import {
  isEnrichedPlace,
  type PlaceCategoryRow,
  withFamilyKeysList,
} from "./place-family-keys.ts";
import { PLACE_CARD_COLUMNS } from "./place-columns.ts";
import { radiusBoundingBox } from "./geo.ts";
import { nameSimilarity } from "./pipeline-signals.ts";
import {
  fetchPlaceListing,
  type GooglePlaceListing,
  NEARBY_FIELD_MASK,
  type NearbyHit,
  nearbyHitFromPlace,
} from "./nearby-places.ts";
import { googleStub } from "./google-stub.ts";

export const NAME_MIN_COSINE = 0.4;
/** Pay has no Google fallback, so its lane never collapses to nothing. */
export const MESITA_NAME_MIN_CAP = 10;

/**
 * How many Mesita rows Pay's search returns. Follows the operator's Deep
 * count so Pay and Search rank alike, with a floor: zeroing it would leave
 * Pay permanently empty, while Search would still have Autocomplete.
 */
export function mesitaNameCap(deep: { mesitaCount: number }): number {
  return Math.max(deep.mesitaCount ?? 0, MESITA_NAME_MIN_CAP);
}
export const GOOGLE_TEXT_MAX = 20;

/**
 * `fast`   Search bar while typing — Google Autocomplete.
 * `deep`   Search bar after idle — Autocomplete + Text Search + Mesita.
 * `mesita` PAY — the Mesita NAME EMBEDDINGS and nothing else (Pato,
 *          2026-08-29). Pay opens a ticket, and you cannot open one at a
 *          place that is not on Mesita, so a Google lane here would bill
 *          an API call to return a row the surface must immediately lock.
 */
export type SuggestPlacesMode = "fast" | "deep" | "mesita";

/** Word's two entities: a place, or a region/city from Autocomplete. */
export type LaneKind = "place" | "location";

type PredictionState =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

/** Guest families stay on. A stored off switch does not skip Google. */
function anySuperOn(_supers: Record<SuperParamKey, boolean>): boolean {
  return true;
}

export type LaneItem = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  state: PredictionState;
  /** Server's answer: did we write a profile for this place? */
  enriched?: boolean;
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
  /** Google-only rows: the Google-only card (`googleStub`), from Text Search
   *  (MESITA-2325) or an Autocomplete row's Details call (MESITA-2678). Sent
   *  only while the row is not on Mesita. */
  card?: Record<string, unknown>;
  /** Mesita rows: the place's own catalog card (MESITA-2678), the one the
   *  wire sends for a Mesita row instead of any Google card. */
  mesitaCard?: Record<string, unknown>;
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
  mesita: LaneItem[];
};

/**
 * Concatenate query arrays. Overlaps drop. Earlier query keeps the slot.
 * Name Deep order: Autocomplete → Text → Mesita Places.
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
    queries.mesita,
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

export type ConsumerSearchArgs = {
  input?: string;
  sessionToken?: string;
  lat?: number | null;
  lng?: number | null;
  /** Single Place › Find: Word by Admin's caps, not the consumer bar's
   *  (MESITA-2322). Only `admin-web-suggest-places` sets it. */
  admin?: boolean;
  /** Default fast — pickers and older clients stay Autocomplete. */
  mode?: SuggestPlacesMode | string | null;
  /**
   * Locations ride Word alone (the matrix, MESITA-1402): only the consumer
   * searchbar caller opts in. Off, Location rows drop BEFORE the stamp, so
   * a place picker never pays a Details call for a city it would discard.
   */
  locations?: boolean;
};

export type ListedRow = {
  id: string;
  slug: string;
  google_place_id: string | null;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  content_state: string | null;
  enriched_at: string | null;
  business_state: string | null;
  google_review_count: number | null;
  google_stars_overall?: number | null;
  family_keys?: string[] | null;
  name_embedding: unknown | null;
  /** Never selected since MESITA-2338: the Name signal reads the name
   *  embedding only; the summary vector is Deep's. */
  embedding?: unknown | null;
  /** The About, read only for the few hits `nameMesitaPlaces` returns. */
  description?: string | null;
};

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
    // The entity is Mesita's now, so its enrichment fact travels with it.
    enriched: mesita.enriched,
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

/** The lexical fallback's floor: trigram Dice 0.4 is about one shared word
 *  (pipeline-signals.ts `lexicalNameSimilarity`). */
export const NAME_MIN_LEXICAL = 0.4;

/**
 * The Name pipeline's Mesita order (MESITA-2327): the Name signal alone
 * (`nameSimilarity`) — the cosine of precomputed name embeddings against the
 * one query vector, or, where either vector is missing, the lexical
 * fallback. Each method has its own admission floor. No gate, no weight:
 * a Created place is findable by its name like any other. Ties break on
 * name, then id, so the order is deterministic.
 */
export function rankMesitaByName(
  rows: ListedRow[],
  query: { text: string; vector: number[] | null },
): ListedRow[] {
  return rows
    .filter((row) => String(row.name ?? "").trim())
    .map((row) => ({
      row,
      sim: nameSimilarity(query, { name: row.name, nameEmbedding: row.name_embedding }),
    }))
    .filter(({ sim }) =>
      sim.score >= (sim.method === "embedding" ? NAME_MIN_COSINE : NAME_MIN_LEXICAL)
    )
    .sort((a, b) =>
      b.sim.score - a.sim.score ||
      String(a.row.name).localeCompare(String(b.row.name)) ||
      a.row.id.localeCompare(b.row.id)
    )
    .map(({ row }) => row);
}

/**
 * The Name pipeline's Mesita lane for a caller that is not a search bar —
 * the Chat Agent (MESITA-2339). The Name signal over Mesita Places Search
 * only: no Google source, so no Google bill. The query is embedded once.
 */
export async function nameMesitaPlaces(
  admin: SupabaseClient,
  general: GeneralConfig,
  text: string,
  origin: { lat: number; lng: number } | null,
  cap: number,
): Promise<ListedRow[]> {
  const openaiKey = (Deno.env.get("OPENAI_KEY") ?? "").trim();
  const [pool, vector] = await Promise.all([
    fetchEmbedPool(admin, origin, general),
    embedQueryVector(admin, text, openaiKey),
  ]);
  const hits = rankMesitaByName(pool, { text, vector }).slice(0, Math.max(0, cap));
  if (hits.length === 0) return hits;
  // The About for these few hits only: the bar's 300-row pool stays lean,
  // and Chat can quote the place it names.
  const { data, error } = await admin
    .from("profiles")
    .select("id, description")
    .in("id", hits.map((h) => h.id));
  if (error) {
    // The names still answer; only the About is missing.
    console.error("[consumer-search-lane] name about:", error.message);
    return hits;
  }
  const about = new Map(
    ((data ?? []) as Array<{ id: string; description: string | null }>).map((r) => [r.id, r.description]),
  );
  return hits.map((h) => ({ ...h, description: about.get(h.id) ?? null }));
}

function takeListedLane(rows: ListedRow[], cap: number): LaneItem[] {
  const out: LaneItem[] = [];
  for (const row of rows) {
    const item = listedToLane(row);
    if (!item || !item.mainText) continue;
    out.push(item);
    if (out.length >= cap) break;
  }
  return out;
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
  if (raw === "deep") return "deep";
  if (raw === "mesita") return "mesita";
  return "fast";
}

export async function runConsumerSearchLane(
  env: EFEnv,
  callerName: string,
  args: ConsumerSearchArgs,
): Promise<Response> {
  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;
  const apiKey = keyRes.key;

  const input = (args.input ?? "").toString().trim();
  const sessionToken = (args.sessionToken ?? "").toString();
  if (input.length < 2) return json({ ok: true, predictions: [] });
  if (!sessionToken) return json({ ok: false, error: "Missing sessionToken" });

  const admin = adminClient(env);
  const origin = originOf(args.lat, args.lng);
  const cfg = await loadDiscoveryConfig(admin);
  const mode = resolveMode(args.mode);
  // The caller opts in (the consumer bar only); the operator can switch
  // Locations off for it on Discovery › Word (MESITA-2319).
  const locations = args.locations === true && cfg.name.locations;
  // Word by Admin swaps in its own caps: Autocomplete rows for `fast`,
  // Mesita name rows for `mesita` (Text Search is the Find page's own call).
  const name = args.admin === true
    ? {
      ...cfg.name,
      fast: {
        ...cfg.name.fast,
        count: cfg.name.admin.autoCount,
        googleCount: cfg.name.admin.autoCount,
      },
    }
    : cfg.name;

  const predictions = mode === "mesita"
    // Pay: the Mesita name embeddings alone. No Google lane, no Google bill.
    ? await runMesitaNameSearch(
      admin,
      name,
      cfg.general,
      input,
      origin,
      args.admin === true ? cfg.name.admin.mesitaCount : mesitaNameCap(cfg.name.deep),
    )
    : mode === "deep"
    ? await runDeepSearch(
      admin,
      apiKey,
      cfg.map,
      name,
      googleGate(cfg),
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
      googleGate(cfg),
      input,
      sessionToken,
      origin,
      locations,
    );

  if ("errorEnvelope" in predictions) {
    return json(predictions.errorEnvelope);
  }

  return json({
    ok: true,
    predictions: predictions.map(toWire),
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
  general: GeneralGate,
  input: string,
  sessionToken: string,
  origin: { lat: number; lng: number } | null,
  locations: boolean,
): Promise<LaneItem[] | { errorEnvelope: Record<string, unknown> }> {
  const cap = Math.min(name.fast.count, name.fast.googleCount);
  if (cap <= 0 || !anySuperOn(name.fast.supers)) {
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
  general: GeneralGate,
): Promise<LaneItem[]> {
  const places = items.filter((row) => row.kind !== "location");
  const stamped = await stampGoogleAgainstCatalog(
    places,
    admin,
    apiKey,
    gate,
    general,
  );
  return weaveStampedAutocomplete(items, stamped);
}

function takeLane(items: LaneItem[], cap: number): LaneItem[] {
  if (cap <= 0) return [];
  return items.slice(0, cap);
}

/** Which Deep modules fire. Types off skip the Google modules. The Mesita
 *  lane needs no OpenAI key: without a query vector the Name signal falls
 *  back to lexical similarity (MESITA-2327). */
export function deepModuleFlags(args: {
  autoCount: number;
  mesitaCount: number;
  googleCount: number;
  typesOn: boolean;
}): { wantAuto: boolean; wantText: boolean; wantMesita: boolean } {
  return {
    wantAuto: args.autoCount > 0 && args.typesOn,
    wantText: args.googleCount > 0 && args.typesOn,
    wantMesita: args.mesitaCount > 0,
  };
}

async function runDeepSearch(
  admin: SupabaseClient,
  apiKey: string,
  map: MapConfig,
  name: NameConfig,
  general: GeneralGate,
  input: string,
  sessionToken: string,
  origin: { lat: number; lng: number } | null,
  locations: boolean,
): Promise<LaneItem[]> {
  const deep = name.deep;
  const gate = map;
  const typesOn = anySuperOn(deep.supers);
  const openaiKey = (Deno.env.get("OPENAI_KEY") ?? "").trim();
  const { wantAuto, wantText, wantMesita } = deepModuleFlags({
    autoCount: deep.autoCount,
    mesitaCount: deep.mesitaCount,
    googleCount: deep.googleCount,
    typesOn,
  });

  const [googleAuto, googleText, embedPool, queryVec] = await Promise.all([
    wantAuto
      ? fetchAutocomplete(input, sessionToken, apiKey, origin)
      : Promise.resolve({ predictions: [] as LaneItem[] }),
    wantText
      ? fetchTextSearch(input, apiKey, gate, origin, deep.googleCount)
      : Promise.resolve([] as LaneItem[]),
    wantMesita
      ? fetchEmbedPool(admin, origin, general)
      : Promise.resolve([] as ListedRow[]),
    wantMesita ? embedQueryVector(admin, input, openaiKey) : Promise.resolve(null),
  ]);

  const autoPreds = "errorEnvelope" in googleAuto && googleAuto.errorEnvelope
    ? []
    : googleAuto.predictions;

  // Deep keeps Location rows from its Autocomplete query only: Text Search
  // returns Places even for "Ciudad de México", and the Mesita lanes are
  // places by construction.
  const [stampedAuto, stampedText] = await Promise.all([
    stampAutocompleteLane(
      keepWantedKinds(autoPreds, locations),
      admin,
      apiKey,
      gate,
      general,
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

  const ordered = wantMesita
    ? rankMesitaByName(embedPool, { text: input, vector: queryVec })
    : [];
  const lineupMesita = deep.mesitaCount > 0
    ? takeListedLane(ordered, deep.mesitaCount)
    : [];

  return await attachMesitaCards(
    admin,
    mergeNameDeepQueries({
      autocomplete: takeLane(stampedAuto, deep.autoCount),
      text: takeLane(stampedText, deep.googleCount),
      mesita: lineupMesita,
    }),
  );
}

/**
 * Pay's engine. Same pool, same cosine floor, same Deep Lineup order as
 * the Mesita lane inside `runDeepSearch` — no second retrieval scheme,
 * just that one lane on its own. The pool does not require a name embedding:
 * a row without one is scored by the lexical fallback (MESITA-2327).
 *
 * The cap follows the operator's Deep count so Pay and Search rank the
 * same way, with a floor: an operator zeroing it would otherwise leave
 * Pay's search permanently empty, and Pay has no Google lane to fall
 * back to.
 */
async function runMesitaNameSearch(
  admin: SupabaseClient,
  name: NameConfig,
  general: GeneralConfig,
  input: string,
  origin: { lat: number; lng: number } | null,
  cap: number = mesitaNameCap(name.deep),
): Promise<LaneItem[]> {
  const openaiKey = (Deno.env.get("OPENAI_KEY") ?? "").trim();
  const [embedPool, queryVec] = await Promise.all([
    fetchEmbedPool(admin, origin, general),
    embedQueryVector(admin, input, openaiKey),
  ]);
  const ordered = rankMesitaByName(embedPool, { text: input, vector: queryVec });
  return takeListedLane(ordered, cap);
}

export function toWire(item: LaneItem) {
  return {
    placeId: item.placeId,
    mainText: item.mainText,
    secondaryText: item.secondaryText,
    state: item.state,
    enriched: item.enriched === true,
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
 * per keystroke. Wire status stays 200 — supabase-js's invoke helper
 * swallows non-2xx bodies.
 */
export async function runLocationAnchor(rawPlaceId: string): Promise<Response> {
  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;
  const placeId = stripPlacesPrefix(rawPlaceId.trim());
  if (!placeId) return json({ ok: false, error: "Missing anchorPlaceId" });
  const anchor = await fetchLocationAnchor(placeId, keyRes.key);
  if (!anchor) {
    return json({
      ok: false,
      code: "anchor_not_found",
      error: "Couldn't resolve that location right now.",
    });
  }
  return json({ ok: true, anchor });
}

async function embedQueryVector(
  admin: SupabaseClient,
  input: string,
  openaiKey: string,
): Promise<number[] | null> {
  if (!openaiKey) return null;
  try {
    const model = await resolveEmbeddingModel(admin);
    return await embedSingle(input, openaiKey, model);
  } catch (err) {
    console.error(
      "[consumer-search-lane] embed query:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

const EMBED_COLUMNS =
  "id, slug, google_place_id, name, address, lat, lng, content_state, enriched_at, business_state, google_review_count, google_stars_overall, family_keys, name_embedding";
/** In-process cosine budget — a bounded pool, not every vector. */
const EMBED_POOL = 300;
const EMBED_RADIUS_KM = 40;

async function fetchEmbedPool(
  admin: SupabaseClient,
  origin: { lat: number; lng: number } | null,
  general: GeneralConfig,
): Promise<ListedRow[]> {
  // Discovery > General rides the WHERE clause here: the pool is capped at
  // EMBED_POOL, so gating after the fetch would thin the deck instead of
  // narrowing the catalog.
  const base = admin
    .from("profiles")
    .select(EMBED_COLUMNS)
    // Listed = `active`; `lead` is a dead label (MESITA-2144) that a filter
    // must not name once the enum drops it — Postgres would 22P02 the read.
    .eq("state", "active");
  let query = applyGeneralGateQuery(
    base as unknown as GeneralGateQuery,
    mesitaGate(general),
  ) as unknown as typeof base;
  if (origin) {
    const { latDelta, lngDelta } = radiusBoundingBox(origin.lat, EMBED_RADIUS_KM);
    query = query
      .gte("lat", origin.lat - latDelta)
      .lte("lat", origin.lat + latDelta)
      .gte("lng", origin.lng - lngDelta)
      .lte("lng", origin.lng + lngDelta)
      // The same capped slice every time (MESITA-2338): without an order,
      // Postgres may return any EMBED_POOL rows once the box holds more.
      .order("id", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false }).order("id", { ascending: true });
  }
  const { data, error } = await query.limit(EMBED_POOL);
  if (error) {
    console.error("[consumer-search-lane] embed pool:", error.message);
    return [];
  }
  return (data ?? []) as unknown as ListedRow[];
}

async function fetchAutocomplete(
  input: string,
  sessionToken: string,
  apiKey: string,
  origin: { lat: number; lng: number } | null,
): Promise<{ predictions: LaneItem[]; errorEnvelope?: Record<string, unknown> }> {
  const body: Record<string, unknown> = { input, sessionToken };
  applyPlacesAutocompleteRegion(body, origin);
  const r = await fetch(GOOGLE_PLACES_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });
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
  const data = (await r.json()) as {
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

async function fetchTextSearch(
  input: string,
  apiKey: string,
  gate: MapConfig,
  origin: { lat: number; lng: number } | null,
  limit: number,
): Promise<LaneItem[]> {
  const body: Record<string, unknown> = {
    textQuery: input,
    maxResultCount: Math.min(GOOGLE_TEXT_MAX, Math.max(1, limit)),
  };
  applyPlacesTextSearchRegion(body, origin);
  let r: Response;
  try {
    r = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Nearby's listing mask (MESITA-2325): Text Search bills the same
        // Pro/Enterprise tiers, and `rating` already puts the call on
        // Enterprise, so the card's other fields add no spend.
        "X-Goog-FieldMask": NEARBY_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(
      "[consumer-search-lane] text search threw:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
  if (!r.ok) {
    const t = await r.text();
    console.error(
      "[consumer-search-lane] text search:",
      friendlyGoogleError(classifyGoogleError(r.status, t), r.status, t),
    );
    return [];
  }
  const data = (await r.json()) as { places?: GooglePlaceListing[] };
  const out: LaneItem[] = [];
  for (const p of data.places ?? []) {
    const hit = nearbyHitFromPlace(p);
    if (!hit.placeId || !hit.name) continue;
    const eligible = evaluatePlaceForMap(gate, {
      primaryType: hit.primaryType,
      rating: hit.rating,
      reviewCount: hit.reviewCount,
    }).eligible;
    if (!eligible) continue;
    out.push({
      placeId: hit.placeId,
      mainText: hit.name,
      secondaryText: hit.address,
      state: "not_in_mesita",
      lat: hit.lat,
      lng: hit.lng,
      businessStatus: hit.businessStatus,
      reviewCount: hit.reviewCount,
      // The same Google-only card Nearby sends, so a typed pick opens a
      // draft as rich as a Feed card's (MESITA-2325).
      card: googleStub(hit, null),
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function stampGoogleAgainstCatalog(
  items: LaneItem[],
  admin: SupabaseClient,
  apiKey: string,
  gate: MapConfig,
  general: GeneralGate,
  opts: { alreadyHasSignals?: boolean } = {},
): Promise<LaneItem[]> {
  // A Mesita row answers Active alone; a Google-only row, the reviews floor
  // too (MESITA-2702).
  const rowGate = (p: LaneItem): GeneralGate =>
    p.state === "not_in_mesita" ? general : mesitaGate(general);
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
      .filter((p) => clearsGeneralGate(rowGate(p), p));
  }

  const googleOnly = stamped.filter((p) => p.state === "not_in_mesita");
  // On-Mesita rows never needed a Details call — their own columns answer
  // the gate. Google-only rows still do, and that same answer is their card
  // (MESITA-2678): Autocomplete alone gives a name and an address, so a
  // typed pick used to land as a bare first card.
  if (googleOnly.length === 0) {
    return stamped.filter((p) => clearsGeneralGate(rowGate(p), p));
  }
  const listingById = new Map<string, NearbyHit>();
  await Promise.all(googleOnly.map(async (p) => {
    const hit = await fetchPlaceListing(p.placeId, apiKey);
    if (hit) listingById.set(p.placeId, hit);
  }));
  return stamped.filter((p) => {
    if (p.state !== "not_in_mesita") return clearsGeneralGate(rowGate(p), p);
    const hit = listingById.get(p.placeId);
    if (!hit) return false;
    const ok = evaluatePlaceForMap(gate, {
      primaryType: hit.primaryType,
      rating: hit.rating,
      reviewCount: hit.reviewCount,
    }).eligible &&
      clearsGeneralGate(general, {
        businessStatus: hit.businessStatus,
        reviewCount: hit.reviewCount,
      });
    if (ok && p.lat == null && hit.lat != null) p.lat = hit.lat;
    if (ok && p.lng == null && hit.lng != null) p.lng = hit.lng;
    if (ok) p.card = googleStub(hit, null);
    return ok;
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
    console.error("[consumer-search-lane] mesita cards:", error.message);
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
    // One column list, not a second hand-typed copy: this is the path that
    // resolves a Google hit onto a Mesita row, so it must carry the same
    // enrichment fact as the embedding pool — and the same Discovery ›
    // General inputs.
    .select(EMBED_COLUMNS)
    .in("google_place_id", placeIds)
    .eq("state", "active");
  if (error) {
    console.error("[consumer-search-lane] enrich:", error.message);
    return [];
  }
  return (data ?? []) as ListedRow[];
}
