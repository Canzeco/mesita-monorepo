import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { colors, radius, space } from "@/theme";

import type { Suggestion } from "../api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The bar's results. The box is as tall as its rows, and never taller than the cap. */
export function ResultsPanel({
  rows,
  searching,
  failed,
  maxHeight,
  onOpen,
  onLocate,
  onGenerate,
  onRetry,
}: {
  rows: Suggestion[];
  searching: boolean;
  failed: boolean;
  maxHeight: number;
  onOpen: (id: string) => void;
  onLocate: (id: string, name: string) => void;
  onGenerate: (id: string) => void;
  onRetry: () => void;
}) {
  return (
    <View style={styles.box}>
      <ScrollView style={{ maxHeight }} keyboardShouldPersistTaps="handled">
        {searching && rows.length === 0 ? <Text role="small" tone="muted" style={styles.note}>Searching…</Text> : null}
        {failed ? (
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.note}>
            <Text role="small">{"Couldn't search. Try again."}</Text>
          </Pressable>
        ) : null}
        {!searching && !failed && rows.length === 0 ? <Text role="small" tone="muted" style={styles.note}>No match</Text> : null}
        {rows.map((row) => {
          const place = row.kind !== "location" && UUID.test(row.placeId);
          return (
            <Pressable
              key={row.placeId}
              accessibilityRole="button"
              onPress={() => (place ? onOpen(row.placeId) : row.kind === "location" ? onLocate(row.placeId, row.mainText) : onGenerate(row.placeId))}
              style={styles.row}
            >
              <Text role="label" numberOfLines={1}>{row.mainText}</Text>
              {row.secondaryText ? <Text role="caption" tone="muted" numberOfLines={1}>{row.secondaryText}</Text> : null}
              <Text role="caption" tone="muted">{place ? "Open" : row.kind === "location" ? "Map" : "Generate"}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: space.md, marginBottom: space.sm, borderRadius: radius.card, backgroundColor: colors.paper, overflow: "hidden" },
  note: { padding: space.md },
  row: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: 2 },
});
