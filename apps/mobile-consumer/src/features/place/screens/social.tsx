import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import type { PlaceDetail } from "@/generated/shared/place-detail";
import { space } from "@/theme";

const LINKS = [
  ["Website", "website_url"],
  ["WhatsApp", "whatsapp_url"],
  ["Instagram", "instagram_url"],
  ["Facebook", "facebook_url"],
] as const;

/** The long description and the place's own links. */
export function Social({ place }: { place: PlaceDetail }) {
  const rows = LINKS.flatMap(([label, key]) => {
    const url = place.channels[key];
    return url ? [{ label, url }] : [];
  });
  return (
    <View style={styles.box}>
      <Text role="body">{place.long_description || "Nothing here yet"}</Text>
      {rows.map((row) => (
        <Pressable key={row.label} accessibilityRole="link" onPress={() => void Linking.openURL(row.url)}>
          <Text role="label">{row.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: space.md } });
