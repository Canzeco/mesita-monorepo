import { z } from "zod";

import { callEdge } from "@/lib/edge";

import type { Question } from "./families";
import type { CatalogPlace, Point } from "./model";

// Every answer here is a tolerant reader: the id is needed, the rest may go.

const text = z.string().nullish().catch(null);
const number = z.coerce.number().nullish().catch(null);
const orNull = <T,>(v: T | null | undefined): T | null => v ?? null;

export const placeSchema = z
  .object({
    id: z.string(),
    slug: text,
    name: text,
    category: text,
    category_label: text,
    profile_photo: text,
    photos: z.array(z.string()).catch([]),
    price_level: number,
    google_stars_overall: number,
    google_review_count: number,
    hours: z.unknown().optional(),
    timezone: text,
    zone: text,
    distance_km: number,
    boost_tier: number,
    ad: z.boolean().optional().catch(false),
    lat: number,
    lng: number,
  })
  .transform(
    (p): CatalogPlace => ({
      id: p.id,
      slug: orNull(p.slug),
      name: p.name ?? "",
      category: p.category_label ?? p.category ?? null,
      photo: p.profile_photo ?? p.photos[0] ?? null,
      priceLevel: orNull(p.price_level),
      rating: orNull(p.google_stars_overall),
      reviews: orNull(p.google_review_count),
      hours: p.hours,
      timezone: orNull(p.timezone),
      zone: orNull(p.zone),
      distanceKm: orNull(p.distance_km),
      isPremier: (p.boost_tier ?? 0) > 0,
      isAd: p.ad === true,
      lat: orNull(p.lat),
      lng: orNull(p.lng),
    }),
  );

const ids = z.array(z.string()).catch([]);

export const rankSchema = z.object({
  order: z.array(z.string()),
  adIds: ids,
  laneOf: z.record(z.string(), z.string()).catch({}),
  places: z.array(placeSchema),
});
export type CatalogRank = z.infer<typeof rankSchema>;

const ask = (point: Point, question: Question) => ({
  lat: point.lat,
  lng: point.lng,
  rankMode: question.rankMode,
  ...(question.familyKeys.length > 0 ? { familyKeys: question.familyKeys } : {}),
});

/** A read: ranks every place from a point; the first page comes with cards. */
export function rankCatalog(point: Point, question: Question, signal?: AbortSignal): Promise<CatalogRank> {
  return callEdge("consumer-web-list-catalog", ask(point, question), rankSchema, { signal });
}

/** A read: the cards of ranked ids, in that order. Nothing is ranked again. */
export async function fillCatalog(
  point: Point,
  question: Question,
  rank: CatalogRank,
  fill: string[],
  signal?: AbortSignal,
) {
  const body = {
    ...ask(point, question),
    fill,
    adIds: rank.adIds.filter((id) => fill.includes(id)),
    laneOf: Object.fromEntries(Object.entries(rank.laneOf).filter(([id]) => fill.includes(id))),
  };
  const answer = await callEdge("consumer-web-list-catalog", body, z.object({ places: z.array(placeSchema) }), { signal });
  return answer.places;
}

const mapSchema = z.object({
  places: z.array(placeSchema).catch([]),
  dots: z.array(z.unknown()).catch([]),
});

export type MapDot = { id: string; lat: number; lng: number; premier: boolean };
export type MapAnswer = { places: CatalogPlace[]; dots: MapDot[] };

/** Search's map. The same read the web map makes: a centre, and the families that are on. */
export async function listPlaces(point: Point, familyKeys: readonly string[], signal?: AbortSignal): Promise<MapAnswer> {
  const answer = await callEdge(
    "consumer-web-list-places",
    {
      google: true,
      lat: point.lat,
      lng: point.lng,
      ...(familyKeys.length > 0 ? { familyKeys: [...familyKeys] } : {}),
    },
    mapSchema,
    { signal },
  );
  const dots = answer.dots.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const dot = raw as { id?: unknown; lat?: unknown; lng?: unknown; premier?: unknown };
    if (typeof dot.id !== "string" || typeof dot.lat !== "number" || typeof dot.lng !== "number") return [];
    if (!Number.isFinite(dot.lat) || !Number.isFinite(dot.lng)) return [];
    return [{ id: dot.id, lat: dot.lat, lng: dot.lng, premier: dot.premier === true }];
  });
  return { places: answer.places, dots };
}

