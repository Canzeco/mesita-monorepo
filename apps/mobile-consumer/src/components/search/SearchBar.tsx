import {
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';

import { SHADOW_ELEV } from '@/constants/brand';

type SearchBarProps = {
  query: string;
  top: number;
  /** Any deviation from the filter-sheet defaults lights the red dot. */
  filtersActive: boolean;
  onChangeQuery: (value: string) => void;
  onFocus: () => void;
  onClear: () => void;
  onOpenFilters: () => void;
};

export function SearchBar({
  query,
  top,
  filtersActive,
  onChangeQuery,
  onFocus,
  onClear,
  onOpenFilters,
}: SearchBarProps) {
  return (
    <View className="absolute inset-x-0 z-30 px-3" style={{ top }}>
      <View
        className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5"
        style={SHADOW_ELEV}
      >
        <SearchIcon color="#775254" size={18} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          onFocus={onFocus}
          placeholder="Search places"
          placeholderTextColor="#77525466"
          className="min-w-0 flex-1 text-[15px] text-foreground"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X color="#775254" size={18} />
          </Pressable>
        ) : null}
        {/* Hairline divider then the tune icon — the filter lives inside the
            bar (web reference layout); the dot marks any active filter. */}
        <View className="h-6 w-px bg-border" />
        <Pressable
          onPress={onOpenFilters}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={filtersActive ? 'Filters (active)' : 'Filters'}
          className="relative h-9 w-9 items-center justify-center rounded-full"
        >
          <SlidersHorizontal color="#775254" size={18} />
          {filtersActive ? (
            <View
              className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-card bg-red-500"
              accessibilityElementsHidden
            />
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
