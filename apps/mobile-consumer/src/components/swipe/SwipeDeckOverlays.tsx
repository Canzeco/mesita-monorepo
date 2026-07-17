import { LinearGradient } from 'expo-linear-gradient';
import { Hand, Heart, X } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GRADIENTS, GRADIENT_DIAGONAL, SHADOW_GLOW } from '@/constants/brand';

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
              borderColor: '#fff',
              paddingHorizontal: 20,
              paddingVertical: 10,
              transform: [{ rotate: '-8deg' }],
            },
            SHADOW_GLOW,
          ]}
        >
          <Heart color="#fff" fill="#fff" size={24} />
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
        className="flex-row items-center gap-2 rounded-2xl border-[3px] border-foreground/70 bg-foreground/85 px-5 py-2.5"
        style={{ transform: [{ rotate: '8deg' }] }}
      >
        <X color="#fff7f8" size={24} strokeWidth={3} />
        <Text className="text-2xl font-black tracking-[0.15em] text-background uppercase">
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
        <Hand color="#fff" size={80} strokeWidth={1.4} />
        <Text className="text-center text-[13px] font-medium tracking-wide text-white/95">
          Swipe left to skip · right to save
        </Text>
      </View>
    </View>
  );
}
