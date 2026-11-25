import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/text";
import { colors, pressedOpacity, radius, space } from "@/theme";

type Props = {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "quiet" | "danger";
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function Button({ label, onPress, kind = "primary", busy = false, disabled = false, testID }: Props) {
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
      style={({ pressed }) => [styles.box, styles[kind], (pressed || disabled) && { opacity: pressedOpacity }]}
    >
      {busy ? (
        <ActivityIndicator color={colors[ink]} />
      ) : (
        <Text role="label" tone={ink}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
  },
  primary: { backgroundColor: colors.ink },
  secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  quiet: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
});
