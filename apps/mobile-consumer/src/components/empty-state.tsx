import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, leading, radius, space, text, tracking } from "@/theme";

type Props = {
  icon?: IconName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
};

/** An icon on a soft ground, a title, one line and one action. */
export function EmptyState({ icon = "compass", title, message, action, testID = "empty-state" }: Props) {
  return (
    <View style={styles.box} testID={testID}>
      <View style={styles.icon}>
        <Icon strokeWidth={2} name={icon} size={28} />
      </View>
      <Text role="heading" style={styles.title}>
        {title}
      </Text>
      {message ? (
        <Text role="small" tone="muted" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} pill />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl, paddingVertical: 40 },
  icon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius["2xl"],
    backgroundColor: colors.inkSoft,
  },
  // text-lg font-semibold tracking-tight; text-sm leading-relaxed (1.625), max 30ch (30 × Inter's 0 at 14).
  title: { marginTop: space.lg, textAlign: "center", letterSpacing: text.lg.fontSize * tracking.tight },
  message: { marginTop: 6, maxWidth: 265, textAlign: "center", lineHeight: text.sm.fontSize * leading.relaxed },
  action: { marginTop: 20 },
});
