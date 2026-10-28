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
// admin-web-suggest-places, mode deep). The Google fetchers, gate and stamp
// (name-pipeline-google.ts) and the merge below are one code path for both.
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
import { readGooglePlacesKey } from "./google-places.ts";
import {
  type DiscoveryConfig,
  type GeneralConfig,
  loadDiscoveryConfig,
  type MapConfig,
  type NameConfig,
} from "./discovery-config.ts";
import {
  applyGeneralGateQuery,
  type GeneralGateQuery,
} from "./discovery-general-gate.ts";
import { clearsPopularityFloor } from "./pipeline-signals.ts";
import type { GoogleHit } from "./google-listing.ts";
import {
  attachMesitaCards,
  fetchAutocomplete,
  fetchTextSearch,
  LISTED_COLUMNS,
  type ListedRow,
  premierTier,
  stampGoogleAgainstCatalog,
} from "./name-pipeline-google.ts";

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
