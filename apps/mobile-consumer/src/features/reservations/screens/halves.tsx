import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { colors, radius, space } from "@/theme";

import type { Reservation } from "../api";
import { whenLine } from "../when";

export function statusOf(row: Reservation, nowMs: number): string {
  const live = row.state === "created" || row.state === "booking" || row.state === "confirmed";
  const at = Date.parse(row.when);
  if (row.state === "passed" || (live && Number.isFinite(at) && at < nowMs)) return "Passed";
  if (row.state === "booking") return "Booking…";
  if (row.state === "confirmed") return "Confirmed";
  if (row.state === "cancelled") return "Cancelled";
  if (row.state === "declined" || row.state === "failed") return "Not booked";
  if (row.state === "created") return "Created";
  return row.state ? row.state[0].toUpperCase() + row.state.slice(1) : "Reservation";
}

export function lineOf(row: Reservation): string {
  const people = row.party == null ? "" : `${row.party} ${row.party === 1 ? "person" : "people"}`;
  return [people, row.reference ? `#${row.reference}` : ""].filter(Boolean).join(" · ");
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

export function ReservationRows({ rows, empty, action, onOpen }: { rows: Reservation[]; empty: string; action?: { label: string; onPress: () => void }; onOpen: (id: string) => void }) {
  const nowMs = useNow();
  if (rows.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">{empty}</Text>
        {action ? (
          <Pressable accessibilityRole="button" onPress={action.onPress}>
            <Text role="label">{action.label}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {rows.map((row) => {
        const status = statusOf(row, nowMs);
        const dim = status === "Passed" || row.state === "cancelled" || row.state === "failed" || row.state === "declined";
        return (
          <Pressable key={row.id} onPress={() => onOpen(row.id)} style={styles.row}>
            {row.placePhoto ? <Image source={row.placePhoto} style={styles.photo} contentFit="cover" /> : <View style={styles.photo} />}
            <View style={styles.words}>
              <Text role="label" tone={dim ? "muted" : "ink"}>{row.placeName || "Place"}</Text>
              <Text role="small" tone={status === "Confirmed" ? "price" : "muted"}>{status}</Text>
              <Text role="body">{whenLine(row.when, row.timezone)}</Text>
              {lineOf(row) ? <Text role="small" tone="muted">{lineOf(row)}</Text> : null}
            </View>
          </Pressable>
        );
      })}
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
  row: { flexDirection: "row", gap: space.md, paddingVertical: space.sm, alignItems: "center" },
  photo: { width: 48, height: 48, borderRadius: radius.xl, backgroundColor: colors.fill },
  words: { flex: 1, gap: 2 },
});
