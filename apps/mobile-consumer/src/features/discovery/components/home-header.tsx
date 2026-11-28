import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, pressedStyle, radius } from "@/theme";

/** The white band: the word Mesita, and where Home looks from. */
export function HomeHeader({ location, onPress }: { location: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.band, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Text role="wordmark" accessibilityRole="header">
          Mesita
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Location: ${location}. Change location`}
          onPress={onPress}
          testID="location"
          style={({ pressed }) => [styles.location, pressed && pressedStyle]}
        >
          <Icon strokeWidth={2.25} name="map-pin" size={18} />
          <Text role="strong" numberOfLines={1} style={styles.name}>
            {location}
          </Text>
          <Icon strokeWidth={2.25} name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: colors.paper, borderBottomWidth: 1, borderColor: colors.border },
  row: { height: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 8 },
  location: {
    height: 40,
    maxWidth: "65%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
    paddingHorizontal: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.fill,
  },
  name: { flexShrink: 1 },
});
