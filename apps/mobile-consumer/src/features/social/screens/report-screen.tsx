import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { colors, maxFontSizeMultiplier, space, type } from "@/theme";

import { REPORT_REASONS, reportPerson, type ReportReason } from "../api";

export function ReportPersonScreen({
  event,
  onSent,
}: {
  event: { placeId: string; kind: string; at: string };
  onSent: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (reason === "other" && note.trim().length === 0) {
      setError("Tell us what's wrong");
      return;
    }
    setBusy(true);
    try {
      await reportPerson(event, reason, note);
      onSent();
    } catch {
      setError("Could not send that.");
      setBusy(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {REPORT_REASONS.map((row) => (
        <Pressable key={row.key} onPress={() => setReason(row.key)} style={styles.row}>
          <Text role="body" tone={reason === row.key ? "ink" : "muted"}>
            {reason === row.key ? "● " : "○ "}
            {row.label}
          </Text>
        </Pressable>
      ))}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={reason === "other" ? "Tell us what's wrong" : "Anything to add? (optional)"}
        placeholderTextColor={colors.muted}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        style={styles.field}
        multiline
      />
      {error ? <Text role="small" tone="danger">{error}</Text> : null}
      <Button label="Send" onPress={() => void send()} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.sm },
  row: { paddingVertical: space.sm },
  field: {
    minHeight: 80,
    padding: space.md,
    borderRadius: 12,
    backgroundColor: colors.paper,
    color: colors.ink,
    ...type.body,
  },
});
