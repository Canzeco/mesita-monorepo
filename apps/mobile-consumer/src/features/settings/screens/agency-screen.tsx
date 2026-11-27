import { Linking, ScrollView, StyleSheet } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Text } from "@/components/text";
import { colors, space } from "@/theme";

const EMAIL = "support@mesita.ai";

const GROUPS = [
  { title: "Model or talent agency", line: "Models, actors, hosts", people: "models" },
  { title: "Creators", line: "Influencer agencies and creators", people: "creators" },
  { title: "Promoter or events", line: "Nightlife, concerts, festivals", people: "guests" },
  { title: "Hotel or concierge", line: "Guests asking where to go", people: "guests" },
] as const;

/** Ask for one code per person. An operator sends them. */
export function AgencyScreen() {
  const mail = (group: (typeof GROUPS)[number]) => {
    const subject = encodeURIComponent(`VIP codes: ${group.title}`);
    const body = encodeURIComponent(`Name:\nCity:\nWebsite or Instagram:\nNumber of ${group.people}:\n`);
    void Linking.openURL(`mailto:${EMAIL}?subject=${subject}&body=${body}`);
  };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text role="title">Make your people VIP</Text>
      <Text role="small" tone="muted">{"They get each place's VIP rate, on their first bill and every one after. One code per person."}</Text>
      <SettingsGroup title="Who are you?">
        {GROUPS.map((group) => (
          <SettingsRow key={group.title} icon="sparkles" label={group.title} sub={group.line} onPress={() => mail(group)} />
        ))}
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.md },
});
