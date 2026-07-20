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
  filtersActive?: boolean;
  onChangeQuery: (value: string) => void;
  onFocus: () => void;
  onClear: () => void;
  onOpenFilters: () => void;
};

export function SearchBar({
  query,
  top,
  filtersActive = false,
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
          <Pressable onPress={onClear} hitSlop={8}>
            <X color="#775254" size={18} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onOpenFilters}
            hitSlop={8}
            accessibilityLabel={
              filtersActive ? 'Filters (active)' : 'Filters'
            }
          >
            <View className="relative">
              <SlidersHorizontal color="#775254" size={18} />
              {filtersActive ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500"
                  style={{ borderWidth: 2, borderColor: '#fff' }}
                />
              ) : null}
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}
