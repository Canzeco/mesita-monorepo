import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import { fillCatalog, rankCatalog, resolveLocation, suggestLocations, type CatalogRank } from "./api";
import { pageIds, uniquePlaces, type ActiveLocation, type CatalogPlace, type Point } from "./model";

export const discoveryKeys = {
  all: ["discovery"] as const,
  catalog: (point: Point | null) => ["discovery", "catalog", point?.lat ?? null, point?.lng ?? null] as const,
  locations: (input: string) => ["discovery", "locations", input] as const,
};

type Page = { rank: CatalogRank; places: CatalogPlace[] };
type PageParam = { page: number; rank: CatalogRank | null };

export function useCatalog(location: ActiveLocation | null) {
  const query = useInfiniteQuery({
    queryKey: discoveryKeys.catalog(location),
    enabled: location !== null,
    initialPageParam: { page: 0, rank: null } as PageParam,
    queryFn: async ({ pageParam, signal }): Promise<Page> => {
      const point = location as Point;
      if (!pageParam.rank) {
        const rank = await rankCatalog(point, signal);
        return { rank, places: rank.places };
      }
      const { rank, page } = pageParam;
      return { rank, places: await fillCatalog(point, rank, pageIds(rank.order, rank.places.length, page), signal) };
    },
    getNextPageParam: (last, _pages, { page }): PageParam | undefined =>
      pageIds(last.rank.order, last.rank.places.length, page + 1).length > 0
        ? { page: page + 1, rank: last.rank }
        : undefined,
  });
  return { ...query, places: uniquePlaces(query.data?.pages.map((p) => p.places) ?? []) };
}

/** `sessionToken` groups one search's keystrokes for Google's billing. */
export function useLocationSearch(input: string, sessionToken: string, member: boolean) {
  const term = input.trim();
  return useQuery({
    queryKey: discoveryKeys.locations(term),
    queryFn: ({ signal }) => suggestLocations(term, sessionToken, signal),
    enabled: member && term.length >= 3,
    placeholderData: keepPreviousData,
  });
}

export function useResolveLocation() {
  return useMutation({ mutationFn: (placeId: string) => resolveLocation(placeId) });
}
