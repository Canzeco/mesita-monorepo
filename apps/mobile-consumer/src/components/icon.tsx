import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";

import { colors } from "@/theme";

const SOURCES = {
  "arrow-left": require("../../assets/icons/arrow-left.svg"),
  check: require("../../assets/icons/check.svg"),
  "chevron-down": require("../../assets/icons/chevron-down.svg"),
  clock: require("../../assets/icons/clock.svg"),
  compass: require("../../assets/icons/compass.svg"),
  heart: require("../../assets/icons/heart.svg"),
  "heart-filled": require("../../assets/icons/heart-filled.svg"),
  "layout-grid": require("../../assets/icons/layout-grid.svg"),
  "log-in": require("../../assets/icons/log-in.svg"),
  "map-pin": require("../../assets/icons/map-pin.svg"),
  mark: require("../../assets/icons/mark.svg"),
  navigation: require("../../assets/icons/navigation.svg"),
  "navigation-filled": require("../../assets/icons/navigation-filled.svg"),
  "rotate-cw": require("../../assets/icons/rotate-cw.svg"),
  search: require("../../assets/icons/search.svg"),
  "share-2": require("../../assets/icons/share-2.svg"),
  "shield-alert": require("../../assets/icons/shield-alert.svg"),
  "star-filled": require("../../assets/icons/star-filled.svg"),
  x: require("../../assets/icons/x.svg"),
} as const;

export type IconName = keyof typeof SOURCES;

/** One of the web's icons. Decorative: the control around it is labelled. */
export function Icon({ name, size = 16, color = colors.ink }: { name: IconName; size?: number; color?: string }) {
  return (
    <Image
      source={SOURCES[name]}
      tintColor={color}
      contentFit="contain"
      accessible={false}
      style={{ width: size, height: size }}
    />
  );
}

const SEAL =
  "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34Z";
const CHECK = "M10.54 16.2 6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77Z";

/** The seal after a place's name. Red for Premier, blue for an ad slot. */
export function PremierSeal({ size = 20, color = colors.premier }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Mesita Premier">
      <Path d={SEAL} fill={color} />
      <Path d={CHECK} fill={colors.onInk} />
    </Svg>
  );
}
