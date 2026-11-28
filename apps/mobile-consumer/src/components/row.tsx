import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { pressedStyle, space } from "@/theme";

type Props = { label: string; value?: string; onPress?: () => void; testID?: string };

/** One line of a Card: what it is on the left, its value on the right. */
export function Row({ label, value, onPress, testID }: Props) {
  const body = (
    <>
      <Text style={styles.label}>{label}</Text>
      {value ? <Text tone="muted">{value}</Text> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && pressedStyle]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.md },
  label: { flex: 1 },
});
