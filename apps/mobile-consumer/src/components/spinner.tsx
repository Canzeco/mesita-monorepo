import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

import { colors, radius, spinner } from "@/theme";

/** The web's Spinner: a ring with a muted track and an ink head, one turn a
 *  second. On an ink fill it is white on white at 40%. */
export function Spinner({
  size = "sm",
  onInk = false,
  label = "Loading",
}: {
  size?: "sm" | "md" | "lg";
  onInk?: boolean;
  label?: string;
}) {
  const [turn] = useState(() => new Animated.Value(0));
  const [rotate] = useState(() => turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: spinner.turnMs, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const { side, ring } = spinner[size];
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{
        width: side,
        height: side,
        borderRadius: radius.full,
        borderWidth: ring,
        borderColor: onInk ? colors.onInkTrack : colors.fill,
        borderTopColor: onInk ? colors.onInk : colors.ink,
        transform: [{ rotate }],
      }}
    />
  );
}
