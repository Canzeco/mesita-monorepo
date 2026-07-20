import {
  ChevronUp,
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
import { SHADOW_ELEV } from '@/constants/brand';
import type { Place } from '@/lib/api/places';

export function IdleCatalogRail({
  idle,
  collapsed,
  loading,
  fetchError,
  places,
  selectedId,
  bottomInset,
  onCollapse,
  onExpand,
  onSelectPlace,
  onOpenPlace,
}: {
  idle: boolean;
  collapsed: boolean;
  loading: boolean;
  fetchError: string | null;
  places: Place[];
  selectedId: string | null;
  bottomInset: number;
  onCollapse: () => void;
  onExpand: () => void;
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
          className="flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2"
          style={SHADOW_ELEV}
        >
          <ChevronUp color="#fb2b7b" size={16} />
          <Text className="text-xs font-semibold text-foreground">
            Show places
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className="absolute inset-x-0 z-20"
      style={{ bottom: Math.max(bottomInset, 8) + 4 }}
    >
      <View className="mb-2 flex-row items-center justify-between px-4">
        <Text className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Nearby
        </Text>
        <Pressable
          onPress={onCollapse}
          className="flex-row items-center gap-1 rounded-full bg-card/90 px-2.5 py-1"
        >
          <X color="#775254" size={14} />
          <Text className="text-[11px] font-medium text-muted-foreground">
            {loading ? '...' : `${places.length}`}
          </Text>
        </Pressable>
      </View>
      {loading ? (
        <View className="h-28 items-center justify-center">
          <ActivityIndicator color="#fb2b7b" />
        </View>
      ) : fetchError ? (
        <View className="mx-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
          <Text className="text-xs text-rose-700">{fetchError}</Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={places}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
          renderItem={({ item }) => (
            <RailCard
              place={item}
              selected={item.id === selectedId}
              onPress={() => {
                if (selectedId === item.id) {
                  onOpenPlace(item.id);
                } else {
                  onSelectPlace(item.id);
                }
              }}
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
        <Search color="#fb2b7b" size={24} strokeWidth={1.75} />
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
