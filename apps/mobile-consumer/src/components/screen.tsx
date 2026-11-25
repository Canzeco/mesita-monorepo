import type { ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardHeight } from "@/components/use-keyboard-height";
import { colors, space } from "@/theme";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  center?: boolean;
  /** A formSheet: its scroller must be the route's own root, or the sheet
   *  measures it as empty on iPhone. */
  sheet?: boolean;
};

/** A page: equal insets, scrolls, its footer stays above the keyboard. */
export function Screen({ children, footer, center = false, sheet = false }: Props) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const body = (
    <ScrollView
      style={sheet ? null : styles.page}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets={sheet}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, center && styles.center]}
    >
      {children}
    </ScrollView>
  );
  if (sheet) return body;
  // A page with a field reaches the bottom of the screen, so the keyboard
  // covers its own height of it. Measuring the page would miss a modal's top.
  const above = keyboard > 0 ? keyboard + (Platform.OS === "android" ? insets.bottom : 0) : 0;
  return (
    <View style={[styles.page, { paddingBottom: above }]}>
      {body}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: space.lg + (above > 0 ? 0 : insets.bottom) }]}>{footer}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { flexGrow: 1, gap: space.lg, padding: space.lg },
  center: { justifyContent: "center" },
  footer: { gap: space.sm, padding: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderColor: colors.border },
});
