import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, radius, space } from "@/theme";

type Props = { title?: string; label: string; onClose: () => void; children: ReactNode };

/** The web's floating window: a card 20 pt in from the edges over the dimmed
 *  screen. Its route is a transparent modal. */
export function Window({ title, label, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}>
      <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.card} accessibilityViewIsModal accessibilityLabel={label}>
        {title ? (
          <View style={styles.header}>
            <Text role="strong" style={styles.title}>
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <Icon strokeWidth={2.25} name="x" size={24} />
            </Pressable>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", paddingHorizontal: 20, backgroundColor: colors.dim },
  card: { maxHeight: "100%", overflow: "hidden", borderRadius: radius["2xl"], backgroundColor: colors.paper },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 6,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: { flex: 1 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
