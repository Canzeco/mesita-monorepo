import { ChevronUp, MapPin, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { RailCard } from '@/components/search/SearchRailCard';
import { SHADOW_ELEV } from '@/constants/brand';
import type { Place } from '@/lib/api/places';

// 80% active card + 10% neighbor peek each side. First/last pages pad so
// the active card still centres. No gap — the peek *is* the next card.
const CARD_RATIO = 0.8;

export function IdleCatalogRail({
  idle,
  collapsed,
  loading,
  fetchError,
  places,
  selectedId,
  catalogCount,
  bottomInset,
  onCollapse,
  onExpand,
  onClearFilters,
  onSelectPlace,
  onOpenPlace,
}: {
  idle: boolean;
  collapsed: boolean;
  loading: boolean;
  fetchError: string | null;
  places: Place[];
  selectedId: string | null;
  /** Rows before filtering — powers the "no matches, clear filters" escape. */
  catalogCount: number;
  bottomInset: number;
  onCollapse: () => void;
  onExpand: () => void;
  onClearFilters: () => void;
  onSelectPlace: (id: string) => void;
  onOpenPlace: (id: string) => void;
}) {
  const listRef = useRef<FlatList<Place>>(null);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.round(screenWidth * CARD_RATIO);
  const peek = Math.max(0, Math.round((screenWidth - cardWidth) / 2));
  // 0-based position of the card nearest the rail's scroll start → the
  // "N / M places" pager (web SearchRailOverlay parity).
  const [railIndex, setRailIndex] = useState(0);

  // Pin tap → highlight + scroll the matching rail card into the centre. An
  // effect (not the pin handler) because a search pick mounts the rail on the
  // SAME commit that sets the selection — the list only exists after that
  // render; it also re-centres when a dismissed rail reopens. Mirrors the web
  // scrollIntoView effect.
  useEffect(() => {
    if (!idle || collapsed || !selectedId) return;
    const index = places.findIndex((p) => p.id === selectedId);
    if (index < 0) return;
    const handle = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index,
        viewPosition: 0.5,
        animated: true,
      });
    });
    return () => cancelAnimationFrame(handle);
  }, [idle, collapsed, selectedId, places]);

  if (!idle) return null;

  const bottom = Math.max(bottomInset, 8);

  if (loading) {
    return (
      <View className="absolute inset-x-0 z-20" style={{ bottom: bottom + 4 }}>
        <View className="h-28 items-center justify-center">
          <ActivityIndicator color="#fb2b7b" />
        </View>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View className="absolute inset-x-0 z-20" style={{ bottom: bottom + 4 }}>
        <View className="mx-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
          <Text className="text-xs text-rose-700">{fetchError}</Text>
        </View>
      </View>
    );
  }

  // Nothing survives the filters → the reset escape (only when there ARE rows
  // to reset toward); a genuinely empty catalog shows nothing.
  if (places.length === 0) {
    if (catalogCount === 0) return null;
    return (
      <View
        className="absolute inset-x-0 z-20 items-center"
        style={{ bottom: bottom + 4 }}
      >
        <View
          className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
          style={SHADOW_ELEV}
        >
          <Text className="text-xs text-muted-foreground">
            No places match these filters.
          </Text>
          <Pressable
            onPress={onClearFilters}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            hitSlop={8}
          >
            <Text className="text-xs font-semibold text-primary">
              Clear filters
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Dismissed → a single pill reopens the rail (tapping any pin reopens it too).
  if (collapsed) {
    return (
      <View
        className="absolute inset-x-0 z-20 items-center"
        style={{ bottom: bottom + 8 }}
      >
        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityLabel={`Show ${places.length} ${places.length === 1 ? 'place' : 'places'}`}
          className="min-h-[44px] flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2"
          style={SHADOW_ELEV}
        >
          <ChevronUp color="#fb2b7b" size={16} />
          <Text
            className="text-xs font-semibold text-foreground"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            Show {places.length} {places.length === 1 ? 'place' : 'places'}
          </Text>
        </Pressable>
      </View>
    );
  }

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (places.length === 0 || cardWidth <= 0) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    // At the far-right end the last card is fully visible but the offset never
    // reaches (n-1)·stride, so Math.round caps one short — snap to the last
    // index once the list is scrolled to its end (web parity).
    const overflowing = contentSize.width > layoutMeasurement.width;
    const atEnd =
      overflowing &&
      contentOffset.x + layoutMeasurement.width >= contentSize.width - 4;
    const idx = atEnd
      ? places.length - 1
      : Math.round(contentOffset.x / cardWidth);
    setRailIndex(Math.max(0, Math.min(idx, places.length - 1)));
  };

  return (
    <View className="absolute inset-x-0 z-20" style={{ bottom: bottom + 4 }}>
      {/* "N / M places" pager pill — reads as browsable, with an X to dismiss. */}
      <View className="mb-2 items-center">
        <View
          className="flex-row items-center gap-1 rounded-full border border-border bg-card py-1 pl-2.5 pr-1"
          style={SHADOW_ELEV}
        >
          <MapPin color="#fb2b7b" size={12} />
          <Text
            className="text-[11px] font-semibold text-muted-foreground"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {places.length > 1
              ? `${Math.min(railIndex + 1, places.length)} / ${places.length}`
              : `${places.length}`}
          </Text>
          <Text className="text-[11px] text-muted-foreground/70">
            {places.length === 1 ? 'place' : 'places'}
          </Text>
          <View className="ml-0.5 h-3.5 w-px bg-border" />
          <Pressable
            onPress={onCollapse}
            accessibilityRole="button"
            accessibilityLabel="Hide places"
            hitSlop={8}
            className="h-5 w-5 items-center justify-center rounded-full"
          >
            <X color="#775254" size={14} />
          </Pressable>
        </View>
      </View>
      <FlatList
        ref={listRef}
        horizontal
        data={places}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: peek }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: cardWidth,
          offset: peek + index * cardWidth,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.index * cardWidth,
            animated: true,
          });
        }}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
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
          </View>
        )}
      />
    </View>
  );
}

export function EmptySearchPrompt() {
  return (
    <View className="items-center px-6 py-10">
      <Text className="font-display text-xl font-semibold text-foreground">
        Where to today?
      </Text>
      <Text className="mt-1 text-center text-sm text-muted-foreground">
        Search Mesita partners and Google places.
      </Text>
    </View>
  );
}
