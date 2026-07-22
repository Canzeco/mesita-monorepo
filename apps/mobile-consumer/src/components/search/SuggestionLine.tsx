import { BadgeCheck } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { AddState } from '@/components/memo/types';
import { COLORS } from '@/constants/brand';
import type { PlacePrediction } from '@/lib/api/place-search';

/** Plain one-line suggestion — mirrors web SearchResultsPanel SuggestionLine. */
export function SuggestionLine({
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
  const added = addState === 'added';
  const label = [
    prediction.mainText,
    prediction.secondaryText,
    source === 'mesita' ? 'On Mesita' : 'From Google',
    verified ? 'Verified partner' : null,
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
        className={`h-2 w-2 shrink-0 rounded-full ${
          source === 'mesita' ? 'bg-pink-500' : 'bg-blue-500'
        }`}
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
      {verified ? (
        <BadgeCheck
          color={COLORS.primary}
          size={14}
          accessibilityLabel="Verified Partner"
        />
      ) : null}
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
