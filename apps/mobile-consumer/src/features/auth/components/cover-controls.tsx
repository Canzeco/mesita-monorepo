import { Pressable, StyleSheet, View } from "react-native";

import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { colors, disabledOpacity, pressedStyle, radius } from "@/theme";

type ButtonProps = { label: string; busy?: boolean; disabled?: boolean; onPress: () => void; testID?: string };

/** The phone's green button. */
export function GreenButton({ label, busy = false, disabled = false, onPress, testID }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy || disabled, busy }}
      disabled={busy || disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.green, pressed && pressedStyle, disabled && { opacity: disabledOpacity }]}
    >
      {busy ? (
        <Spinner onInk />
      ) : (
        <Text role="strong" tone="onPhoto">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function CoverNote({ children, error = false }: { children: string; error?: boolean }) {
  return (
    <View style={[styles.note, error && styles.error]} accessibilityLiveRegion="polite">
      <Text role="small" tone={error ? "danger" : "onPhoto"}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  green: { height: 52, alignItems: "center", justifyContent: "center", borderRadius: radius["3xl"], backgroundColor: colors.phone },
  note: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.lg, backgroundColor: colors.onPhotoFill },
  error: { backgroundColor: colors.paper },
});
