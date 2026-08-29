// Consumer Search name-bar: Fast Search (Autocomplete) while typing, Deep
// Search after idle.
//
// Consumer Search and admin Manage Single Place (admin-web-suggest-places,
// mode deep). Business still calls suggestPlaces (Autocomplete + Mesita
// ILIKE, Mesita-first sort).
//
// Fast: Google Autocomplete only. Cap min(googleCount, count) — the two
// Fast numbers are the same list; they stay locked.
// Map Filters never cut this list. Autocomplete and Text Search never
// take a country code — both stay Any (guest pin may still bias).
// Deep: four independent queries, each capped, then concat. Overlaps drop;
// earlier query keeps the slot. Order:
//   1. Google Autocomplete (autoCount)
//   2. Google Text Search (googleCount)
//   3. Mesita Places — name embedding, listed-not-partner (mesitaCount)
//   4. Mesita Partners — name embedding, paid plan (partnerCount)
// Never Nearby Search. Guest pin biases Autocomplete / Text / name match.
// A Google hit that resolves to Mesita stays in its Google query; later
// Mesita queries skip it. Summary and the other six Lineup signals are
// not a Deep input. Membership is a boolean `partner`.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";
import { adminClient, type EFEnv } from "./auth.ts";
import {
  classifyGoogleError,
  fetchPlaceSignals,
  friendlyGoogleError,
  GOOGLE_PLACES_AUTOCOMPLETE_URL,
  GOOGLE_PLACES_TEXT_SEARCH_URL,
  readGooglePlacesKey,
} from "./google-places.ts";
import {
  googleTypeFilterForTypes,
  type PredictionStatus,
} from "./suggest-places-helpers.ts";
import {
  applyPlacesAutocompleteRegion,
  applyPlacesTextSearchRegion,
} from "./sourcing.ts";
import {
  applyGeneralCategoryCap,
  loadDiscoveryConfig,
  type MapConfig,
  type NameConfig,
  type NearbyTypeKey,
} from "./discovery-config.ts";
import {
  rankByBlend,
  type SignalParamsByKey,
  type SignalWeights,
} from "./discovery-blend.ts";
import { weightsForMode } from "./discovery-matrix.ts";
import { toLineupPlace } from "./discovery-place.ts";
import { evaluatePlaceForMap } from "./map-engine.ts";
import { embedSingle } from "./embeddings-http.ts";
import { resolveEmbeddingModel } from "./embeddings.ts";
import {
  cosineSim,
  parseVector,
} from "./embeddings-vector.ts";
import { isPaidPlan } from "./membership-enforcement-helpers.ts";
import { isEnrichedPlace } from "./place-family-keys.ts";
import { radiusBoundingBox } from "./geo.ts";

export const NAME_MIN_COSINE = 0.4;
export const GOOGLE_TEXT_MAX = 20;

export type SuggestPlacesMode = "fast" | "deep";

export type LaneItem = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: PredictionStatus;
  partner: boolean;
  /** Server's answer: did we write a profile for this place? */
  enriched?: boolean;
  mesitaId?: string;
  mesitaSlug?: string;
  lat?: number | null;
  lng?: number | null;
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

export type NameDeepLanes = {
  partners: LaneItem[];
  mesita: LaneItem[];
  google: LaneItem[];
};

export type NameDeepQueries = {
  autocomplete: LaneItem[];
  text: LaneItem[];
  mesita: LaneItem[];
  partners: LaneItem[];
};

/**
 * Concatenate query arrays. Overlaps drop. Earlier query keeps the slot.
 * Name Deep order: Autocomplete → Text → Mesita Places → Mesita Partners.
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
    queries.partners,
  ]);
}

/** Fast Search: Autocomplete order, unique venues, cap. */
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
  /** Ignored. Autocomplete and Text Search stay Any. */
  country?: string | null;
  /** Default fast — pickers and older clients stay Autocomplete. */
  mode?: SuggestPlacesMode | string | null;
};

export type ListedRow = {
  id: string;
  slug: string;
  google_place_id: string | null;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  plan: string | null;
  content_status: string | null;
  enriched_at: string | null;
  name_embedding: unknown | null;
  embedding: unknown | null;
};

