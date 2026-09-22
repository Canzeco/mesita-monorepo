import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { COLORS } from '@/constants/brand';

export function TextField({
  label,
  helper,
  error,
  accessibilityLabel,
  ...props
}: TextInputProps & {
  label?: string;
  helper?: string;
  error?: string;
}) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="font-semibold text-foreground" style={{ fontSize: 13 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={`${COLORS.mutedForeground}99`}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: props.editable === false }}
        className="min-h-[48px] rounded-2xl border border-border bg-card px-3.5 py-3.5 text-[15px] text-foreground"
        style={[
          // Locked vs editable used to be a pink fill against a white one. In
          // the achromatic ramp that pair is white vs #efefef, which on its own
          // is a tone a tap will not wait for — so the value text drops to
          // muted too: an editable field holds ink, a locked one holds grey.
          props.editable === false
            ? { backgroundColor: COLORS.muted, color: COLORS.mutedForeground }
            : null,
          props.style,
        ]}
        {...props}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          className="text-destructive"
          style={{ fontSize: 12 }}
        >
          {error}
        </Text>
      ) : helper ? (
        <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
