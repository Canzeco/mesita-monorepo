import { useEffect, useState } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius } from "@/theme";

/** The web's animate-pulse: opacity 1 → 0.5 → 1 every 2 s. */
const PULSE_MS = 2000;

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const half = { duration: PULSE_MS / 2, easing: Easing.bezier(0.4, 0, 0.6, 1), useNativeDriver: true };
    const loop = Animated.loop(
      Animated.sequence([Animated.timing(opacity, { ...half, toValue: 0.5 }), Animated.timing(opacity, { ...half, toValue: 1 })]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: colors.fill, borderRadius: radius.lg, opacity }, style]}
    />
  );
}
