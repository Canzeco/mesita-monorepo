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
        setSaid("Thanks for your feedback");
      })
      .catch((err: unknown) => {
        const status = err instanceof EdgeError ? err.status : null;
        setSaid(status === 429 ? "You've sent a lot of feedback. Try again later." : "Couldn't send your feedback. Try again.");
      })
      .finally(() => setBusy(false));
  };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Field label="Your feedback" placeholder="Tell us about the app" value={note} onChangeText={setNote} multiline maxLength={FEEDBACK_MAX} style={styles.note} />
      {said ? <Text role="small">{said}</Text> : null}
      <Button label={busy ? "Sending…" : "Send"} busy={busy} disabled={trimmed.length < 1} onPress={send} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.md },
  note: { minHeight: 120, textAlignVertical: "top" },
});
