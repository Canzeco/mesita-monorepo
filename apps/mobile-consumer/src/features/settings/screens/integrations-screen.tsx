import { ScrollView, StyleSheet } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { colors, space } from "@/theme";

/** Calendar opens the guest's own feeds. MCP is not ready. */
export function IntegrationsScreen({ onCalendar }: { onCalendar: () => void }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <SettingsGroup>
        <SettingsRow icon="calendar" label="Calendar" sub="Google, Apple or Outlook" onPress={onCalendar} />
        <SettingsRow icon="plug" label="MCP" sub="Soon · ChatGPT or Claude" />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg },
});
