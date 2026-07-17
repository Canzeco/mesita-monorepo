import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';

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
            borderColor: '#fff',
            backgroundColor: 'rgba(38,4,9,0.4)',
            paddingHorizontal: 12,
            paddingVertical: 4,
          },
          animatedStyle,
        ]}
        pointerEvents="none"
      >
        <Text className="text-[11px] font-bold tracking-wider text-white uppercase">
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