function listedToLane(row: ListedRow): LaneItem | null {
  const gid = row.google_place_id?.trim();
  if (!gid && !row.id) return null;
  return {
    placeId: gid ?? "",
    // Mesita display name (`places.name`), never the raw google_name column.
    mainText: String(row.name ?? ""),
    secondaryText: row.address ?? "",
    status: "web_listed",
    partner: isPaidPlan(row.plan),
    // Membership colour is the SERVER's answer on this lane too, so the
    // list dot and the map pin cannot disagree (Pato, 2026-08-29).
    enriched: isEnrichedPlace(row),
    mesitaId: row.id,
    mesitaSlug: row.slug,
    lat: row.lat,
    lng: row.lng,
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
    status: mesita.status,
    partner: mesita.partner,
    // The entity is Mesita's now, so its enrichment fact travels with it.
    enriched: mesita.enriched,
    mesitaId: mesita.mesitaId,
    mesitaSlug: mesita.mesitaSlug,
    lat: item.lat ?? mesita.lat,
    lng: item.lng ?? mesita.lng,
    mainText: mesita.mainText || item.mainText,
    secondaryText: mesita.secondaryText || item.secondaryText,
  };
}

/** Raw name cosine on `places.name_embedding`. Floor is not remapped `name()`. */
export function admitNameFloor(
  rows: ListedRow[],
  queryVec: number[],
  minCosine: number,
): ListedRow[] {
  const out: ListedRow[] = [];
  for (const row of rows) {
    const vec = parseVector(row.name_embedding);
    const score = vec && vec.length === queryVec.length
      ? cosineSim(vec, queryVec)
      : -1;
    if (score < minCosine) continue;
    if (!String(row.name ?? "").trim()) continue;
    out.push(row);
  }
  return out;
}

/**
 * Deep Lineup: Name mask only. Exponent 1 vs 4 does not reorder; 0 vs on
 * does (off → incoming pool order).
 */
