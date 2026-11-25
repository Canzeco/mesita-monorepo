import { StyleSheet, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { Text } from "@/components/text";
import { space } from "@/theme";

type Props = { title?: string; message: string; offline?: boolean; requestId?: string | null; onRetry?: () => void };

/** What failed and Try again. The request id ties the screen to a log line. */
export function ErrorState({ title = "Something went wrong", message, offline = false, requestId, onRetry }: Props) {
  return (
    <View style={styles.page}>
      <EmptyState
        icon={offline ? "rotate-cw" : "compass"}
        title={offline ? "No connection" : title}
        message={offline ? undefined : message}
        action={onRetry ? { label: "Try again", onPress: onRetry } : undefined}
        testID={offline ? "offline-state" : "error-state"}
      />
      {requestId ? (
        <Text role="caption" tone="muted" style={styles.id} selectable>
          {requestId}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1 }, id: { padding: space.lg, textAlign: "center" } });
