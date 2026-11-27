import { Linking, ScrollView, StyleSheet } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { colors, space } from "@/theme";

/** Calendar opens Google's calendar page. MCP is not ready. */
export function IntegrationsScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <SettingsGroup>
        <SettingsRow icon="calendar" label="Calendar" sub="Google, Apple or Outlook" onPress={() => void Linking.openURL("https://calendar.google.com")} />
        <SettingsRow icon="plug" label="MCP" sub="Soon · ChatGPT or Claude" />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg },
});
