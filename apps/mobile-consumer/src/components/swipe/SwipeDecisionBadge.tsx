import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { COLORS, GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';

export function SwipeDecisionBadge({
  side,
  translateX,
}: {
  side: 'left' | 'right';
  translateX: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const input = side === 'left' ? [-80, -30, 0] : [0, 30, 80];
    return {
      opacity: interpolate(
        translateX.value,
        input,
        side === 'left' ? [1, 1, 0] : [0, 1, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            translateX.value,
            input,
            side === 'left' ? [1, 1, 0.9] : [0.9, 1, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  // THE TWO STAMPS MUST NOT BOTH BE DARK CHIPS (MESITA-1954). Skip used to be a
  // translucent ink scrim and Save a pink gradient; with the gradient achromatic
  // both would land as white-on-dark pills in mirrored corners, read mid-gesture
  // at 30-80px of travel when nobody is reading a four-letter word. So they take
  // OPPOSITE POLARITY, the same split the action row already uses: Save = solid
  // ink fill / white label (ActionBtn variant="save"), Skip = white card + ink
  // outline / ink label (variant="skip"). Opaque, so either stays legible on any
  // photo — the 0.4 scrim only worked because it was the only dark stamp.
  if (side === 'left') {
    return (
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 30,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: COLORS.foreground,
            backgroundColor: COLORS.card,
            paddingHorizontal: 12,
            paddingVertical: 4,
          },
          animatedStyle,
        ]}
        pointerEvents="none"
      >
        <Text className="text-[11px] font-bold tracking-wider text-foreground uppercase">
          Skip
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[{ position: 'absolute', top: 16, right: 16, zIndex: 30 }, animatedStyle]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{
          borderRadius: 6,
          paddingHorizontal: 12,
          paddingVertical: 4,
        }}
      >
        <Text className="text-[11px] font-bold tracking-wider text-white uppercase">
          Save
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}
