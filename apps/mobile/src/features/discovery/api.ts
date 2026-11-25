import { z } from "zod";

import { callEdge } from "@/lib/edge";

import type { CatalogPlace, Point } from "./model";

// Every answer here is a tolerant reader: the id is needed, the rest may go.

const text = z.string().nullish().catch(null);

const placeSchema = z
  .object({
    id: z.string(),
    name: text,
    category_label: text,
    profile_photo: text,
    photos: z.array(z.string()).catch([]),
    ad: z.boolean().optional().catch(false),
  })
  .transform(
    (p): CatalogPlace => ({
      id: p.id,
      name: p.name ?? "",
      category: p.category_label ?? null,
      photo: p.profile_photo ?? p.photos[0] ?? null,
      isAd: p.ad === true,
    }),
  );

export const rankSchema = z.object({
  order: z.array(z.string()),
  adIds: z.array(z.string()).catch([]),
  laneOf: z.record(z.string(), z.string()).catch({}),
  places: z.array(placeSchema),
});
export type CatalogRank = z.infer<typeof rankSchema>;

/** A read: ranks every place from a point; the first page comes with cards. */
export function rankCatalog(point: Point, signal?: AbortSignal): Promise<CatalogRank> {
  const body = { lat: point.lat, lng: point.lng, rankMode: "popular" };
  return callEdge("consumer-web-list-catalog", body, rankSchema, { signal });
}

/** A read: the cards of ranked ids, in that order. Nothing is ranked again. */
export async function fillCatalog(point: Point, rank: CatalogRank, fill: string[], signal?: AbortSignal) {
  const body = {
    lat: point.lat,
    lng: point.lng,
    rankMode: "popular",
    fill,
    adIds: rank.adIds.filter((id) => fill.includes(id)),
    laneOf: Object.fromEntries(Object.entries(rank.laneOf).filter(([id]) => fill.includes(id))),
  };
  const answer = await callEdge("consumer-web-list-catalog", body, z.object({ places: z.array(placeSchema) }), { signal });
  return answer.places;
}

const suggestionSchema = z.object({ placeId: z.string(), mainText: z.string(), secondaryText: text, kind: text });

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
