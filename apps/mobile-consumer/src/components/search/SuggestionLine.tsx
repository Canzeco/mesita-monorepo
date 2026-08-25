import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { AddState } from '@/components/memo/types';
import type { PlacePrediction } from '@/lib/api/place-search';
import {
  membershipColor,
  membershipTone,
} from '@/lib/search-membership';

/** Plain one-line suggestion — mirrors web SearchResultsPanel SuggestionLine. */
export function SuggestionLine({
  prediction,
  addState,
  onPick,
}: {
  prediction: PlacePrediction;
  addState?: AddState;
  onPick: (prediction: PlacePrediction) => void;
}) {
  const tone = membershipTone(prediction);
  const added = addState === 'added';
  const membershipLabel =
    tone === 'partner' ? 'Partner' : tone === 'listed' ? 'Listed' : 'Google only';
  const label = [
    prediction.mainText,
    prediction.secondaryText,
    membershipLabel,
    added ? 'Enriching' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => onPick(prediction)}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[44px] w-full flex-row items-center gap-2 rounded-lg px-1 py-2.5 active:bg-muted/50"
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: membershipColor(tone) }}
      />
      <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>
        <Text className="font-medium text-foreground">
          {prediction.mainText}
        </Text>
        {prediction.secondaryText ? (
          <Text className="text-muted-foreground">
            {' '}
            · {prediction.secondaryText}
          </Text>
        ) : null}
      </Text>
      {added ? (
        <View className="flex-row items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5">
          <ActivityIndicator color="#047857" size="small" />
          <Text className="text-[10px] font-semibold text-emerald-700">
            Enriching
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
