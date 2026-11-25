import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { CONTRACT, updateId, variant } from "@/lib/build";
import { space } from "@/theme";

export function SettingsScreen() {
  return (
    <View style={styles.page}>
      <Text role="title">Settings</Text>
      <Text role="body" selectable>{`${variant} · ${updateId} · contract ${CONTRACT}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, padding: space.lg, gap: space.sm } });
