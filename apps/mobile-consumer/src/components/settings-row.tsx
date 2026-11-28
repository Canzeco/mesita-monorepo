import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, pressedStyle, radius, space } from "@/theme";

/** A labelled group, the web Settings panel: a white box and its heading inside. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {title ? <Text role="strong">{title}</Text> : null}
      {children}
    </View>
  );
}

/** One Settings row: icon chip, label, optional line under it, a chevron when it opens something. */
export function SettingsRow({
  icon,
  label,
  sub,
  badge,
  onPress,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  badge?: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={styles.chip}>
        <Icon strokeWidth={2.25} name={icon} size={18} />
      </View>
      <View style={styles.copy}>
        <View style={styles.title}>
          <Text role="label">{label}</Text>
          {badge ? <Text role="meta" tone="muted" style={styles.badge}>{badge}</Text> : null}
        </View>
        {sub ? <Text role="caption" tone="muted" numberOfLines={1}>{sub}</Text> : null}
      </View>
      {onPress ? <Icon strokeWidth={2.25} name="chevron-right" size={16} color={colors.muted} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.row, pressed && pressedStyle]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.paper, borderRadius: radius["2xl"], padding: space.lg, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  chip: { width: 36, height: 36, borderRadius: radius.xl, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 2 },
  title: { flexDirection: "row", alignItems: "center", gap: space.xs },
  badge: { backgroundColor: colors.fill, borderRadius: radius.panel, paddingHorizontal: space.xs },
});
