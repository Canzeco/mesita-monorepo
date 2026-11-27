import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Text } from "@/components/text";
import { EdgeError } from "@/lib/edge";
import { colors, space } from "@/theme";

import { FEEDBACK_MAX, sendFeedback } from "../hub";

/** The web feedback page: one note, then it is stored. */
export function FeedbackScreen() {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const trimmed = note.trim();
  const send = () => {
    if (trimmed.length < 1 || trimmed.length > FEEDBACK_MAX || busy) return;
    setBusy(true);
    setSaid(null);
    void sendFeedback(trimmed)
      .then(() => {
        setNote("");
        setSaid("Sent. Thank you.");
      })
      .catch((err: unknown) => {
        const code = err instanceof EdgeError ? err.code : "";
        setSaid(code === "too_much_feedback" ? "That's enough for now. Try again in an hour." : "Couldn't send that. Try again.");
      })
      .finally(() => setBusy(false));
  };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text role="body">Tell us what to fix.</Text>
      <Field label="Note" value={note} onChangeText={setNote} multiline maxLength={FEEDBACK_MAX} style={styles.note} />
      {said ? <Text role="small">{said}</Text> : null}
      <Button label="Send" busy={busy} disabled={trimmed.length < 1} onPress={send} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.md },
  note: { minHeight: 120, textAlignVertical: "top" },
});
