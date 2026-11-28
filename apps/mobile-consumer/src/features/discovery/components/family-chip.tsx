import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { colors } from "@/theme";

import type { Chip } from "../families";

/** In the Categories window: a special is 64 wide, a family one of five
 *  columns less its share of the four 2 pt gaps (the web's grid-cols-5 gap-x-0.5). */
type Props = { chip: Chip; on: boolean; onPress: () => void; wide?: "special" | "grid" };

/** A family's picture in a 44 pt circle, black when chosen, its name under. */
export function FamilyChip({ chip, on, onPress, wide }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={chip.label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [
        wide === "special" ? styles.special : wide === "grid" ? styles.grid : styles.chip,
        pressed && styles.pressed,
      ]}
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
  special: { width: 64, alignItems: "center", gap: 2, paddingBottom: 4 },
  grid: { width: "19.4%", alignItems: "center", gap: 2, paddingBottom: 4 },
  /** The web's active:scale-[0.96] on every chip. */
  pressed: { transform: [{ scale: 0.96 }] },
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
  name: { alignSelf: "stretch", textAlign: "center" },
});
