import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import type { PlaceDetail } from "@/generated/shared/place-detail";
import { space } from "@/theme";

/** The stored menus. A row opens that file. A place with none opens the menu page. */
export function MenuTab({ place, onMenu, onOpen }: { place: PlaceDetail; onMenu: () => void; onOpen: (index: number) => void }) {
  if (!place.products.menu.length) {
    return (
      <Pressable accessibilityRole="button" onPress={onMenu} style={styles.empty}>
        <Text role="heading">Smart Menu</Text>
        <Text role="label">Order and pay from your phone.</Text>
        <Text role="body" tone="muted">At your table or for takeaway.</Text>
        <Text role="body" tone="muted">See photos and videos of every dish, and ask AI about ingredients, calories and more.</Text>
        <Text role="body" tone="muted">Coming soon</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.box}>
      {place.products.menu.map((item, index) => (
        <Pressable key={item.url} accessibilityRole="button" onPress={() => onOpen(index)} style={styles.row}>
          <Text role="label">{item.name || "Menu"}</Text>
          {item.updated_label ? <Text role="caption" tone="muted">{item.updated_label}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: space.md }, row: { gap: space.xs }, empty: { gap: space.sm } });
