import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { space } from "@/theme";

type Props = { message: string; action?: { label: string; onPress: () => void } };

/** One line of what belongs here and one action. */
export function EmptyState({ message, action }: Props) {
  return (
    <View style={styles.box} testID="empty-state">
      <Text tone="muted" style={styles.text}>
        {message}
      </Text>
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: "center", gap: space.lg, padding: space.xl },
  text: { textAlign: "center" },
});
