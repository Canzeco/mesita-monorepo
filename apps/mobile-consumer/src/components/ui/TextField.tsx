import { Text, TextInput, View, type TextInputProps } from 'react-native';

export function TextField({
  label,
  helper,
  error,
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
        placeholderTextColor="#77525499"
        className="rounded-2xl border border-border bg-card px-3.5 py-3.5 text-[15px] text-foreground"
        style={[
          props.editable === false ? { backgroundColor: '#faeff0' } : null,
          props.style,
        ]}
        {...props}
      />
      {error ? (
        <Text className="text-destructive" style={{ fontSize: 12 }}>
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
