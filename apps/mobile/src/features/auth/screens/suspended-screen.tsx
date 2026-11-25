import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { FieldError } from "@/components/field";
import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { colors, pressedOpacity } from "@/theme";

import { deleteAccount, signOut } from "../session";

const SUPPORT = "support@mesita.ai";

export function SuspendedScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    await deleteAccount().catch((err: Error) => {
      setBusy(false);
      setError(err.message);
    });
  };

  const ask = () =>
    Alert.alert("Delete your account?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove() },
    ]);

  return (
    <View style={styles.page}>
      <Icon name="shield-alert" size={48} color={colors.closed} />
      <Text role="heading" style={styles.center}>
        Your account is suspended
      </Text>
      <Text tone="muted" style={styles.words}>
        Too many of your tickets were closed by wrong waiter codes. Your credits are safe.
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(`mailto:${SUPPORT}`)}
        style={({ pressed }) => [styles.write, pressed && { opacity: pressedOpacity }]}
      >
        <Text role="strong" tone="onInk">
          Write to us
        </Text>
      </Pressable>
      <Text role="small" tone="muted">
        {SUPPORT}
      </Text>
      <View style={styles.more}>
        <Button kind="secondary" label="Sign out" onPress={() => void signOut()} />
        <Button kind="quiet" label="Delete account" busy={busy} onPress={ask} />
        {error ? <FieldError>{error}</FieldError> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24, backgroundColor: colors.paper },
  center: { textAlign: "center" },
  words: { maxWidth: 320, textAlign: "center" },
  write: { minHeight: 48, justifyContent: "center", marginTop: 8, paddingHorizontal: 24, borderRadius: 24, backgroundColor: colors.ink },
  more: { alignSelf: "stretch", marginTop: 24, gap: 8 },
});
