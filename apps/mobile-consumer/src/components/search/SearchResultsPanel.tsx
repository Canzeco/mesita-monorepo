import { BadgeCheck, SearchX } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Chip,
  List,
  Text,
} from 'react-native-paper';

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
    >
      {query.trim().length < 2 ? (
        <Text
          variant="bodySmall"
          style={{ paddingVertical: 24, textAlign: 'center', color: '#775254' }}
        >
          Keep typing — at least two letters to search.
        </Text>
      ) : null}

      {searching && predictions.length === 0 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 32,
          }}
        >
          <ActivityIndicator color="#fb2b7b" size="small" />
          <Text variant="bodySmall" style={{ color: '#775254' }}>
            Searching Mesita and Google…
          </Text>
        </View>
      ) : null}

      {searchError ? (
        <Text
          variant="bodySmall"
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: '#ffe8e6',
            color: '#e6000c',
          }}
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
          <Text variant="titleSmall" style={{ marginTop: 12 }}>
            No matches found
          </Text>
          <Text
            variant="bodySmall"
            style={{ marginTop: 4, textAlign: 'center', color: '#775254' }}
          >
            Try the place’s full name, or ask the AI concierge.
          </Text>
        </View>
      ) : null}

      {onMesita.length > 0 ? (
        <View>
          <Text
            variant="labelSmall"
            style={{ paddingHorizontal: 4, color: '#775254', letterSpacing: 1 }}
          >
            ON MESITA
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
            variant="labelSmall"
            style={{ paddingHorizontal: 4, color: '#775254', letterSpacing: 1 }}
          >
            FROM GOOGLE
          </Text>
          {onMesita.length === 0 && settled ? (
            <Text
              variant="bodySmall"
              style={{ paddingHorizontal: 4, paddingTop: 4, color: '#775254' }}
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

  return (
    <List.Item
      title={prediction.mainText}
      description={prediction.secondaryText || undefined}
      onPress={() => onPick(prediction)}
      left={() => (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginTop: 18,
            marginLeft: 8,
            backgroundColor: source === 'mesita' ? '#fb2b7b' : '#0ea5e9',
          }}
        />
      )}
      right={() => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'center',
          }}
        >
          {verified ? <BadgeCheck color="#fb2b7b" size={16} /> : null}
          {addState === 'added' ? (
            <Chip compact style={{ backgroundColor: '#ffe4ef' }}>
              Enriching
            </Chip>
          ) : null}
        </View>
      )}
      style={{ paddingLeft: 0 }}
      titleStyle={{ fontWeight: '600' }}
    />
  );
}
