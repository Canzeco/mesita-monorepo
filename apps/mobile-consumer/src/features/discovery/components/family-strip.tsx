import { useEffect, useRef, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, View, type LayoutRectangle } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, radius } from "@/theme";

import { isSpecial, type Chip, type ChipKey } from "../families";
import { FamilyChip } from "./family-chip";

type Props = {
  chips: readonly Chip[];
  chosen: ChipKey;
  onSelect: (key: ChipKey) => void;
  onMenu: () => void;
  /** The Categories window is up: Menu turns ink with an X (the web's open state). */
  menuOpen?: boolean;
};

/** Menu pinned at the left, the chips sliding beside it. The chosen chip
 *  scrolls into view with an 8 pt margin, as the web's does. */
export function FamilyStrip({ chips, chosen, onSelect, onMenu, menuOpen = false }: Props) {
  const filtered = !isSpecial(chosen);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const boxes = useRef(new Map<ChipKey, LayoutRectangle>());
  const view = useRef({ x: 0, width: 0 });
  const reveal = (key: ChipKey) => {
    const box = boxes.current.get(key);
    if (!box || view.current.width === 0) return;
    const { x, width } = view.current;
    if (box.x - 8 < x) scroller.current?.scrollTo({ x: Math.max(0, box.x - 8), animated: true });
    else if (box.x + box.width + 8 > x + width) scroller.current?.scrollTo({ x: box.x + box.width + 8 - width, animated: true });
  };
  // On a change, and once the chosen chip first reports where it is.
  useEffect(() => reveal(chosen), [chosen]);
  return (
    <View style={styles.strip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filtered ? "All families, a family is chosen" : "All families"}
        onPress={onMenu}
        testID="menu"
        style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
      >
        <View style={[styles.square, filtered && styles.filtered, menuOpen && styles.open]}>
          {menuOpen ? (
            <Icon strokeWidth={2.5} name="x" size={16} color={colors.onInk} />
          ) : (
            <Icon strokeWidth={2.25} name="layout-grid" size={16} color={filtered ? colors.onInk : colors.ink} />
          )}
        </View>
        <Text role="meta" tone="muted">
          Menu
        </Text>
      </Pressable>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onLayout={(e) => (view.current.width = e.nativeEvent.layout.width)}
        onScroll={(e) => (view.current.x = e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={64}
      >
        {chips.map((chip) => (
          <View
            key={chip.key}
            onLayout={(e) => {
              const first = !boxes.current.has(chip.key);
              boxes.current.set(chip.key, e.nativeEvent.layout);
              if (first && chip.key === chosen) reveal(chip.key);
            }}
          >
            <FamilyChip chip={chip} on={chip.key === chosen} onPress={() => onSelect(chip.key)} />
          </View>
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
  menu: { minWidth: 56, alignItems: "center", gap: 2, paddingBottom: 4, marginLeft: 8, marginRight: 2 },
  pressed: { transform: [{ scale: 0.96 }] },
  square: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  filtered: { borderColor: colors.danger, backgroundColor: colors.danger },
  open: { borderColor: colors.ink, backgroundColor: colors.ink },
  row: { gap: 2, paddingHorizontal: 4 },
});
