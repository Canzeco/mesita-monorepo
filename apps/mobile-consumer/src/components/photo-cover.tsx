import { Image } from "expo-image";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { cardVeil, colors, photoVeil } from "@/theme";

const TERRACE = require("../../assets/auth/terrace.jpg");

type Veil = typeof photoVeil | typeof cardVeil;

const gradient = (veil: Veil) =>
  `linear-gradient(to bottom, ${veil.colors.map((c, i) => `${c} ${veil.stops[i]}`).join(", ")})`;

/** The terrace photo under its veil: the sign-in page and the welcome card. */
export function PhotoCover({ veil = photoVeil, children }: { veil?: Veil; children: ReactNode }) {
  return (
    <View style={styles.cover}>
      <Image source={TERRACE} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: "32%", left: "50%" }} />
      <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: gradient(veil) }]} />
      {children}
    </View>
  );
}

export function CoverWordmark() {
  return (
    <View style={styles.wordmark}>
      <Icon strokeWidth={2.25} name="mark" size={28} color={colors.onPhoto} />
      <Text role="coverWordmark" tone="onPhoto">
        Mesita
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, overflow: "hidden", backgroundColor: colors.photo },
  wordmark: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 8 },
});
