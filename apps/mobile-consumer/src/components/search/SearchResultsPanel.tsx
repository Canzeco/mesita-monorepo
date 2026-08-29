import { SearchX } from 'lucide-react-native';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useEffect } from 'react';

import type { AddState } from '@/components/memo/types';
import { COLORS } from '@/constants/brand';
import type { PlacePrediction } from '@/lib/api/place-search';
import { predictionOnMesita } from '@/lib/search-membership';

import { SuggestionLine } from './SuggestionLine';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type SearchFailureKind = 'timeout' | 'network' | 'server' | null;

export function SearchResultsPanel({
  query,
  searching,
  searchError,
  failureKind,
  predictions,
  addStates,
  onPickMesita,
  onPickGoogle,
  onRetry,
}: {
  query: string;
  searching: boolean;
  searchError: string | null;
  failureKind: SearchFailureKind;
  predictions: PlacePrediction[];
  addStates: Record<string, AddState>;
  onPickMesita: (prediction: PlacePrediction) => void;
  onPickGoogle: (prediction: PlacePrediction) => void;
  onRetry: () => void;
}) {
  const settled = !searching && query.trim().length >= 2;
  const rowCount = predictions.length;

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [rowCount, searching, searchError]);

  // No fixed height — panel grows/shrinks with rows; parent caps at max-h 70%.
  return (
    <ScrollView
      contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 0 }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      accessibilityRole="list"
      accessibilityLabel="Search results"
    >
      {query.trim().length < 2 ? (
        <Text
          className="py-6 text-center text-muted-foreground"
          style={{ fontSize: 13 }}
        >
          Keep typing — at least two letters to search.
        </Text>
      ) : null}

      {searching && predictions.length === 0 ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Searching"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 32,
          }}
        >
          <ActivityIndicator color={COLORS.primary} size="small" />
          <Text className="text-muted-foreground" style={{ fontSize: 13 }}>
            Searching…
          </Text>
        </View>
      ) : null}

      {searchError ? (
        <View
          accessibilityRole="alert"
          className="gap-2 rounded-xl bg-destructive/10 px-3 py-3"
        >
          <Text className="font-semibold text-destructive" style={{ fontSize: 13 }}>
            {failureKind === 'timeout'
              ? 'Search timed out'
              : failureKind === 'network'
                ? 'Network problem'
                : 'Search failed'}
          </Text>
          <Text className="text-destructive" style={{ fontSize: 13 }}>
            {failureKind === 'timeout'
              ? 'Mesita took too long to respond. Check your connection and try again.'
              : failureKind === 'network'
                ? "We couldn't reach Mesita. Check your connection and try again."
                : searchError}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry search"
            className="self-start rounded-lg bg-primary/10 px-3 py-2"
          >
            <Text className="text-sm font-semibold text-primary">Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {settled && !searchError && predictions.length === 0 ? (
        <View
          style={{ alignItems: 'center', paddingVertical: 32 }}
          accessibilityLabel="No matches found"
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: COLORS.muted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SearchX color={COLORS.mutedForeground} size={20} />
          </View>
          <Text
            className="mt-3 font-semibold text-foreground"
            style={{ fontSize: 15 }}
          >
            No matches found
          </Text>
          <Text
            className="mt-1 text-center text-muted-foreground"
            style={{ fontSize: 13 }}
          >
            Try the place’s full name.
          </Text>
        </View>
      ) : null}

      {predictions.length > 0 ? (
        <View>
          {predictions.map((p) => (
            <SuggestionLine
              key={p.mesitaId ?? p.placeId}
              prediction={p}
              addState={addStates[p.placeId]}
              onPick={
                predictionOnMesita(p) ? onPickMesita : onPickGoogle
              }
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
