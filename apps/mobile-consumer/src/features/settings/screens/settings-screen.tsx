import { Alert, Linking, Pressable, ScrollView, StyleSheet } from "react-native";

import { Icon } from "@/components/icon";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Text } from "@/components/text";
import { useMyProfile, signOut } from "@/features/auth";
import { CONTRACT } from "@/lib/build";
import { colors, pressedOpacity, space } from "@/theme";

const TERMS = "https://landing.mesita.ai/terms";
const PRIVACY = "https://landing.mesita.ai/privacy";

export type SettingsNav = {
  onIntegrations: () => void;
  onRefunds: () => void;
  onContact: () => void;
  onFeedback: () => void;
};

/** The web Settings page: Integrations, Account, Help, Legal, then Sign out. */
export function SettingsScreen({ nav }: { nav: SettingsNav }) {
  const phone = useMyProfile().data?.phone;
  const askSignOut = () =>
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <SettingsGroup title="Integrations">
        <SettingsRow icon="plug" label="Integrations" sub="Calendar and MCP" onPress={nav.onIntegrations} />
      </SettingsGroup>
      <SettingsGroup title="Account">
        <SettingsRow icon="phone" label="Phone" sub={phone?.trim() || "Not set"} />
        <SettingsRow icon="coins" label="Refunds" sub="Money returned to you" onPress={nav.onRefunds} />
      </SettingsGroup>
      <SettingsGroup title="Help">
        <SettingsRow icon="message" label="Contact" sub="Talk to a person" onPress={nav.onContact} />
        <SettingsRow icon="message" label="Send feedback" sub="Tell us what to fix" onPress={nav.onFeedback} />
      </SettingsGroup>
      <SettingsGroup title="Legal">
        <SettingsRow icon="scroll" label="Terms of use" onPress={() => void Linking.openURL(TERMS)} />
        <SettingsRow icon="scroll" label="Privacy policy" onPress={() => void Linking.openURL(PRIVACY)} />
      </SettingsGroup>
      <SettingsGroup>
        <Pressable accessibilityRole="button" testID="sign-out" onPress={askSignOut} style={({ pressed }) => [styles.signOut, pressed && { opacity: pressedOpacity }]}>
          <Icon name="log-in" size={16} />
          <Text role="label">Sign out</Text>
        </Pressable>
      </SettingsGroup>
      <Text role="caption" tone="muted" style={styles.version}>{`Mesita · ${CONTRACT}`}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.lg },
  signOut: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  version: { textAlign: "center" },
});
