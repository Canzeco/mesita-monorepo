import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Text } from "@/components/text";
import { useSession } from "@/features/auth";
import { colors, maxFontSizeMultiplier, space, type } from "@/theme";

import { createPlace, suggestPlaces } from "../api";

/** Members add a Google place Mesita does not have yet. A guest is sent to sign in. */
export function AddPlaceScreen({
  onSignIn,
  onCreated,
  near = null,
}: {
  onSignIn: () => void;
  onCreated: (id: string) => void;
  /** The map's point when Search opened it: the search leans there. */
  near?: { lat: number; lng: number } | null;
}) {
  const member = useSession().guestId !== null;
  const [term, setTerm] = useState("");
  const [token] = useState(() => Crypto.randomUUID());
  const [rows, setRows] = useState<{ placeId: string; mainText: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  if (!member) {
    return (
      <View style={styles.page}>
        <Text role="body">Sign in to add a place.</Text>
        <Pressable onPress={onSignIn}>
          <Text role="label">Sign in</Text>
        </Pressable>
      </View>
    );
  }
  const look = async (value: string) => {
    setTerm(value);
    if (value.trim().length < 3) {
      setRows([]);
      return;
    }
    const found = await suggestPlaces(value.trim(), token, near).catch(() => []);
    setRows(found.map((row) => ({ placeId: row.placeId, mainText: row.mainText })));
  };
  const add = async (placeId: string) => {
    setError(null);
    try {
      const place = await createPlace(placeId);
      onCreated(place.id);
    } catch {
      setError("Could not add that place.");
    }
  };
  return (
    <View style={styles.page}>
      <TextInput
        value={term}
        onChangeText={(value) => void look(value)}
        placeholder="Search Google"
        placeholderTextColor={colors.muted}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        style={styles.field}
      />
      {rows.map((row) => (
        <Pressable key={row.placeId} onPress={() => void add(row.placeId)} style={styles.row}>
          <Text role="body">{row.mainText}</Text>
        </Pressable>
      ))}
      {error ? <Text role="small" tone="danger">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: space.lg, gap: space.md },
  field: {
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: 12,
    backgroundColor: colors.paper,
    color: colors.ink,
    ...type.body,
  },
  row: { paddingVertical: space.sm },
});
