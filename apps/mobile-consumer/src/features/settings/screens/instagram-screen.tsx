import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Text } from "@/components/text";
import { useMyProfile } from "@/features/auth";
import { EdgeError } from "@/lib/edge";
import { colors, space } from "@/theme";

import { setInstagramHandle, startInstagramDm } from "../hub";

/** Save a handle, then ask Instagram for the code the guest DMs. */
export function InstagramScreen() {
  const current = useMyProfile().data?.instagramHandle ?? null;
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const save = () => {
    const trimmed = handle.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setSaid(null);
    void setInstagramHandle(trimmed)
      .then(() => startInstagramDm())
      .then((answer) => {
        setCode(answer.code);
        setSaid(`Send ${answer.code} in a DM to @${answer.account}.`);
      })
      .catch((err: unknown) => {
        const name = err instanceof EdgeError ? err.code : "";
        setSaid(name === "dm_unavailable" ? "Verifying by DM is off right now. The handle is saved." : "Couldn't save. Try again.");
      })
      .finally(() => setBusy(false));
  };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text role="strong">{current ? "Your Instagram" : "Verify your Instagram"}</Text>
      {current ? null : <Text role="small" tone="muted">{"Have a public Instagram with more than 5,000 followers? Verify it and you're in."}</Text>}
      <Field label="Handle" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} />
      {current ? <Text role="caption" tone="muted">{`A new handle starts Unverified. @${current} is removed.`}</Text> : null}
      {code ? <Text role="title">{code}</Text> : null}
      {said ? <Text role="small">{said}</Text> : null}
      <Button label={busy ? "Saving…" : current ? "Save" : "Continue"} busy={busy} disabled={handle.trim().length < 1} onPress={save} />
      <Text role="caption" tone="muted">We never ask for your Instagram password.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.md },
});
