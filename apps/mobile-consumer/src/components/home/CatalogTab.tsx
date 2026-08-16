import { ArrowUpDown, Compass, SlidersHorizontal } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import {
  withUserDistance,
  type Coords,
} from '@/components/swipe/swipe-deck-shells';
import { useHomeDeck } from '@/hooks/use-home-deck';
import type { Place } from '@/lib/api/places';
import { filtersPath } from '@/lib/consumer-route-contract';
import {
  applyDiscoveryFilters,
  deriveCategoryOptions,
  discoveryFiltersAreActive,
} from '@/lib/discovery-filters-engine';
import { publishFiltersHostContext } from '@/lib/filters-host-context';
import { pairs } from '@/lib/grid-pairs';
import { enrichPlaceOverview } from '@/lib/place-overview';
import {
  resetDiscoveryFilters,
  useDiscoveryFilters,
} from '@/lib/use-discovery-filters';
import { upsertSavedPlacePreview, useSavedPlaces } from '@/lib/saved-places';

import { FavoriteTile } from './FavoriteTile';

// Catalog mode — mirror of web components/consumer/home/CatalogGrid.tsx.
//
// The full deck as a browsable, filterable grid: Swipe's data with Swipe's
// verdict removed — no cards, no gestures, no seen-set. A place you scrolled
// past is still there when you scroll back, which is the whole difference
// between browsing and deciding.
//
// Reuse, deliberately: the same shared deck query Favorites resolves against
// (react-query dedupes it — switching modes never re-runs the recommender),
// the same FavoriteTile, and the same routed filters sheet Swipe publishes
// into. Catalog adds no data layer of its own.
//
// Ordering: deck order (partners first) or open-first. Explicitly NOT
// randomness-ordered — that knob exists so a swipe deck doesn't feel like the
// same deck twice, and a catalog you can't find a place in again would be
// broken, not fresh.

/** Past this count the grid earns a sort control; below it, it's chrome. */
const SORT_CONTROL_MIN = 4;

type Sort = 'suggested' | 'open';

export function CatalogTab() {
  const router = useRouter();
  const deckQuery = useHomeDeck();
  const { savedIds, setSaved } = useSavedPlaces();
  const [sort, setSort] = useState<Sort>('suggested');
  const [coords, setCoords] = useState<Coords | null>(null);

  const filters = useDiscoveryFilters();
  const filtersActive = discoveryFiltersAreActive(filters);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const deckPlaces = useMemo(
    () => (deckQuery.data ?? []).map((p) => enrichPlaceOverview(p)),
    [deckQuery.data],
  );

  // Distances measure from the chosen zone center (a searched location) or, with
  // none, the device fix — the SAME center the distance filter rings.
  const center: Coords | null = filters.zone ?? coords;
  const located = useMemo(
    () => deckPlaces.map((p) => withUserDistance(p, center)),
    [deckPlaces, center],
  );

  const filtered = useMemo(
    () => applyDiscoveryFilters(located, filters),
    [located, filters],
  );

  const ordered = useMemo(() => {
    if (sort === 'suggested') return filtered;
    // Open first, each group keeping deck order (Array.sort is stable).
    return [...filtered].sort(
      (a, b) => Number(b.open_now === true) - Number(a.open_now === true),
    );
  }, [filtered, sort]);

  // Category options derive from the RAW deck, not the filtered view, so the
  // sheet keeps offering everything the catalog actually has — a narrowed list
  // can't be widened again from inside itself.
  const categoryOptions = useMemo(
    () => deriveCategoryOptions(deckPlaces),
    [deckPlaces],
  );

  useEffect(() => {
    publishFiltersHostContext({
      surface: 'catalog',
      count: filtered.length,
      categoryOptions,
      hasLocation: coords != null,
    });
  }, [filtered.length, categoryOptions, coords]);

  const openFilters = () => router.push(filtersPath());

  // Saving from the grid is one tap with no dialog — it's the non-destructive
  // direction. Unsaving here is too: the confirm dialog lives in Favorites,
  // where removing is the destructive act on a curated list. Here the heart is
  // a bookmark toggle over the whole catalog.
  const toggleSave = (place: Place, saved: boolean) => {
    if (saved) {
      setSaved(place.id, false);
      return;
    }
    upsertSavedPlacePreview(place);
    setSaved(place.id, true);
  };

  if (deckQuery.isLoading && deckPlaces.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#fb2b7b" />
      </View>
    );
  }

  if (deckQuery.isError) {
    return (
      <EmptyState
        icon={Compass}
        title="Couldn't load the catalog"
        description="Tonight's places didn't come back. Pull the tab again in a moment."
        action={{ label: 'Try again', onPress: () => void deckQuery.refetch() }}
      />
    );
  }

  if (deckPlaces.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="No places yet"
        description="The catalog is still filling up. Check back soon."
      />
    );
  }

  // Filters excluding everything is a distinct state from an empty catalog —
  // the deck isn't empty, the filters did it, and the fix is a button not a wait.
  const filterEmptied = filtered.length === 0;
  const openNow = filtered.filter((p) => p.open_now === true).length;

  return (
    // Header sits OUTSIDE the scroller: the count is a live region and the
    // Filters button is the fix for the empty state below it — both have to
    // stay reachable when the grid is scrolled or gone.
    <View className="flex-1">
      <View className="shrink-0 px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between gap-2 px-1">
          <Text className="text-xs font-semibold text-muted-foreground">
            <Text className="text-foreground">
              {filtered.length} {filtered.length === 1 ? 'place' : 'places'}
            </Text>
            {openNow > 0 ? ` · ${openNow} open now` : ''}
          </Text>

          <View className="flex-row items-center gap-1.5">
            {filtered.length >= SORT_CONTROL_MIN ? (
              <Pressable
                onPress={() =>
                  setSort((s) => (s === 'suggested' ? 'open' : 'suggested'))
                }
                accessibilityLabel="Change sort order"
                className="flex-row items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1"
              >
                <ArrowUpDown color="#775254" size={12} />
                <Text className="text-[11px] font-semibold text-muted-foreground">
                  {sort === 'suggested' ? 'Suggested' : 'Open first'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={openFilters}
              accessibilityLabel="Open filters"
              className={
                filtersActive
                  ? 'flex-row items-center gap-1 rounded-full bg-primary px-2.5 py-1'
                  : 'flex-row items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1'
              }
            >
              <SlidersHorizontal
                color={filtersActive ? '#ffffff' : '#775254'}
                size={12}
              />
              <Text
                className={
                  filtersActive
                    ? 'text-[11px] font-semibold text-primary-foreground'
                    : 'text-[11px] font-semibold text-muted-foreground'
                }
              >
                Filters
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {filterEmptied ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="Nothing matches those filters"
          description="Your filters excluded every place in the catalog. Loosen them to see more."
          action={{ label: 'Clear filters', onPress: resetDiscoveryFilters }}
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6">
          <View className="gap-2.5">
            {pairs(ordered).map((row) => (
              <View key={row[0].id} className="flex-row gap-2.5">
                {row.map((place) => {
                  const saved = savedIds.has(place.id);
                  return (
                    <FavoriteTile
                      key={place.id}
                      place={place}
                      saved={saved}
                      onToggle={() => toggleSave(place, saved)}
                    />
                  );
                })}
                {row.length === 1 ? <View className="flex-1" /> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
