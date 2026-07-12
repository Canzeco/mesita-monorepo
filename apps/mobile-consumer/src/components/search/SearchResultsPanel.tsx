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
      style={{ maxHeight: '100%' }}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      accessibilityRole="list"
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
          accessibilityLabel="Searching Mesita and Google"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 32,
          }}
        >
          <ActivityIndicator color="#fb2b7b" size="small" />
          <Text className="text-muted-foreground" style={{ fontSize: 13 }}>
            Searching Mesita and Google…
          </Text>
        </View>
      ) : null}

      {searchError ? (
        <Text
          accessibilityRole="alert"
          className="rounded-2xl bg-destructive/10 px-3 py-3 text-destructive"
          style={{ fontSize: 13 }}
        >
          {searchError}
        </Text>
      ) : null}

      {settled && !searchError && predictions.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: '#faeff0',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SearchX color="#775254" size={20} />
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
            Try the place’s full name, or ask the AI concierge.
          </Text>
        </View>
      ) : null}

      {onMesita.length > 0 ? (
        <View>
          <Text
            className="px-1 font-semibold uppercase text-muted-foreground"
            style={{ fontSize: 11, letterSpacing: 1 }}
          >
            On Mesita
          </Text>
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
      ) : null}

      {fromGoogle.length > 0 ? (
        <View>
          <Text
            className="px-1 font-semibold uppercase text-muted-foreground"
            style={{ fontSize: 11, letterSpacing: 1 }}
          >
            From Google
          </Text>
          {onMesita.length === 0 && settled ? (
            <Text
              className="px-1 pt-1 text-muted-foreground"
              style={{ fontSize: 13 }}
            >
              Not on Mesita yet? Tap a place and we’ll build its profile for
              everyone.
            </Text>
          ) : null}
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
  const label = [
    prediction.mainText,
    prediction.secondaryText,
    source === 'mesita' ? 'On Mesita' : 'From Google',
    verified ? 'Verified partner' : null,
    addState === 'added' ? 'Enriching' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => onPick(prediction)}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[48px] flex-row items-center gap-3 rounded-xl px-1 py-2.5 active:bg-muted"
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginLeft: 8,
          backgroundColor: source === 'mesita' ? '#fb2b7b' : '#0ea5e9',
        }}
      />
      <View className="min-w-0 flex-1">
        <Text
          className="font-semibold text-foreground"
          style={{ fontSize: 15 }}
          numberOfLines={1}
        >
          {prediction.mainText}
        </Text>
        {prediction.secondaryText ? (
          <Text
            className="text-muted-foreground"
            style={{ fontSize: 12 }}
            numberOfLines={1}
          >
            {prediction.secondaryText}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-1.5">
        {verified ? <BadgeCheck color="#fb2b7b" size={16} /> : null}
        {addState === 'added' ? (
          <View className="rounded-full bg-primary/15 px-2 py-1">
            <Text
              className="font-semibold text-primary"
              style={{ fontSize: 11 }}
            >
              Enriching
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
