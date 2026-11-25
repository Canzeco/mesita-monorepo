import { useState } from "react";
import { ScrollView, StyleSheet, TextInput } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { colors, maxFontSizeMultiplier, space, type } from "@/theme";

import { updateReservation } from "../api";

export function RescheduleScreen({ id, onDone }: { id: string; onDone: () => void }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [party, setParty] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
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
      setError("Could not change that reservation.");
      setBusy(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <TextInput value={date} onChangeText={setDate} placeholder="2026-11-25" placeholderTextColor={colors.muted} maxFontSizeMultiplier={maxFontSizeMultiplier} style={styles.field} />
      <TextInput value={time} onChangeText={setTime} placeholder="20:00" placeholderTextColor={colors.muted} maxFontSizeMultiplier={maxFontSizeMultiplier} style={styles.field} />
      <TextInput value={party} onChangeText={setParty} placeholder="2" placeholderTextColor={colors.muted} maxFontSizeMultiplier={maxFontSizeMultiplier} style={styles.field} />
      {error ? <Text role="small" tone="danger">{error}</Text> : null}
      <Button label="Save" onPress={() => void send()} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
