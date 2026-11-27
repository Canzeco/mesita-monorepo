import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { colors, space } from "@/theme";

import type { Reservation } from "../api";

export function lineOf(row: Reservation): string {
  const when = row.when ? new Date(row.when).toLocaleString() : "";
  const people = row.party == null ? "" : `${row.party} ${row.party === 1 ? "person" : "people"}`;
  const passed = row.state === "passed" ? "Passed" : row.state;
  return [passed, when, people, row.reference ? `#${row.reference}` : ""].filter(Boolean).join(" · ");
}

export type ReservationHalf = "upcoming" | "past";

const LIVE = new Set(["created", "booking", "confirmed"]);

export function halvesOf(rows: Reservation[], nowMs: number): Record<ReservationHalf, Reservation[]> {
  const upcoming: Reservation[] = [];
  const past: Reservation[] = [];
  for (const row of rows) {
    const at = Date.parse(row.when);
    const live = LIVE.has(row.state) && Number.isFinite(at) && at >= nowMs;
    (live ? upcoming : past).push(row);
  }
  upcoming.sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
  past.sort((a, b) => Date.parse(b.when) - Date.parse(a.when));
  return { upcoming, past };
}

export function ReservationTabs({ half, onPick }: { half: ReservationHalf; onPick: (half: ReservationHalf) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {(["upcoming", "past"] as const).map((name) => (
        <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: half === name }} onPress={() => onPick(name)} style={styles.tab}>
          <Text role="label" tone={half === name ? "ink" : "muted"}>{name === "upcoming" ? "Upcoming" : "Past"}</Text>
          {half === name ? <View style={styles.line} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

export function ReservationRows({ rows, empty, onOpen }: { rows: Reservation[]; empty: string; onOpen: (id: string) => void }) {
  if (rows.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">{empty}</Text>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {rows.map((row) => (
        <Pressable key={row.id} onPress={() => onOpen(row.id)} style={styles.row}>
          <Text role="label">{row.placeName || "Place"}</Text>
          <Text role="small" tone="muted">{lineOf(row)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", backgroundColor: colors.paper },
  tab: { flex: 1, alignItems: "center", paddingVertical: space.md, gap: space.xs },
  line: { height: 2, alignSelf: "stretch", backgroundColor: colors.ad },
  page: { padding: space.lg, gap: space.md },
  row: { gap: space.xs, paddingVertical: space.sm },
});
