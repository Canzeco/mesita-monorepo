import { Linking, ScrollView, StyleSheet } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { colors, space } from "@/theme";

const EMAIL = "support@mesita.ai";
const INSTAGRAM = "https://instagram.com/mesita.ai";

/** The web Contact page: email, help, and Instagram. */
export function ContactScreen() {
  const mail = (subject?: string) => {
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    void Linking.openURL(`mailto:${EMAIL}${query}`);
  };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <SettingsGroup>
        <SettingsRow icon="mail" label="Email us" sub={EMAIL} onPress={() => mail()} />
        <SettingsRow icon="message" label="Get help" sub="Report a problem or ask a question" onPress={() => mail("I need help with Mesita")} />
        <SettingsRow icon="sparkles" label="Instagram" sub="@mesita.ai" onPress={() => void Linking.openURL(INSTAGRAM)} />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg },
});
