import { useState } from "react";
import { Linking, ScrollView, Share, StyleSheet } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Text } from "@/components/text";
import { colors, space } from "@/theme";

const URL = "https://mesita.ai/";
const MESSAGE = "Stop asking me where to eat. Use this. 🙄";
const BODY = `${MESSAGE} ${URL}`;

/** The web Share page: WhatsApp, Instagram, Messages, Copy link, More. */
export function ShareScreen() {
  const [said, setSaid] = useState<string | null>(null);
  const whatsapp = () => void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(BODY)}`);
  const messages = () => void Linking.openURL(`sms:?&body=${encodeURIComponent(BODY)}`);
  const instagram = () => {
    setSaid("Copied: paste it in an Instagram chat");
    void Share.share({ message: BODY }).catch(() => setSaid("Couldn't copy the message: paste it yourself"));
    void Linking.openURL("https://www.instagram.com/direct/inbox/");
  };
  const copy = () => {
    void Share.share({ message: URL })
      .then(() => setSaid("Link copied"))
      .catch(() => setSaid("Couldn't copy the link"));
  };
  const more = () => void Share.share({ title: "Mesita", message: BODY });
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text role="body">Send Mesita to a friend.</Text>
      <SettingsGroup>
        <SettingsRow icon="share-2" label="WhatsApp" onPress={whatsapp} />
        <SettingsRow icon="sparkles" label="Instagram" sub="Copy, then paste in a chat" onPress={instagram} />
        <SettingsRow icon="message" label="Messages" onPress={messages} />
        <SettingsRow icon="scroll" label="Copy link" onPress={copy} />
        <SettingsRow icon="share-2" label="More" onPress={more} />
      </SettingsGroup>
      {said ? <Text role="small">{said}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.md },
});
