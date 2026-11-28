import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useState } from "react";

import { useSession } from "@/features/auth";

import {
  fillCatalog,
  getShareCode,
  listPlaces,
  listSaved,
  rankCatalog,
  listSavedPins,
  recordShare,
  resolveLocation,
  savePin,
  setSaved,
  suggestLocations,
  suggestPlaces,
  type CatalogRank,
  type MapBounds,
  type SavedPlaces,
} from "./api";
import { questionOf, type ChipKey } from "./families";
import { pageIds, uniquePlaces, type ActiveLocation, type CatalogPlace, type Point } from "./model";

export const discoveryKeys = {
  all: ["discovery"] as const,
  catalog: (point: Point | null, chip: ChipKey) =>
    ["discovery", "catalog", point?.lat ?? null, point?.lng ?? null, chip] as const,
  map: (point: Point | null, chip: ChipKey, n = 0) =>
    ["discovery", "map", point?.lat ?? null, point?.lng ?? null, chip, n] as const,
  saved: (guestId: string | null) => ["discovery", "saved", guestId] as const,
  locations: (input: string) => ["discovery", "locations", input] as const,
};

type Page = { rank: CatalogRank; places: CatalogPlace[] };
type PageParam = { page: number; rank: CatalogRank | null };

export function useCatalog(location: ActiveLocation | null, chip: ChipKey) {
  const question = questionOf(chip);
  const query = useInfiniteQuery({
    queryKey: discoveryKeys.catalog(location, chip),
    enabled: location !== null && chip !== "saved" && chip !== "social",
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
  return {
    ...query,
    places: uniquePlaces(query.data?.pages.map((p) => p.places) ?? []),
    /** The first page's rank: ad slots, lanes, the pre-shuffle order, the score switch. */
    rank: query.data?.pages[0]?.rank ?? null,
  };
}

/** The last rank a chip got, read from the cache only: never a fetch. */
export function useCachedRank(location: ActiveLocation | null, chip: ChipKey): CatalogRank | null {
  const client = useQueryClient();
  return client.getQueryData<{ pages: Page[] }>(discoveryKeys.catalog(location, chip))?.pages[0]?.rank ?? null;
}

/** The map's places and its extra pins, for the families that are on, read
 *  at the sight (`at`, with the visible map). The last answer stays while a
 *  reload is in flight: the web dims the old cards, it never blanks them. */
export function useMapPlaces(at: { point: Point; bounds: MapBounds | null; n: number } | null, chip: ChipKey) {
  const familyKeys = questionOf(chip).familyKeys;
  return useQuery({
    queryKey: discoveryKeys.map(at?.point ?? null, chip, at?.n ?? 0),
    queryFn: ({ signal }) => listPlaces(at?.point as Point, familyKeys, at?.bounds ?? null, signal),
    enabled: at !== null,
    placeholderData: keepPreviousData,
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

/** The member's share code (MESITA-5060); null for a visitor or before it lands. */
export function useShareCode(): string | null {
  const guestId = useSession().guestId;
  const member = guestId !== null;
  const q = useQuery({ queryKey: ["share-code", guestId], queryFn: getShareCode, enabled: member, staleTime: Infinity });
  return member ? (q.data ?? null) : null;
}

/** `sessionToken` groups one search's keystrokes for Google's billing. The
 *  search leaves once typing has rested the server's idle seconds (the web's
 *  Word idle, 1 s until the first answer names it). */
export function usePlaceSearch(input: string, sessionToken: string, member: boolean, origin: Point | null) {
  const term = input.trim();
  const [idleMs, setIdleMs] = useState(1000);
  // A rested term carries the session it was typed in. A renewed token (a
  // pick, an open, a clear) applies from the next keystroke: the open term
  // is never searched again, as on the web.
  const [rested, setRested] = useState({ term, token: sessionToken });
  const rest = useEffectEvent(() => setRested({ term, token: sessionToken }));
  // A pick, a clear or a term under 2 ends the search at once (the web's
  // setPredictions([])): adjusted during render, React's documented pattern.
  if (term.length < 2 && rested.term !== "") setRested({ term: "", token: sessionToken });
  useEffect(() => {
    const id = setTimeout(rest, idleMs);
    return () => clearTimeout(id);
  }, [term, idleMs]);
  const settled = rested.term;
  const query = useQuery({
    queryKey: ["place-search", settled, rested.token],
    queryFn: async ({ signal }) => {
      const answer = await suggestPlaces(settled, rested.token, origin, signal);
      if (answer.idleSec !== null) setIdleMs(Math.round(answer.idleSec * 1000));
      return answer.rows;
    },
    enabled: member && settled.length >= 2,
    // The last rows stay while the next search runs, but never across a
    // search that ended (a pick or a clear empties the list, as on the web).
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === rested.token && term.length >= 2 ? previous : undefined,
  });
  // Waiting out the idle counts as searching (the web's spinner shows at once).
  return { ...query, waiting: term.length >= 2 && term !== settled };
}

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

export function useSavedPins(member: boolean) {
  return useQuery({
    queryKey: ["saved-pins"],
    queryFn: ({ signal }) => listSavedPins(signal),
    enabled: member,
  });
}

export function useSavePin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: savePin,
    onSuccess: () => client.invalidateQueries({ queryKey: ["saved-pins"] }),
  });
}
