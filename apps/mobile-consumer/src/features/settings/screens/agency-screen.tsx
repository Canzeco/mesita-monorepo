import { useState } from "react";
import { Linking, ScrollView, StyleSheet } from "react-native";

import { Button } from "@/components/button";
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
  const [picked, setPicked] = useState<(typeof GROUPS)[number] | null>(null);
  const mail = () => {
    if (!picked) return;
    const subject = encodeURIComponent(`VIP codes: ${picked.title}`);
    const body = encodeURIComponent(`Name:\nCity:\nWebsite or Instagram:\nNumber of ${picked.people}:\n`);
    void Linking.openURL(`mailto:${EMAIL}?subject=${subject}&body=${body}`);
  };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text role="title">Make your people VIP</Text>
      <Text role="small" tone="muted">{"They get each place's VIP rate, on their first bill and every one after. One code per person."}</Text>
      <SettingsGroup title="Who are you?">
        {GROUPS.map((group) => (
          <SettingsRow
            key={group.title}
            icon={picked?.title === group.title ? "check" : "sparkles"}
            label={group.title}
            sub={group.line}
            onPress={() => setPicked(group)}
          />
        ))}
      </SettingsGroup>
      <Button label={picked ? "Request codes" : "Pick one to request codes"} disabled={!picked} onPress={mail} />
      <Text role="small" tone="muted">It opens an email to us. We review it and reply.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.md },
});
