import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { rereadMyProfile, setMyProfile, useMyProfile, useSession } from "@/features/auth";
import { colors, maxFontSizeMultiplier, space, type } from "@/theme";

import { saveNames } from "../api";

/** The photo the server already has stays. Picking a new one is not on this screen. */
export function ProfileScreen({ onSaved }: { onSaved: () => void }) {
  const profile = useMyProfile().data;
  const guestId = useSession().guestId;
  const [first, setFirst] = useState(profile?.firstName ?? "");
  const [last, setLast] = useState(profile?.lastName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!first.trim() || !last.trim() || !guestId) {
      setError("Add your first and last name.");
      return;
    }
    setBusy(true);
    try {
      setMyProfile(await saveNames(first, last, profile?.sex ?? null, profile?.birthYear ?? null));
      await rereadMyProfile(guestId);
      onSaved();
    } catch {
      setError("Could not save that.");
      setBusy(false);
    }
  };
  return (
    <View style={styles.page}>
      <Text role="label">First name</Text>
      <TextInput value={first} onChangeText={setFirst} style={styles.field} placeholderTextColor={colors.muted} maxFontSizeMultiplier={maxFontSizeMultiplier} />
      <Text role="label">Last name</Text>
      <TextInput value={last} onChangeText={setLast} style={styles.field} placeholderTextColor={colors.muted} maxFontSizeMultiplier={maxFontSizeMultiplier} />
      {error ? <Text role="small" tone="danger">{error}</Text> : null}
      <Button label="Save" onPress={() => void save()} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: space.lg, gap: space.sm },
  field: {
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: 12,
    backgroundColor: colors.paper,
    color: colors.ink,
    ...type.body,
  },
});