export function orderDeepLineup(
  admitted: ListedRow[],
  queryNameVector: number[],
  weights: SignalWeights,
  params?: SignalParamsByKey,
): ListedRow[] {
  return rankByBlend(
    admitted,
    (row) => toLineupPlace(row as unknown as Record<string, unknown>),
    { queryNameVector },
    weights,
    params,
  ).map((r) => r.row);
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

function resolveMode(raw?: string | null): SuggestPlacesMode {
  return raw === "deep" ? "deep" : "fast";
}

function mapWithTypes(
  map: MapConfig,
  types: Record<NearbyTypeKey, boolean>,
): MapConfig {
  return { ...map, types };
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
  const cfg = applyGeneralCategoryCap(await loadDiscoveryConfig(admin));
  const mode = resolveMode(args.mode);

  const predictions = mode === "deep"
    ? await runDeepSearch(
      admin,
      apiKey,
      cfg.map,
      cfg.name,
      cfg.weights,
      cfg.params,
      input,
      sessionToken,
      origin,
    )
    : await runFastSearch(
      admin,
      apiKey,
      cfg.map,
      cfg.name,
      input,
      sessionToken,
      origin,
    );

  if ("errorEnvelope" in predictions) {
    return json(predictions.errorEnvelope);
  }

  return json({
    ok: true,
    predictions: predictions.map(toWire),
    caller: callerName,
    mode,
  });
}

async function runFastSearch(
  admin: SupabaseClient,
  apiKey: string,
  map: MapConfig,
  name: NameConfig,
  input: string,
  sessionToken: string,
  origin: { lat: number; lng: number } | null,
): Promise<LaneItem[] | { errorEnvelope: Record<string, unknown> }> {
  const cap = Math.min(name.fast.count, name.fast.googleCount);
  if (cap <= 0 || googleTypeFilterForTypes(name.fast.types) === "skip") {
    return [];
  }
  const gate = mapWithTypes(map, name.fast.types);
  const googleAuto = await fetchAutocomplete(
    input,
    sessionToken,
    apiKey,
    origin,
  );
  if (googleAuto.errorEnvelope) return { errorEnvelope: googleAuto.errorEnvelope };
  const stamped = await stampGoogleAgainstCatalog(
    googleAuto.predictions,
    admin,
    apiKey,
    gate,
  );
  return takeFastLane(stamped, cap);
}

/** After resolve: Mesita partners, Mesita listed, leftover Google stubs. */
export function splitResolvedNameHits(items: LaneItem[]): NameDeepLanes {
  const partners: LaneItem[] = [];
  const mesita: LaneItem[] = [];
  const google: LaneItem[] = [];
  for (const item of items) {
    if (item.mesitaId && item.partner) partners.push(item);
    else if (item.mesitaId) mesita.push(item);
    else if (item.status === "not_in_mesita" && !item.mesitaId) google.push(item);
  }
  return { partners, mesita, google };
}

function takeLane(items: LaneItem[], cap: number): LaneItem[] {
  if (cap <= 0) return [];
  return items.slice(0, cap);
}

/** Listed-not-partner rows. Partners already fill their own Deep lane. */
export function listedNotPartner<T extends { plan: string | null }>(
  rows: T[],
): T[] {
  return rows.filter((row) => !isPaidPlan(row.plan));
}

/** Same strip as nearby-places — Autocomplete/Text ids may be `places/ChIJ…`. */
export function stripPlacesPrefix(id: string): string {
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

/** Which Deep modules fire. Types off skip Google modules. No OpenAI skips Lineup. */
export function deepModuleFlags(args: {
  autoCount: number;
  partnerCount: number;
  mesitaCount: number;
  googleCount: number;
  typesOn: boolean;
  hasOpenai: boolean;
}): { wantAuto: boolean; wantText: boolean; wantMesita: boolean } {
  return {
    wantAuto: args.autoCount > 0 && args.typesOn,
    wantText: args.googleCount > 0 && args.typesOn,
    wantMesita: (args.partnerCount > 0 || args.mesitaCount > 0) &&
      args.hasOpenai,
  };
}

async function runDeepSearch(
  admin: SupabaseClient,
  apiKey: string,
  map: MapConfig,
  name: NameConfig,
  weights: SignalWeights,
  params: SignalParamsByKey,
  input: string,
  sessionToken: string,
  origin: { lat: number; lng: number } | null,
): Promise<LaneItem[]> {
  const deep = name.deep;
  const gate = mapWithTypes(map, deep.types);
  const typesOn = googleTypeFilterForTypes(deep.types) !== "skip";
  const openaiKey = (Deno.env.get("OPENAI_KEY") ?? "").trim();
  const { wantAuto, wantText, wantMesita } = deepModuleFlags({
    autoCount: deep.autoCount,
    partnerCount: deep.partnerCount,
    mesitaCount: deep.mesitaCount,
    googleCount: deep.googleCount,
    typesOn,
    hasOpenai: Boolean(openaiKey),
  });

  const [googleAuto, googleText, embedPool, queryVec] = await Promise.all([
    wantAuto
      ? fetchAutocomplete(input, sessionToken, apiKey, origin)
      : Promise.resolve({ predictions: [] as LaneItem[] }),
    wantText
      ? fetchTextSearch(input, apiKey, gate, origin, deep.googleCount)
      : Promise.resolve([] as LaneItem[]),
    wantMesita ? fetchEmbedPool(admin, origin) : Promise.resolve([] as ListedRow[]),
    wantMesita ? embedQueryVector(admin, input, openaiKey) : Promise.resolve(null),
  ]);

  const autoPreds = "errorEnvelope" in googleAuto && googleAuto.errorEnvelope
    ? []
    : googleAuto.predictions;

  const [stampedAuto, stampedText] = await Promise.all([
    stampGoogleAgainstCatalog(autoPreds, admin, apiKey, gate),
    stampGoogleAgainstCatalog(
      googleText,
      admin,
      apiKey,
      gate,
      { alreadyHasSignals: true },
    ),
  ]);

  const admitted = queryVec
    ? admitNameFloor(embedPool, queryVec, NAME_MIN_COSINE)
    : [];
  const ordered = queryVec
    ? orderDeepLineup(
      admitted,
      queryVec,
      weightsForMode("deep", weights),
      params,
    )
    : [];
  const lineupPartners = deep.partnerCount > 0
    ? takeListedLane(
      ordered.filter((row) => isPaidPlan(row.plan)),
      deep.partnerCount,
    )
    : [];
  const lineupMesita = deep.mesitaCount > 0
    ? takeListedLane(listedNotPartner(ordered), deep.mesitaCount)
    : [];

  return mergeNameDeepQueries({
    autocomplete: takeLane(stampedAuto, deep.autoCount),
    text: takeLane(stampedText, deep.googleCount),
    mesita: lineupMesita,
    partners: lineupPartners,
  });
}

function toWire(item: LaneItem) {
  return {
    placeId: item.placeId,
    mainText: item.mainText,
    secondaryText: item.secondaryText,
    status: item.status,
    partner: item.partner,
    enriched: item.enriched === true,
    ...(item.mesitaId ? { mesitaId: item.mesitaId } : {}),
    ...(item.mesitaSlug ? { mesitaSlug: item.mesitaSlug } : {}),
    ...(item.lat != null ? { lat: item.lat } : {}),
    ...(item.lng != null ? { lng: item.lng } : {}),
  };
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
  "id, slug, google_place_id, name, address, lat, lng, plan, content_status, enriched_at, name_embedding, embedding";
/** In-process cosine budget — same order as recall-places, not every vector. */
const EMBED_POOL = 300;
const EMBED_RADIUS_KM = 40;

async function fetchEmbedPool(
  admin: SupabaseClient,
  origin: { lat: number; lng: number } | null,
): Promise<ListedRow[]> {
  let query = admin
    .from("profiles")
    .select(EMBED_COLUMNS)
    .in("status", ["active", "lead"])
    .not("name_embedding", "is", null);
  if (origin) {
    const { latDelta, lngDelta } = radiusBoundingBox(origin.lat, EMBED_RADIUS_KM);
    query = query
      .gte("lat", origin.lat - latDelta)
      .lte("lat", origin.lat + latDelta)
      .gte("lng", origin.lng - lngDelta)
      .lte("lng", origin.lng + lngDelta);
  } else {
    query = query.order("created_at", { ascending: false });
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
      };
    }>;
  };
  const predictions = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map<LaneItem>((p) => ({
      placeId: stripPlacesPrefix(p.placeId),
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      status: "not_in_mesita",
      partner: false,
    }))
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
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.primaryType",
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
  const data = (await r.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      rating?: number;
      userRatingCount?: number;
      primaryType?: string;
    }>;
  };
  const out: LaneItem[] = [];
  for (const p of data.places ?? []) {
    if (!p.id || !p.displayName?.text) continue;
    const lat = typeof p.location?.latitude === "number"
      ? p.location.latitude
      : null;
    const lng = typeof p.location?.longitude === "number"
      ? p.location.longitude
      : null;
    const eligible = evaluatePlaceForMap(gate, {
      primaryType: p.primaryType ?? null,
      rating: typeof p.rating === "number" ? p.rating : null,
      reviewCount: typeof p.userRatingCount === "number"
        ? p.userRatingCount
        : null,
    }).eligible;
    if (!eligible) continue;
    out.push({
      placeId: stripPlacesPrefix(p.id),
      mainText: p.displayName.text,
      secondaryText: p.formattedAddress ?? "",
      status: "not_in_mesita",
      partner: false,
      lat,
      lng,
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
  opts: { alreadyHasSignals?: boolean } = {},
): Promise<LaneItem[]> {
  const byGoogleId = new Map<string, ListedRow>();
  const missingIds = items
    .filter((p) => p.status === "not_in_mesita" && p.placeId)
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
    return stamped.filter((p) =>
      p.status !== "not_in_mesita" || Boolean(p.placeId)
    );
  }

  const googleOnly = stamped.filter((p) => p.status === "not_in_mesita");
  if (googleOnly.length === 0) return stamped;
  const signalsById = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof fetchPlaceSignals>>>
  >();
  await Promise.all(googleOnly.map(async (p) => {
    const sig = await fetchPlaceSignals(p.placeId, apiKey);
    if (sig) signalsById.set(p.placeId, sig);
  }));
  return stamped.filter((p) => {
    if (p.status !== "not_in_mesita") return true;
    const sig = signalsById.get(p.placeId);
    if (!sig) return false;
    const ok = evaluatePlaceForMap(gate, {
      primaryType: sig.primaryType,
      rating: sig.rating,
      reviewCount: sig.reviewCount,
    }).eligible;
    if (ok && p.lat == null && sig.lat != null) p.lat = sig.lat;
    if (ok && p.lng == null && sig.lng != null) p.lng = sig.lng;
    return ok;
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
    // enrichment fact as the embedding pool.
    .select(EMBED_COLUMNS)
    .in("google_place_id", placeIds)
    .in("status", ["active", "lead"]);
  if (error) {
    console.error("[consumer-search-lane] enrich:", error.message);
    return [];
  }
  return (data ?? []) as ListedRow[];
}
