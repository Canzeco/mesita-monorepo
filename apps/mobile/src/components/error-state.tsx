import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { space } from "@/theme";

type Props = { message: string; offline?: boolean; requestId?: string | null; onRetry?: () => void };

/** What failed and Try again. The request id ties the screen to a log line. */
export function ErrorState({ message, offline = false, requestId, onRetry }: Props) {
  return (
    <View style={styles.box} testID={offline ? "offline-state" : "error-state"}>
      <Text style={styles.text}>{offline ? "No connection" : message}</Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
      {requestId ? (
        <Text role="caption" tone="muted" style={styles.text} selectable>
          {requestId}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: "center", gap: space.lg, padding: space.xl },
  text: { textAlign: "center" },
});
