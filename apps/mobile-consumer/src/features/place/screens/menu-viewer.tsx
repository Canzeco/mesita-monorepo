import { Image } from "expo-image";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import type { PlaceDetail } from "@/generated/shared/place-detail";
import { colors, space } from "@/theme";

import { menuMeta, nutritionLine } from "./menu-copy";

type Menu = PlaceDetail["products"]["menu"][number];

/** One stored menu: its name, the place, and the file. */
export function MenuViewer({ menu, placeName }: { menu: Menu; placeName: string }) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const nutrition = nutritionLine(menu.nutrition);
  const zoomable = menu.kind === "image" && !failed;
  return (
    <View style={styles.fill}>
      <View style={styles.head}>
        <View style={styles.words}>
          <Text role="strong" numberOfLines={1}>{menu.name || "Menu"}</Text>
          <Text role="caption" tone="muted" numberOfLines={1}>{placeName}</Text>
          {nutrition ? <Text role="caption" numberOfLines={1}>{nutrition}</Text> : null}
          <Text role="caption" tone="muted" numberOfLines={1}>{menuMeta(menu.kind, menu.pages)}</Text>
        </View>
        <Pressable accessibilityRole="link" accessibilityLabel="Open externally" onPress={() => void Linking.openURL(menu.url)} style={styles.open}>
          <Text role="label">Open</Text>
        </Pressable>
      </View>
      {zoomable ? (
        <ScrollView contentContainerStyle={styles.stage} maximumZoomScale={1} bounces={false}>
          <Image
            source={menu.url}
            contentFit="contain"
            style={[styles.image, { transform: [{ scale: zoom }] }]}
            onError={() => setFailed(true)}
          />
        </ScrollView>
      ) : (
        <View style={styles.missing}>
          <Text role="body" tone="muted">{"Prices may differ at the place."}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(menu.url)}>
            <Text role="label">Open full</Text>
          </Pressable>
        </View>
      )}
      {zoomable ? (
        <View style={styles.zoom}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" disabled={zoom <= 0.75} onPress={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))} style={styles.zoomBtn}>
            <Text role="strong">−</Text>
          </Pressable>
          <Text role="caption" tone="muted">{`${Math.round(zoom * 100)}%`}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" disabled={zoom >= 2.5} onPress={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))} style={styles.zoomBtn}>
            <Text role="strong">+</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, backgroundColor: colors.paper },
  words: { flex: 1, gap: 2 },
  open: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm },
  stage: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: space.md },
  image: { width: "100%", height: 480 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.lg },
  zoom: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.md, padding: space.sm, backgroundColor: colors.paper },
  zoomBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" },
});
