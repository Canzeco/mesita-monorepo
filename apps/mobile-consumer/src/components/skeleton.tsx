import { View, type ViewStyle } from "react-native";

import { colors, radius } from "@/theme";

export function Skeleton({ style }: { style?: ViewStyle }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: colors.fill, borderRadius: radius.lg }, style]}
    />
  );
}
