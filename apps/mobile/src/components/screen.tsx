import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, space } from "@/theme";

type Props = { children: ReactNode; footer?: ReactNode; center?: boolean };

/** A page: equal insets, scrolls, its footer stays above the keyboard. */
export function Screen({ children, footer, center = false }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, center && styles.center]}
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: space.lg + insets.bottom }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { flexGrow: 1, gap: space.lg, padding: space.lg },
  center: { justifyContent: "center" },
  footer: { gap: space.sm, padding: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderColor: colors.border },
});
