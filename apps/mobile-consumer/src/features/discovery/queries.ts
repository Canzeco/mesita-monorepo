import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/features/auth";

import {
  fillCatalog,
  listPlaces,
  listSaved,
  rankCatalog,
  recordShare,
  resolveLocation,
  setSaved,
  suggestLocations,
  type CatalogRank,
  type SavedPlaces,
} from "./api";
import { questionOf, type ChipKey } from "./families";
import { pageIds, uniquePlaces, type ActiveLocation, type CatalogPlace, type Point } from "./model";

export const discoveryKeys = {
  all: ["discovery"] as const,
  catalog: (point: Point | null, chip: ChipKey) =>
    ["discovery", "catalog", point?.lat ?? null, point?.lng ?? null, chip] as const,
  map: (point: Point | null, chip: ChipKey) =>
    ["discovery", "map", point?.lat ?? null, point?.lng ?? null, chip] as const,
  saved: (guestId: string | null) => ["discovery", "saved", guestId] as const,
  locations: (input: string) => ["discovery", "locations", input] as const,
};

type Page = { rank: CatalogRank; places: CatalogPlace[] };
type PageParam = { page: number; rank: CatalogRank | null };

export function useCatalog(location: ActiveLocation | null, chip: ChipKey) {
  const question = questionOf(chip);
  const query = useInfiniteQuery({
    queryKey: discoveryKeys.catalog(location, chip),
    enabled: location !== null && chip !== "saved",
    initialPageParam: { page: 0, rank: null } as PageParam,
    queryFn: async ({ pageParam, signal }): Promise<Page> => {
      const point = location as Point;
      if (!pageParam.rank) {
        const rank = await rankCatalog(point, question, signal);
        return { rank, places: rank.places };
      }
      const { rank, page } = pageParam;
      const fill = pageIds(rank.order, rank.places.length, page);
      return { rank, places: await fillCatalog(point, question, rank, fill, signal) };
    },
    getNextPageParam: (last, _pages, { page }): PageParam | undefined =>
      pageIds(last.rank.order, last.rank.places.length, page + 1).length > 0
        ? { page: page + 1, rank: last.rank }
        : undefined,
  });
  return { ...query, places: uniquePlaces(query.data?.pages.map((p) => p.places) ?? []) };
}

/** The map's places and its extra pins, for the families that are on. */
export function useMapPlaces(location: ActiveLocation | null, chip: ChipKey) {
  const familyKeys = questionOf(chip).familyKeys;
  return useQuery({
    queryKey: discoveryKeys.map(location, chip),
    queryFn: ({ signal }) => listPlaces(location as Point, familyKeys, signal),
    enabled: location !== null,
  });
}

export function useSaved() {
  const { guestId } = useSession();
  return useQuery({
    queryKey: discoveryKeys.saved(guestId),
    queryFn: ({ signal }) => listSaved(signal),
    enabled: guestId !== null,
  });
}

/** Save or unsave: shown at once, put back if it fails, then re-read. */
export function useToggleSaved() {
  const { guestId } = useSession();
  const client = useQueryClient();
  const key = discoveryKeys.saved(guestId);
  return useMutation({
    mutationFn: ({ place, on }: { place: CatalogPlace; on: boolean }) => setSaved(place.id, on),
    onMutate: async ({ place, on }) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<SavedPlaces>(key);
      client.setQueryData<SavedPlaces>(key, withSaved(before, place, on));
      return { before };
    },
    onError: (_err, _vars, context) => client.setQueryData(key, context?.before),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}

export function withSaved(saved: SavedPlaces | undefined, place: CatalogPlace, on: boolean): SavedPlaces {
  const ids = (saved?.ids ?? []).filter((id) => id !== place.id);
  const places = (saved?.places ?? []).filter((p) => p.id !== place.id);
  return on ? { ids: [place.id, ...ids], places: [place, ...places] } : { ids, places };
}

export function useRecordShare() {
  return useMutation({ mutationFn: recordShare });
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
