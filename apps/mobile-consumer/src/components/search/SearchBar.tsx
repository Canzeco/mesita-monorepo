import {
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';

import { COLORS, SHADOW_ELEV } from '@/constants/brand';

type SearchBarProps = {
  query: string;
  top: number;
  showClear: boolean;
  filtersActive?: boolean;
  onChangeQuery: (value: string) => void;
  onFocus: () => void;
  onClear: () => void;
  onOpenFilters: () => void;
};

export function SearchBar({
  query,
  top,
  showClear,
  filtersActive = false,
  onChangeQuery,
  onFocus,
  onClear,
  onOpenFilters,
}: SearchBarProps) {
  return (
    <View className="absolute inset-x-0 z-30 px-3" style={{ top }}>
      <View
        className="h-12 flex-row items-center gap-1 rounded-full border border-border bg-card pl-4 pr-1.5"
        style={SHADOW_ELEV}
        accessibilityRole="search"
      >
        <SearchIcon color={COLORS.mutedForeground} size={16} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          onFocus={onFocus}
          placeholder="Search places…"
          placeholderTextColor={`${COLORS.mutedForeground}99`}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search places"
        />
        {showClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            className="h-9 w-9 items-center justify-center"
          >
            <X color={COLORS.mutedForeground} size={16} />
          </Pressable>
        ) : null}
        <View className="h-6 w-px shrink-0 bg-border" accessibilityElementsHidden />
        <Pressable
          onPress={onOpenFilters}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            filtersActive ? 'Filters (active)' : 'Filters'
          }
          className="relative h-9 w-9 items-center justify-center rounded-full"
        >
          <SlidersHorizontal color={COLORS.foreground} size={16} />
          {filtersActive ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"
              style={{ borderWidth: 2, borderColor: COLORS.card }}
            />
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
