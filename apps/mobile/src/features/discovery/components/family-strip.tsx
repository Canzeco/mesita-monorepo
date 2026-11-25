import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, pressedOpacity, radius } from "@/theme";

import { isSpecial, type Chip, type ChipKey } from "../families";
import { FamilyChip } from "./family-chip";

type Props = { chips: readonly Chip[]; chosen: ChipKey; onSelect: (key: ChipKey) => void; onMenu: () => void };

/** Menu pinned at the left, the chips sliding beside it. */
export function FamilyStrip({ chips, chosen, onSelect, onMenu }: Props) {
  const filtered = !isSpecial(chosen);
  return (
    <View style={styles.strip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filtered ? "All families, a family is chosen" : "All families"}
        onPress={onMenu}
        testID="menu"
        style={({ pressed }) => [styles.menu, pressed && { opacity: pressedOpacity }]}
      >
        <View style={[styles.square, filtered && styles.filtered]}>
          <Icon name="layout-grid" size={16} color={filtered ? colors.onInk : colors.ink} />
        </View>
        <Text role="meta" tone="muted">
          Menu
        </Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips.map((chip) => (
          <FamilyChip key={chip.key} chip={chip} on={chip.key === chosen} onPress={() => onSelect(chip.key)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  menu: { width: 56, alignItems: "center", gap: 2, marginLeft: 8, marginRight: 2 },
  square: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  filtered: { borderColor: colors.danger, backgroundColor: colors.danger },
  row: { gap: 2, paddingHorizontal: 4 },
});
