import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, maxFontSizeMultiplier, space, type } from "@/theme";

import { listReservations, updateReservation } from "../api";

function movable(state: string, when: string, now: number): boolean {
  const live = state === "created" || state === "booking" || state === "confirmed";
  const at = Date.parse(when);
  return live && Number.isFinite(at) && at >= now;
}

/** Move a table. It stays until the place says yes. */
export function RescheduleScreen({ id, onDone }: { id: string; onDone: () => void }) {
  const [now] = useState(() => Date.now());
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [party, setParty] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["reservations"], queryFn: ({ signal }) => listReservations(signal) });
  const copy = useErrorCopy(query.error);
  const send = async () => {
    const size = Number(party);
    if (!date || !time || !Number.isInteger(size)) {
      setError("Add a date, a time, and a party.");
      return;
    }
    setBusy(true);
    try {
      const [year, month, day] = date.split("-").map(Number);
      const [hour, minute] = time.split(":").map(Number);
      await updateReservation(id, new Date(year, (month ?? 1) - 1, day, hour, minute).toISOString(), size);
      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      onDone();
    } catch {
      setError("Couldn't update the reservation.");
      setBusy(false);
    }
  };
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  const row = query.data.find((item) => item.id === id);
  if (!row || !movable(row.state, row.when, now)) {
    return (
      <View style={styles.missing}>
        <Text role="body" tone="muted">{"This table can't be moved."}</Text>
      </View>
    );
  }
  const size = Number(party);
  const noun = size === 1 ? "person" : "people";
  const label = busy ? "Updating…" : !time ? "No times left" : `Ask for ${Number.isInteger(size) ? size : party} ${noun} at ${time}`;
  const place = row.placeName || "the place";
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text role="title">Move your table</Text>
      <Text role="small" tone="muted">{`${place} · now ${row.when ? new Date(row.when).toLocaleString() : ""}`}</Text>
      <Text role="body" tone="muted">{`Pick a new slot and Mesita calls ${place} again to confirm it. Your table isn't moved until they say yes.`}</Text>
      <Text role="label">Date</Text>
      <TextInput value={date} onChangeText={setDate} placeholder="2026-11-25" placeholderTextColor={colors.muted} maxFontSizeMultiplier={maxFontSizeMultiplier} style={styles.field} />
      <Text role="label">Time</Text>
      <TextInput value={time} onChangeText={setTime} placeholder="20:00" placeholderTextColor={colors.muted} maxFontSizeMultiplier={maxFontSizeMultiplier} style={styles.field} />
      <Text role="label">Guests</Text>
      <TextInput value={party} onChangeText={setParty} placeholder="2" placeholderTextColor={colors.muted} maxFontSizeMultiplier={maxFontSizeMultiplier} style={styles.field} />
      {error ? <Text role="small" tone="danger">{error}</Text> : null}
      <Button label={label} onPress={() => void send()} busy={busy} disabled={!date || !time} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  page: { padding: space.lg, gap: space.sm },
  field: {
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: 12,
    backgroundColor: colors.paper,
    color: colors.ink,
    ...type.body,
  },
});
