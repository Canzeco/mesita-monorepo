import { BadgeCheck } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import type { AddState } from '@/components/memo/types';
import type { PlacePrediction } from '@/lib/api/place-search';

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
