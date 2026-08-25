// Consumer Search name-bar: ONE merged lane from four sources.
//
// Used only by consumer-web-suggest-places. Admin/business still call
// suggestPlaces (Autocomplete + Mesita ILIKE, Mesita-first sort). This
// path is the Map engine's type-to-find: no section headers, membership
// expressed by the colored point on the client (partner / listed / google).
//
// Rank, then merge, then cap:
//   1. Google Places Autocomplete
//   2. Google Places Text Search
//   3. Mesita name embedding (places.name_embedding)
//   4. Mesita summary embedding (places.embedding)
// Same venue from two sources keeps the higher-priority SLOT; Mesita
// identity/partner still grafts onto that slot so the dot is not yellow
// for a place we already list. Dedupe key is google_place_id, then Mesita id.

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
  googleTypeFilterForPolicy,
  type GoogleTypeFilter,
  type PredictionStatus,
} from "./suggest-places-helpers.ts";
import {
  applyPlacesAutocompleteRegion,
  applyPlacesTextSearchRegion,
  evaluatePlaceForChannel,
  readChannelPolicy,
  type ChannelPolicy,
} from "./sourcing.ts";
import { embedSingle } from "./embeddings-http.ts";
import { resolveEmbeddingModel } from "./embeddings.ts";
import { cosineSim, parseVector } from "./embeddings-vector.ts";
import { isPaidPlan } from "./membership-enforcement-helpers.ts";

export const SEARCH_LANE_CAP = 10;

/** Cosine floor so a vibe mismatch does not fill the name bar. */
export const NAME_MIN_COSINE = 0.4;
export const SUMMARY_MIN_COSINE = 0.3;

export const SEARCH_LANE_SOURCES = [
  "autocomplete",
  "text",
  "name",
  "summary",
] as const;

export type SearchLaneSource = typeof SEARCH_LANE_SOURCES[number];

export type LaneItem = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: PredictionStatus;
  partner: boolean;
  mesitaId?: string;
  mesitaSlug?: string;
  lat?: number | null;
  lng?: number | null;
};

export type MembershipTone = "partner" | "listed" | "google";

