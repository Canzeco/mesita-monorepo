import {
  ChevronUp,
  MapPin,
  Search,
  X,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';

import { RailCard } from '@/components/search/SearchRailCard';
import { COLORS, SHADOW_ELEV } from '@/constants/brand';
import type { Place } from '@/lib/api/places';

export function IdleCatalogRail({
  idle,
  collapsed,
  loading,
  fetchError,
  places,
  catalogCount,
  selectedId,
  bottomInset,
  onCollapse,
  onExpand,
  onClearFilters,
  onRetryCatalog,
  onSelectPlace,
  onOpenPlace,
}: {
  idle: boolean;
  collapsed: boolean;
  loading: boolean;
  fetchError: string | null;
  places: Place[];
  catalogCount: number;
  selectedId: string | null;
  bottomInset: number;
  onCollapse: () => void;
  onExpand: () => void;
  onClearFilters: () => void;
  onRetryCatalog: () => void;
  onSelectPlace: (id: string) => void;
  onOpenPlace: (id: string) => void;
}) {
  if (!idle) return null;

  if (collapsed) {
    return (
      <View
        className="absolute inset-x-0 z-20 items-center"
        style={{ bottom: Math.max(bottomInset, 8) + 8 }}
      >
        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityLabel={`Show ${places.length} ${
            places.length === 1 ? 'place' : 'places'
          }`}
          className="flex-row items-center gap-1.5 rounded-full border border-border bg-card/95 px-3.5 py-2"
          style={SHADOW_ELEV}
        >
          <ChevronUp color={COLORS.primary} size={16} />
          <Text className="text-xs font-semibold text-foreground">
            Show {places.length} {places.length === 1 ? 'place' : 'places'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!loading && !fetchError && places.length === 0 && catalogCount > 0) {
    return (
      <View
        className="absolute inset-x-0 z-20 items-center px-4"
        style={{ bottom: Math.max(bottomInset, 8) + 8 }}
      >
        <View
          className="flex-row items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3"
          style={SHADOW_ELEV}
        >
          <Text className="text-xs text-muted-foreground">
            No places match these filters.
          </Text>
          <Pressable
            onPress={onClearFilters}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
          >
            <Text className="text-xs font-semibold text-primary">
              Clear filters
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const selectedIndex = selectedId
    ? places.findIndex((p) => p.id === selectedId)
    : -1;
  const pagerLabel =
    places.length > 1 && selectedIndex >= 0
      ? `${selectedIndex + 1} / ${places.length}`
      : String(places.length);

  return (
    <View
      className="absolute inset-x-0 z-20"
      style={{ bottom: Math.max(bottomInset, 8) + 4 }}
    >
      <View className="mb-2 items-center">
        <View className="flex-row items-center gap-1 rounded-full border border-border bg-card/95 py-1 pl-2.5 pr-1">
          <MapPin color={COLORS.primary} size={12} />
          <Text className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            {loading ? '…' : pagerLabel}
          </Text>
          <Text className="text-[11px] font-normal text-muted-foreground/70">
            {places.length === 1 ? 'place' : 'places'}
          </Text>
          <View className="ml-0.5 h-3.5 w-px bg-border" />
          <Pressable
            onPress={onCollapse}
            accessibilityRole="button"
            accessibilityLabel="Hide places"
            className="h-5 w-5 items-center justify-center rounded-full"
            hitSlop={8}
          >
            <X color={COLORS.mutedForeground} size={14} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View
          className="h-28 items-center justify-center"
          accessibilityRole="progressbar"
          accessibilityLabel="Loading places"
        >
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : fetchError ? (
        <View className="mx-4 gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
          <Text
            accessibilityRole="alert"
            className="text-xs text-rose-700"
          >
            {fetchError}
          </Text>
          <Pressable
            onPress={onRetryCatalog}
            accessibilityRole="button"
            accessibilityLabel="Retry loading places"
          >
            <Text className="text-xs font-semibold text-primary">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          horizontal
          data={places}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          accessibilityRole="list"
          accessibilityLabel="Nearby places"
          renderItem={({ item }) => (
            <RailCard
              place={item}
              selected={item.id === selectedId}
              onSelect={() => onSelectPlace(item.id)}
              onOpen={() => onOpenPlace(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

/** Focused but empty — solid prompt over the top ~70% so the map stays
 *  visible below (web EmptySearchPrompt parity). */
export function EmptySearchPrompt() {
  return (
    <View
      className="absolute inset-x-0 top-0 z-20 items-center justify-center rounded-b-3xl border-b border-border bg-background px-8"
      style={{ height: '70%', ...SHADOW_ELEV }}
      accessibilityRole="text"
      accessibilityLabel="Where to today? Find the perfect place by name or category."
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Search color={COLORS.primary} size={24} strokeWidth={1.75} />
      </View>
      <Text className="mt-4 font-display text-lg font-semibold text-foreground">
        Where to today?
      </Text>
      <Text className="mt-1.5 max-w-[260px] text-center text-sm text-muted-foreground">
        Find the perfect place by name or category.
      </Text>
    </View>
  );
}
