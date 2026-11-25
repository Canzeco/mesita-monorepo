import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme";

import type { PayPlace } from "../places";

export function PlacePhoto({ place }: { place: PayPlace }) {
  if (!place.photo) return <View style={styles.photo} />;
  return <Image source={{ uri: place.photo }} style={styles.photo} contentFit="cover" />;
}

const styles = StyleSheet.create({
  photo: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.fill },
});
