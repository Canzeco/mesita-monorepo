import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { AddState } from '@/components/memo/types';
import { COLORS } from '@/constants/brand';
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
      {/* MESITA-1954 — RESERVED, the dot keeps its hue. Partner (#ffc400) /
          Listed (#ff2357) / Google-only (#9ca3af) is the ONLY on-screen
          carrier of which set a result belongs to (membershipLabel above
          reaches VoiceOver, never the eye), and map-defaults.ts calls the
          paint itself the set law for Google ⊃ Listed ⊃ Partner. Google-only
          is ALREADY grey, so greying the other two would have folded Partner
          and Listed into the exact tone that means "not on Mesita". Web kept
          these three hexes through its own achromatic pass; mobile follows. */}
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
      {/* MESITA-1954: the chip was an emerald fill with emerald type. Greyed
          in place it would have become a plain muted pill — static metadata,
          the same thing a price or distance chip wears — so the live state is
          carried by the spinner plus a DASHED outline, the "not settled yet"
          vocabulary the swipe deck's Enriching chip already uses. No fill:
          nothing here is affirmative or asks to be tapped. */}
      {added ? (
        <View className="flex-row items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5">
          <ActivityIndicator color={COLORS.foreground} size="small" />
          <Text className="text-[10px] font-semibold text-foreground">
            Enriching
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
