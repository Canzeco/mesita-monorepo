import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { colors, pressedStyle, radius } from "@/theme";

type Props = {
  /** The chosen place's name; null while the device's storage answers (the web's loading frame). */
  location: string | null;
  /** No location at all: the web's red box, MapPinOff, "No location". */
  missing?: boolean;
  onPress: () => void;
};

/** The white band: the word Mesita, and where Home looks from. */
export function HomeHeader({ location, missing = false, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const tint = missing ? colors.danger : colors.ink;
  return (
    <View style={[styles.band, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Text role="wordmark" accessibilityRole="header">
          Mesita
        </Text>
        {location === null && !missing ? (
          <Skeleton style={styles.waiting} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={missing ? "No location. Choose location" : `Location: ${location}. Change location`}
            onPress={onPress}
            testID="location"
            style={({ pressed }) => [styles.location, missing && styles.missing, pressed && pressedStyle]}
          >
            <Icon strokeWidth={2.25} name={missing ? "map-pin-off" : "map-pin"} size={18} color={tint} />
            <Text role="strong" numberOfLines={1} style={[styles.name, { color: tint }]}>
              {missing ? "No location" : location}
            </Text>
            <Icon strokeWidth={2.25} name="chevron-down" size={16} color={missing ? colors.danger : colors.muted} />
          </Pressable>
        )}
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
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.xl,
    backgroundColor: colors.fill,
  },
  missing: { backgroundColor: colors.dangerSoft },
  // The web's loading frame: h-8 w-36 rounded-full where the box goes.
  waiting: { width: 144, height: 32, marginLeft: "auto", borderRadius: radius.full },
  name: { flexShrink: 1 },
});
