import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { colors, pressedStyle } from "@/theme";

import type { Chip } from "../families";

type Props = { chip: Chip; on: boolean; onPress: () => void; wide?: boolean };

/** A family's picture in a 44 pt circle, black when chosen, its name under. */
export function FamilyChip({ chip, on, onPress, wide = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={chip.label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [wide ? styles.wide : styles.chip, pressed && pressedStyle]}
    >
      <View style={[styles.circle, on && styles.on]}>
        <Image source={chip.picture} style={styles.picture} contentFit="contain" accessible={false} />
      </View>
      <Text role="meta" tone={on ? "ink" : "muted"} numberOfLines={1} style={styles.name}>
        {chip.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minWidth: 56, alignItems: "center", gap: 2, paddingBottom: 4 },
  wide: { width: "20%", alignItems: "center", gap: 2, paddingBottom: 4 },
  circle: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  on: { borderColor: colors.ink, backgroundColor: colors.ink },
  picture: { width: 22, height: 22 },
  name: { textAlign: "center" },
});
