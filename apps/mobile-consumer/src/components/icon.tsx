import { Image } from "expo-image";

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

const PREMIER = require("../../assets/icons/premier.svg");

/** The red Premier seal after a place's name. */
export function PremierSeal({ size = 20 }: { size?: number }) {
  return <Image source={PREMIER} accessibilityLabel="Mesita Premier" contentFit="contain" style={{ width: size, height: size }} />;
}
