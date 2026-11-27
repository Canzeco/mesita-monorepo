import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Text } from "@/components/text";
import { EdgeError } from "@/lib/edge";
import { colors, space } from "@/theme";

import { setInstagramHandle, startInstagramDm } from "../hub";

/** Save a handle, then ask Instagram for the code the guest DMs. */
export function InstagramScreen() {
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
        setSaid(name === "dm_unavailable" ? "Verifying by DM is off right now. The handle is saved." : "Couldn't save that. Try again.");
      })
      .finally(() => setBusy(false));
  };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text role="body">Add your Instagram. A DM proves it is yours.</Text>
      <Field label="Handle" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} />
      {code ? <Text role="title">{code}</Text> : null}
      {said ? <Text role="small">{said}</Text> : null}
      <Button label="Save" busy={busy} disabled={handle.trim().length < 1} onPress={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.md },
});