export type SavedPlaces = { ids: string[]; places: CatalogPlace[] };

/** A read, members only: my saves, newest first. */
export function listSaved(signal?: AbortSignal): Promise<SavedPlaces> {
  const schema = z.object({ ids, places: z.array(placeSchema).catch([]) });
  return callEdge("consumer-web-list-saved-places", {}, schema, { signal });
}

/** A mutation with no request id: the same save twice is one save. */
export async function setSaved(placeId: string, on: boolean): Promise<void> {
  const body = { kind: "saved", place_id: placeId, on };
  await callEdge("consumer-web-track-activity", body, z.object({}), { mutation: true });
}

/** A mutation with no request id: one row per guest and place. Members only. */
export async function recordShare(placeId: string): Promise<void> {
  await callEdge("consumer-web-track-place-share", { place_id: placeId }, z.object({}), { mutation: true });
}

const suggestionSchema = z.object({ placeId: z.string(), mainText: z.string(), secondaryText: text, kind: text });

export type Suggestion = { placeId: string; mainText: string; secondaryText: string | null; kind: string | null };

/** Every suggestion the bar can show: a place or a location. */
export async function suggestPlaces(input: string, sessionToken: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const answer = await callEdge(
    "consumer-web-suggest-places",
    { input, sessionToken, mode: "fast" },
    z.object({ predictions: z.array(suggestionSchema) }),
    { signal },
  );
  return answer.predictions.map((row) => ({
    placeId: row.placeId,
    mainText: row.mainText,
    secondaryText: row.secondaryText ?? null,
    kind: row.kind ?? null,
  }));
}

/** A read that costs a Google lookup: members only, as on the web. */
export async function suggestLocations(input: string, sessionToken: string, signal?: AbortSignal) {
  const answer = await callEdge(
    "consumer-web-suggest-places",
    { input, sessionToken, mode: "fast" },
    z.object({ predictions: z.array(suggestionSchema) }),
    { signal },
  );
  return answer.predictions.filter((p) => p.kind === "location");
}

/** A read, once per pick: where the chosen location is. */
export async function resolveLocation(placeId: string): Promise<Point> {
  const answer = await callEdge(
    "consumer-web-suggest-places",
    { anchorPlaceId: placeId },
    z.object({ anchor: z.object({ lat: z.number(), lng: z.number() }) }),
  );
  return answer.anchor;
}

export type PlacePreview = {
  name: string;
  address: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  photoUrl: string | null;
  canAdd: boolean;
  message: string;
};

/** Google's facts for one place, before it is created. */
export async function previewGooglePlace(placeId: string, signal?: AbortSignal): Promise<PlacePreview> {
  const answer = await callEdge(
    "consumer-web-suggest-places",
    { previewPlaceId: placeId },
    z.object({
      preview: z.object({
        name: z.string().catch(""),
        address: text,
        category: text,
        rating: number,
        reviewCount: number,
        photoUrl: text,
      }),
      addable: z.object({ canAdd: z.boolean().catch(true), message: z.string().catch("") }).nullish().catch(null),
    }),
    { signal },
  );
  return {
    name: answer.preview.name,
    address: answer.preview.address ?? null,
    category: answer.preview.category ?? null,
    rating: answer.preview.rating ?? null,
    reviewCount: answer.preview.reviewCount ?? null,
    photoUrl: answer.preview.photoUrl ?? null,
    canAdd: answer.addable?.canAdd ?? true,
    message: answer.addable?.message ?? "",
  };
}
