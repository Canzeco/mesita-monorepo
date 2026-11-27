import { ScrollView, StyleSheet, View } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Text } from "@/components/text";
import { useMyProfile } from "@/features/auth";
import { colors, radius, space } from "@/theme";

export type ClassNav = {
  onInstagram: () => void;
  onCode: () => void;
  onAgency: () => void;
};

/** The web Class page: the gold card, then the three ways in. */
export function ClassScreen({ nav }: { nav: ClassNav }) {
  const profile = useMyProfile().data;
  const vip = profile?.isVip === true;
  const name = profile?.firstName?.trim() || "Guest";
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text role="tag" tone="onPhoto">{vip ? "VIP" : "CLASS"}</Text>
        <Text role="title" tone="onPhoto">{vip ? `${name}, VIP` : name}</Text>
        <Text role="small" tone="onPhotoSoft">
          {vip ? "You get each place's VIP rate on every bill." : "A better rate on every bill, at places with VIP offers."}
        </Text>
      </View>
      <SettingsGroup>
        <SettingsRow icon="sparkles" label="Instagram" sub="Add your handle" onPress={nav.onInstagram} />
        <SettingsRow icon="ticket" label="Invitation code" sub="Twelve digits" onPress={nav.onCode} />
        <SettingsRow icon="user" label="Bring your people" sub="Ask for codes" onPress={nav.onAgency} />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.lg },
  card: { backgroundColor: colors.ink, borderRadius: radius.card, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.vip },
});
