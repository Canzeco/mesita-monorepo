import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { colors, maxFontSizeMultiplier, space, type } from "@/theme";

import { EdgeError } from "@/lib/edge";

import { REPORT_REASONS, reportPlace, type ReportReason } from "../api";

const NOTE_MAX = 500;

export function ReportScreen({ id, onSent }: { id: string; onSent: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const chosen = REPORT_REASONS.find((row) => row.key === reason) ?? null;
  const ready = reason !== null && !(reason === "other" && note.trim() === "");
  const send = async () => {
    if (!reason || !ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reportPlace(id, reason, note);
      setSent(true);
    } catch (err) {
      const status = err instanceof EdgeError ? err.status : null;
      setError(status === 429 ? "You've sent a lot of reports. Try again later." : "Couldn't send your report. Try again.");
      setBusy(false);
    }
  };
  if (sent) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">Thanks for letting us know</Text>
        <Button label="Done" onPress={onSent} />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text role="label">Why are you reporting this place?</Text>
      {REPORT_REASONS.map((row) => (
        <Pressable key={row.key} accessibilityRole="radio" accessibilityState={{ checked: reason === row.key }} onPress={() => setReason(row.key)} style={styles.row}>
          <Text role="body" tone={reason === row.key ? "ink" : "muted"}>
            {reason === row.key ? "● " : "○ "}
            {row.label}
          </Text>
        </Pressable>
      ))}
      {chosen ? (
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={chosen.prompt}
          placeholderTextColor={colors.muted}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          maxLength={NOTE_MAX}
          style={styles.field}
          multiline
        />
      ) : null}
      {error ? <Text role="small" tone="danger">{error}</Text> : null}
      <Button label={busy ? "Sending…" : "Send report"} onPress={() => void send()} busy={busy} disabled={!ready} />
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
