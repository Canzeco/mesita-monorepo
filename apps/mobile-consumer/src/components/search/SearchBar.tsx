import { Search as SearchIcon, X } from 'lucide-react-native';
import type { RefObject } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SHADOW_ELEV } from '@/constants/brand';

type SearchBarProps = {
  query: string;
  top: number;
  countryCode: string | null;
  locationSet: boolean;
  onChangeQuery: (value: string) => void;
  onFocus: () => void;
  onClear: () => void;
  onOpenScope: () => void;
  inputRef?: RefObject<TextInput | null>;
};

export function SearchBar({
  query,
  top,
  countryCode,
  locationSet,
  onChangeQuery,
  onFocus,
  onClear,
  onOpenScope,
  inputRef,
}: SearchBarProps) {
  const scopeLabel = [
    countryCode ?? 'any country',
    locationSet ? 'location set' : 'location not set',
  ].join(', ');

  return (
    <View className="absolute inset-x-0 z-30 px-3" style={{ top }}>
      <View
        className="h-12 flex-row items-center rounded-full border border-border bg-card/95 pl-4"
        style={SHADOW_ELEV}
      >
        <SearchIcon color="#775254" size={16} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onChangeQuery}
          onFocus={onFocus}
          placeholder="Search places…"
          placeholderTextColor="#77525466"
          className="min-w-0 flex-1 px-3 text-sm text-foreground"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            className="h-11 w-11 items-center justify-center"
          >
            <X color="#775254" size={16} />
          </Pressable>
        ) : null}
        <View className="h-5 w-px bg-border" />
        <Pressable
          onPress={onOpenScope}
          accessibilityRole="button"
          accessibilityLabel={scopeLabel}
          className="mr-1 h-10 flex-row items-center gap-1.5 rounded-full px-2.5"
        >
          <Text className="min-w-[20px] text-center text-[11px] font-semibold tracking-wide text-foreground">
            {countryCode ?? '—'}
          </Text>
          <View
            className={
              locationSet
                ? 'h-2.5 w-2.5 rounded-full border border-primary bg-primary'
                : 'h-2.5 w-2.5 rounded-full border border-muted-foreground/50 bg-transparent'
            }
          />
        </Pressable>
      </View>
    </View>
  );
}
