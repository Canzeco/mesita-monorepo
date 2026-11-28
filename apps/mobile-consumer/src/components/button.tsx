import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { colors, disabledOpacity, pressedStyle, radius } from "@/theme";

type Props = {
  label: string;
  icon?: IconName;
  onPress: () => void;
  kind?: "primary" | "secondary" | "quiet" | "danger";
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function Button({ label, icon, onPress, kind = "primary", busy = false, disabled = false, testID }: Props) {
  const off = busy || disabled;
  const ink = kind === "primary" || kind === "danger" ? "onInk" : "ink";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      testID={testID}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [styles.box, styles[kind], pressed && pressedStyle, disabled && { opacity: disabledOpacity }]}
    >
      {busy ? (
        <Spinner onInk={ink === "onInk"} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={16} strokeWidth={2.25} color={colors[ink]} /> : null}
          <Text role="label" tone={ink}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 48,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: radius.lg,
  },
  primary: { backgroundColor: colors.ink },
  secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  quiet: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
});