export function membershipTone(item: {
  status: string;
  partner?: boolean | null;
}): MembershipTone {
  if (item.status === "not_in_mesita") return "google";
  if (item.partner) return "partner";
  return "listed";
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

function graftMesitaOnto(slot: LaneItem, incoming: LaneItem): void {
  if (slot.status === "not_in_mesita" && incoming.status !== "not_in_mesita") {
    slot.status = incoming.status;
    slot.partner = incoming.partner;
  } else if (!slot.partner && incoming.partner) {
    slot.partner = true;
  }
  if (slot.mainText.trim() === "" && incoming.mainText) {
    slot.mainText = incoming.mainText;
  }
  if (!slot.secondaryText && incoming.secondaryText) {
    slot.secondaryText = incoming.secondaryText;
  }
  if (slot.lat == null && incoming.lat != null) slot.lat = incoming.lat;
  if (slot.lng == null && incoming.lng != null) slot.lng = incoming.lng;
  if (!slot.mesitaId && incoming.mesitaId) slot.mesitaId = incoming.mesitaId;
  if (!slot.mesitaSlug && incoming.mesitaSlug) {
    slot.mesitaSlug = incoming.mesitaSlug;
  }
}

/**
 * Walk sources in rank order. New unique venues take a slot until cap 10.
 * A later source that matches an earlier slot grafts Mesita identity onto
 * it and never adds a second row. Once the cap is full, later sources
 * may still graft, never append.
 */
export function mergeSearchLane(
  lanes: Record<SearchLaneSource, LaneItem[]>,
  cap = SEARCH_LANE_CAP,
): LaneItem[] {
  const byKey = new Map<string, LaneItem>();
  const order: LaneItem[] = [];

  const findExisting = (item: LaneItem): LaneItem | undefined => {
    for (const key of laneDedupeKeys(item)) {
      const hit = byKey.get(key);
      if (hit) return hit;
    }
    return undefined;
  };

  const register = (item: LaneItem): void => {
    for (const key of laneDedupeKeys(item)) byKey.set(key, item);
  };

  for (const source of SEARCH_LANE_SOURCES) {
    for (const raw of lanes[source]) {
      if (!raw.placeId && !raw.mesitaId) continue;
      const existing = findExisting(raw);
      if (existing) {
        graftMesitaOnto(existing, raw);
        register(existing);
        continue;
      }
      if (order.length >= cap) continue;
      const item: LaneItem = { ...raw };
      order.push(item);
      register(item);
    }
  }
  return order.slice(0, cap);
}

export type ConsumerSearchArgs = {
  input?: string;
  sessionToken?: string;
  lat?: number | null;
  lng?: number | null;
};

type ListedRow = {
  id: string;
  slug: string;
  google_place_id: string | null;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  plan: string | null;
  name_embedding: unknown | null;
  embedding: unknown | null;
};

function listedToLane(row: ListedRow): LaneItem | null {
  const gid = row.google_place_id?.trim();
  if (!gid && !row.id) return null;
  return {
    placeId: gid ?? "",
    mainText: String(row.name ?? ""),
    secondaryText: row.address ?? "",
    status: "web_listed",
    partner: isPaidPlan(row.plan),
    mesitaId: row.id,
    mesitaSlug: row.slug,
    lat: row.lat,
    lng: row.lng,
  };
}

function rankByEmbedding(
  rows: ListedRow[],
  queryVec: number[],
  kind: "name" | "summary",
  minCosine: number,
  limit: number,
): LaneItem[] {
  const scored = rows.map((row) => {
    const raw = kind === "name" ? row.name_embedding : row.embedding;
    const vec = parseVector(raw);
    const score = vec && vec.length === queryVec.length
      ? cosineSim(vec, queryVec)
      : -1;
    return { row, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const out: LaneItem[] = [];
  for (const { row, score } of scored) {
    if (score < minCosine) continue;
    const item = listedToLane(row);
    if (!item || !item.mainText) continue;
    out.push(item);
    if (out.length >= limit) break;
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
  const policy = await readChannelPolicy(admin, "consumer_search");
  const typeFilter = googleTypeFilterForPolicy(policy);

  const openaiKey = (Deno.env.get("OPENAI_KEY") ?? "").trim();

  const [googleAuto, googleText, catalog, queryVec] = await Promise.all([
    typeFilter === "skip"
      ? Promise.resolve({ predictions: [] as LaneItem[], errorEnvelope: undefined })
      : fetchAutocomplete(input, sessionToken, apiKey, typeFilter, policy, origin),
    typeFilter === "skip"
      ? Promise.resolve([] as LaneItem[])
      : fetchTextSearch(input, apiKey, policy, origin),
    fetchListedCatalog(admin),
    embedQueryVector(admin, input, openaiKey),
  ]);

  if (googleAuto.errorEnvelope && googleText.length === 0 && catalog.length === 0) {
    return json(googleAuto.errorEnvelope);
  }

  const byGoogleId = new Map<string, ListedRow>();
  for (const row of catalog) {
    if (row.google_place_id) byGoogleId.set(row.google_place_id, row);
  }

  const nameHits = queryVec
    ? rankByEmbedding(catalog, queryVec, "name", NAME_MIN_COSINE, SEARCH_LANE_CAP)
    : [];
  const summaryHits = queryVec
    ? rankByEmbedding(
      catalog,
      queryVec,
      "summary",
      SUMMARY_MIN_COSINE,
      SEARCH_LANE_CAP,
    )
    : [];

  const autocomplete = await stampGoogleAgainstCatalog(
    googleAuto.predictions,
    byGoogleId,
    admin,
    apiKey,
    policy,
  );
  const text = await stampGoogleAgainstCatalog(
    googleText,
    byGoogleId,
    admin,
    apiKey,
    policy,
    { alreadyHasSignals: true },
  );

  const predictions = mergeSearchLane({
    autocomplete,
    text,
    name: nameHits,
    summary: summaryHits,
  });

  return json({
    ok: true,
    predictions: predictions.map(toWire),
    caller: callerName,
  });
}

function toWire(item: LaneItem) {
  return {
    placeId: item.placeId,
    mainText: item.mainText,
    secondaryText: item.secondaryText,
    status: item.status,
    partner: item.partner,
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

async function fetchListedCatalog(admin: SupabaseClient): Promise<ListedRow[]> {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, slug, google_place_id, name, address, lat, lng, plan, name_embedding, embedding",
    )
    .in("status", ["active", "lead"])
    .not("google_place_id", "is", null)
    .limit(500);
  if (error) {
    console.error("[consumer-search-lane] catalog:", error.message);
    return [];
  }
  return (data ?? []) as ListedRow[];
}

async function fetchAutocomplete(
  input: string,
  sessionToken: string,
  apiKey: string,
  typeFilter: GoogleTypeFilter,
  policy: ChannelPolicy,
  origin: { lat: number; lng: number } | null,
): Promise<{ predictions: LaneItem[]; errorEnvelope?: Record<string, unknown> }> {
  const body: Record<string, unknown> = { input, sessionToken };
  applyPlacesAutocompleteRegion(body, policy, origin);
  if (typeFilter === "legacy") {
    body.includedPrimaryTypes = [
      "restaurant",
      "bar",
      "cafe",
      "night_club",
      "bakery",
    ];
  }
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
      placeId: p.placeId,
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
  policy: ChannelPolicy,
  origin: { lat: number; lng: number } | null,
): Promise<LaneItem[]> {
  const body: Record<string, unknown> = {
    textQuery: input,
    maxResultCount: SEARCH_LANE_CAP,
  };
  applyPlacesTextSearchRegion(body, policy, origin);
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
    const eligible = evaluatePlaceForChannel(policy, {
      primaryType: p.primaryType ?? null,
      rating: typeof p.rating === "number" ? p.rating : null,
      reviewCount: typeof p.userRatingCount === "number"
        ? p.userRatingCount
        : null,
    }, { lat, lng }).eligible;
    if (!eligible) continue;
    out.push({
      placeId: p.id,
      mainText: p.displayName.text,
      secondaryText: p.formattedAddress ?? "",
      status: "not_in_mesita",
      partner: false,
      lat,
      lng,
    });
  }
  return out;
}

async function stampGoogleAgainstCatalog(
  items: LaneItem[],
  byGoogleId: Map<string, ListedRow>,
  admin: SupabaseClient,
  apiKey: string,
  policy: ChannelPolicy,
  opts: { alreadyHasSignals?: boolean } = {},
): Promise<LaneItem[]> {
  const missingIds = items
    .filter((p) => p.status === "not_in_mesita" && !byGoogleId.has(p.placeId))
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
    return {
      ...item,
      status: mesita.status,
      partner: mesita.partner,
      mesitaId: mesita.mesitaId,
      mesitaSlug: mesita.mesitaSlug,
      lat: item.lat ?? mesita.lat,
      lng: item.lng ?? mesita.lng,
      mainText: item.mainText || mesita.mainText,
      secondaryText: item.secondaryText || mesita.secondaryText,
    };
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
    const ok = evaluatePlaceForChannel(policy, {
      primaryType: sig.primaryType,
      rating: sig.rating,
      reviewCount: sig.reviewCount,
    }, { lat: sig.lat, lng: sig.lng, country: sig.country }).eligible;
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
    .select(
      "id, slug, google_place_id, name, address, lat, lng, plan, name_embedding, embedding",
    )
    .in("google_place_id", placeIds)
    .in("status", ["active", "lead"]);
  if (error) {
    console.error("[consumer-search-lane] enrich:", error.message);
    return [];
  }
  return (data ?? []) as ListedRow[];
}
