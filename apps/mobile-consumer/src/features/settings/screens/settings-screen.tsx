import { Alert, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { signOut } from "@/features/auth";
import { CONTRACT, updateId, variant } from "@/lib/build";
import { space } from "@/theme";

export function SettingsScreen({ onDelete }: { onDelete: () => void }) {
  const askSignOut = () =>
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  return (
    <View style={styles.page}>
      <Text role="body" selectable>{`${variant} · ${updateId} · contract ${CONTRACT}`}</Text>
      <Button kind="secondary" label="Sign out" onPress={askSignOut} testID="sign-out" />
      <Button kind="quiet" label="Delete account" onPress={onDelete} />
    </View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, padding: space.lg, gap: space.md } });
