import type { NativeStackHeaderProps } from "expo-router";
import { useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, pressedStyle, radius, space, text, tracking, weight } from "@/theme";

// THE WEB'S PAGE HEADER, DRAWN (Pato, 2026-11-28, MESITA-5102: "Use Mesita
// own components for both bottom menu and headers"). Copied from
// apps/web-consumer/src/components/consumer/nav/Screen.tsx (ScreenHeader):
// white, a hairline under it, a 44pt bordered square with ChevronLeft, the
// title centred in text-xl semibold tight, the right slot in the same square.
// Every stack draws it through `headerOptions.header`, so a screen only
// names its title; no screen imports this file to get a header.

/** The square every header button wears (the web's HEADER_BUTTON_CLASS). */
export function HeaderButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.square, pressed && pressedStyle, disabled && styles.off]}
    >
      <Icon name={icon} size={20} strokeWidth={2.25} />
    </Pressable>
  );
}

/** One header: back (or a spacer), the title, the right slot. */
export function Header({
  title,
  onBack,
  right,
  bare = false,
}: {
  title: string;
  /** Null: no back, a spacer keeps the title centred. */
  onBack: (() => void) | null;
  right?: ReactNode;
  /** No hairline: the page's own top menu closes it. */
  bare?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }, !bare && styles.rule]}>
      <View style={styles.side}>
        {onBack ? <HeaderButton icon="chevron-left" label="Back" onPress={onBack} /> : <View style={styles.spacer} />}
      </View>
      <Text role="heading" numberOfLines={1} style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.side, styles.end]}>{right}</View>
    </View>
  );
}

/** The stack's `header`: reads the screen's title, its headerRight and
 *  headerBackVisible, and pops once per tap. */
function StackHeader({ navigation, options, route, back }: NativeStackHeaderProps) {
  const popping = useRef(false);
  const canBack = options.headerBackVisible !== false && (back !== undefined || navigation.canGoBack());
  const onBack = canBack
    ? () => {
        if (popping.current) return;
        popping.current = true;
        navigation.goBack();
        setTimeout(() => {
          popping.current = false;
        }, 400);
      }
    : null;
  const title = typeof options.title === "string" ? options.title : route.name;
  const right = options.headerRight?.({ tintColor: colors.ink, canGoBack: canBack });
  return <Header title={title} onBack={onBack} right={right} />;
}

/** What every Stack wears: the drawn header, the grey page under it. */
export const headerOptions = {
  contentStyle: { backgroundColor: colors.page },
  statusBarStyle: "dark",
  header: (props: NativeStackHeaderProps) => <StackHeader {...props} />,
} as const;

const styles = StyleSheet.create({
  // grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 bg-card
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    backgroundColor: colors.paper,
  },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.border },
  side: { flex: 1, minWidth: 44, flexDirection: "row" },
  end: { justifyContent: "flex-end", minHeight: 44 },
  spacer: { width: 44, height: 44 },
  off: { opacity: 0.5 },
  // text-xl font-semibold tracking-tight, centred, one line
  title: {
    ...text.xl,
    fontWeight: weight.semibold,
    letterSpacing: text.xl.fontSize * tracking.tight,
    textAlign: "center",
    flexShrink: 1,
  },
  // h-11 w-11 rounded-xl border bg-card
  square: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
});
