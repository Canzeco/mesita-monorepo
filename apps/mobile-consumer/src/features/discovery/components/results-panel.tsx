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
  onClear,
}: {
  rows: Suggestion[];
  searching: boolean;
  failed: boolean;
  maxHeight: number;
  onOpen: (id: string) => void;
  onLocate: (id: string, name: string) => void;
  onGenerate: (row: Suggestion) => void;
  onRetry: () => void;
  onClear?: () => void;
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
        {!searching && !failed && rows.length === 0 ? (
          <View style={styles.note}>
            <Text role="label">No matches found</Text>
            <Text role="caption" tone="muted">Try the full name, or clear the search to browse the map.</Text>
            {onClear ? (
              <Pressable accessibilityRole="button" onPress={onClear} style={styles.clear}>
                <Text role="label">Clear search</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {rows.map((row) => {
          const place = row.kind !== "location" && UUID.test(row.placeId);
          return (
            <Pressable
              key={row.placeId}
              accessibilityRole="button"
              onPress={() => (place ? onOpen(row.placeId) : row.kind === "location" ? onLocate(row.placeId, row.mainText) : onGenerate(row))}
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
  box: { marginHorizontal: space.md, marginBottom: space.sm, borderRadius: radius["2xl"], backgroundColor: colors.paper, overflow: "hidden" },
  note: { padding: space.md, gap: space.xs },
  clear: { alignSelf: "center", marginTop: space.xs, height: 36, paddingHorizontal: space.md, borderRadius: radius.panel, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  row: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: 2 },
});
