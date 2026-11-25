import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { Text } from "@/components/text";
import { colors, maxFontSizeMultiplier, radius, space, type } from "@/theme";

type Props = TextInputProps & { label: string; error?: string | null };

export function Field({ label, error, ...input }: Props) {
  return (
    <View style={styles.field}>
      <Text role="tag" tone="muted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        {...input}
        style={[styles.input, error ? styles.wrong : null]}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}

export function FieldError({ children }: { children: string }) {
  return (
    <Text role="caption" tone="danger" accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: {
    ...type.small,
    minHeight: 44,
    paddingHorizontal: space.md,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
  },
  wrong: { borderColor: colors.danger },
});
