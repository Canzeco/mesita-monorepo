import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, space } from "@/theme";

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    gap: space.lg,
    padding: space.lg,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius["2xl"],
  },
});
