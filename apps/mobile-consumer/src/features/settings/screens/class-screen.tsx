import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Text } from "@/components/text";
import { useMyProfile } from "@/features/auth";
import { colors, radius, space } from "@/theme";

export type ClassNav = {
  onInstagram: () => void;
  onCode: () => void;
  onAgency: () => void;
  onExplore: () => void;
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
      {profile && !vip ? (
        <View style={styles.upgrade}>
          <Text role="small" tone="muted">{"You're Regular now"}</Text>
          <Text role="strong">Upgrade to VIP</Text>
          <SettingsGroup>
            <SettingsRow icon="sparkles" label="Instagram" sub="More than 5,000 followers" onPress={nav.onInstagram} />
            <SettingsRow icon="ticket" label="Invitation code" sub="12 digits" onPress={nav.onCode} />
          </SettingsGroup>
        </View>
      ) : null}
      {profile && vip ? (
        <View style={styles.upgrade}>
          <Button label="Explore places" onPress={nav.onExplore} />
          {profile.instagramHandle ? (
            <SettingsGroup>
              <SettingsRow icon="sparkles" label="Instagram" sub={`@${profile.instagramHandle}`} onPress={nav.onInstagram} />
            </SettingsGroup>
          ) : null}
        </View>
      ) : null}
      <SettingsGroup>
        <SettingsRow icon="user" label="Bring your people" sub="Agencies, creators, promoters, hotels" onPress={nav.onAgency} />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.lg },
  card: { backgroundColor: colors.ink, borderRadius: radius["2xl"], padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.vip },
  upgrade: { gap: space.md, alignSelf: "stretch" },
});
