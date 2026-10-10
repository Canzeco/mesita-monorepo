import { LinearGradient } from 'expo-linear-gradient';
import { Hand, Heart, X } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { COLORS, GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';

// THE COMMITTED DECISION, and the two stamps must not both be dark boxes
// (MESITA-1954). Saved was a pink gradient with a white border and a pink glow;
// Skip was an ink scrim with a near-white label. Achromatic, both land as a
// filled dark rectangle and only the rotation sign tells them apart. They take
// OPPOSITE POLARITY instead — the same split SwipeDecisionBadge and the action
// row already use: Saved = solid ink fill / white border / white label,
// Skip = white card / ink outline / ink label. Both opaque, so either reads on
// any photo. SHADOW_GLOW is dropped rather than greyed: an ink glow under an
// ink stamp is a smudge, not a signal, and Skip never had one.
export function SwipeExitStamp({
  direction,
}: {
  direction: 'left' | 'right' | null;
}) {
  if (!direction) return null;

  if (direction === 'right') {
    return (
      <View
        className="absolute inset-0 z-40 items-center justify-center"
        pointerEvents="none"
      >
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderRadius: 16,
              borderWidth: 3,
              borderColor: COLORS.primaryForeground,
              paddingHorizontal: 20,
              paddingVertical: 10,
              transform: [{ rotate: '-8deg' }],
            },
          ]}
        >
          <Heart
            color={COLORS.primaryForeground}
            fill={COLORS.primaryForeground}
            size={24}
          />
          <Text className="text-2xl font-black tracking-[0.15em] text-white uppercase">
            Saved
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      className="absolute inset-0 z-40 items-center justify-center"
      pointerEvents="none"
    >
      <View
        className="flex-row items-center gap-2 rounded-2xl border-[3px] border-foreground bg-card px-5 py-2.5"
        style={{ transform: [{ rotate: '8deg' }] }}
      >
        <X color={COLORS.foreground} size={24} strokeWidth={3} />
        <Text className="text-2xl font-black tracking-[0.15em] text-foreground uppercase">
          Skip
        </Text>
      </View>
    </View>
  );
}

export function SwipeTutorialOverlay() {
  return (
    <View
      className="absolute inset-0 z-50 items-center justify-center bg-black/45"
      pointerEvents="none"
    >
      <View className="items-center gap-5">
        <Hand color={COLORS.primaryForeground} size={80} strokeWidth={1.4} />
        <Text className="text-center text-[13px] font-medium tracking-wide text-white/95">
          Swipe left to skip · right to save
        </Text>
      </View>
    </View>
  );
}
