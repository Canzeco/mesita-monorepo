import { BadgeCheck, SearchX } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import type { AddState } from '@/components/memo/types';
import type { PlacePrediction } from '@/lib/api/places';

export function SearchResultsPanel({
  query,
  searching,
  searchError,
  predictions,
  addStates,
  onPickMesita,
  onPickGoogle,
}: {
  query: string;
  searching: boolean;
  searchError: string | null;
  predictions: PlacePrediction[];
  addStates: Record<string, AddState>;
  onPickMesita: (prediction: PlacePrediction) => void;
  onPickGoogle: (prediction: PlacePrediction) => void;
}) {
  const onMesita = predictions.filter((p) => p.status !== 'not_in_mesita');
  const fromGoogle = predictions.filter((p) => p.status === 'not_in_mesita');
  const settled = !searching && query.trim().length >= 2;

  return (
    <ScrollView
      className="max-h-full"
      contentContainerClassName="p-3 gap-3"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {query.trim().length < 2 ? (
        <Text className="px-1 py-6 text-center text-xs text-muted-foreground">
          Keep typing — at least two letters to search.
        </Text>
      ) : null}

      {searching && predictions.length === 0 ? (
        <View className="flex-row items-center justify-center gap-2 py-8">
          <ActivityIndicator color="#fb2b7b" size="small" />
          <Text className="text-xs text-muted-foreground">
            Searching Mesita and Google…
          </Text>
        </View>
      ) : null}

      {searchError ? (
        <View className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
          <Text className="text-xs text-rose-700">{searchError}</Text>
        </View>
      ) : null}

      {settled && !searchError && predictions.length === 0 ? (
        <View className="items-center py-8">
          <View className="size-12 items-center justify-center rounded-2xl bg-muted">
            <SearchX color="#775254" size={20} />
          </View>
          <Text className="mt-3 text-sm font-semibold text-foreground">
            No matches found
          </Text>
          <Text className="mt-1 text-center text-xs text-muted-foreground">
            Try the place’s full name, or ask the AI concierge.
          </Text>
        </View>
      ) : null}

      {onMesita.length > 0 ? (
        <View>
          <Text className="px-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            On Mesita
          </Text>
          <View className="mt-1">
            {onMesita.map((p) => (
              <SuggestionLine
                key={p.placeId}
                prediction={p}
                source="mesita"
                addState={addStates[p.placeId]}
                onPick={onPickMesita}
              />
            ))}
          </View>
        </View>
      ) : null}

      {fromGoogle.length > 0 ? (
        <View>
          <Text className="px-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            From Google
          </Text>
          {onMesita.length === 0 && settled ? (
            <Text className="px-1 pt-1 text-[11px] text-muted-foreground">
              Not on Mesita yet? Tap a place and we’ll build its profile for
              everyone.
            </Text>
          ) : null}
          <View className="mt-1">
            {fromGoogle.map((p) => (
              <SuggestionLine
                key={p.placeId}
                prediction={p}
                source="google"
                addState={addStates[p.placeId]}
                onPick={onPickGoogle}
              />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function SuggestionLine({
  prediction,
  source,
  addState,
  onPick,
}: {
  prediction: PlacePrediction;
  source: 'mesita' | 'google';
  addState?: AddState;
  onPick: (prediction: PlacePrediction) => void;
}) {
  const verified =
    prediction.status === 'verified_partner_other' ||
    prediction.status === 'verified_partner_self';

  return (
    <Pressable
      onPress={() => onPick(prediction)}
      className="flex-row items-center gap-2.5 border-b border-border/60 py-3 active:opacity-70"
    >
      <View
        className={`size-2 rounded-full ${
          source === 'mesita' ? 'bg-primary' : 'bg-sky-500'
        }`}
      />
      <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
        <Text
          className="shrink font-semibold text-foreground"
          numberOfLines={1}
        >
          {prediction.mainText}
        </Text>
        {prediction.secondaryText ? (
          <Text className="min-w-0 flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {prediction.secondaryText}
          </Text>
        ) : null}
      </View>
      {verified ? <BadgeCheck color="#fb2b7b" size={16} /> : null}
      {addState === 'added' ? (
        <View className="rounded-full bg-primary/10 px-2 py-0.5">
          <Text className="text-[10px] font-bold text-primary">Enriching</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
