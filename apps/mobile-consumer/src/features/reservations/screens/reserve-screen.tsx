import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, TextInput } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { useMyProfile, useSession } from "@/features/auth";
import { colors, maxFontSizeMultiplier, space, type } from "@/theme";

import { createReservation } from "../api";

type Draft = {
  placeId: string;
  requestId: string;
  date: string;
  time: string;
  party: string;
  notes: string;
  firstName: string;
  lastName: string;
};

/** One modal. The draft lives in the route, so signing in does not wipe it. */
export function ReserveScreen({
  draft,
  onChange,
  onSignIn,
  onBooked,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
  onSignIn: () => void;
  onBooked: (id: string) => void;
}) {
  const member = useSession().guestId !== null;
  const profile = useMyProfile().data;
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const dirty = draft.notes.length > 0 || draft.party !== "2" || draft.date.length > 0 || draft.time.length > 0;

  useEffect(() => {
    if (profile && !draft.firstName && profile.firstName) onChange({ ...draft, firstName: profile.firstName, lastName: profile.lastName ?? "" });
  }, [profile, draft, onChange]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove" as never, ((event: { preventDefault: () => void; data?: { action?: object } }) => {
      if (!dirty || done || !event.data?.action) return;
      event.preventDefault();
      Alert.alert("Discard this reservation?", undefined, [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(event.data!.action as never) },
      ]);
    }) as never);
    return () => sub();
  }, [dirty, done, navigation]);

  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const send = async () => {
    if (!member) {
      onSignIn();
      return;
    }
    const party = Number(draft.party);
    if (!draft.date || !draft.time || !Number.isInteger(party) || party < 1 || party > 10) {
      setError("Add a date, a time, and a party of 1 to 10.");
      return;
    }
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setError("Add the first and last name the table is under.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const [year, month, day] = draft.date.split("-").map(Number);
      const [hour, minute] = draft.time.split(":").map(Number);
      const reservedAt = new Date(year, (month ?? 1) - 1, day, hour, minute).toISOString();
      const id = await createReservation({
        placeId: draft.placeId,
        reservedAt,
        partySize: party,
        notes: draft.notes,
        firstName: draft.firstName,
        lastName: draft.lastName,
        requestId: draft.requestId,
      });
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      onBooked(id);
    } catch {
      setError("Couldn't request the reservation.");
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} testID="reserve">
      <Field label="Date" value={draft.date} placeholder="2026-11-25" onChangeText={(date) => set({ date })} />
      <Field label="Time" value={draft.time} placeholder="20:00" onChangeText={(time) => set({ time })} />
      <Field label="Guests" value={draft.party} placeholder="2" onChangeText={(party) => set({ party })} />
      <Field label="First name" value={draft.firstName} placeholder="First name" onChangeText={(firstName) => set({ firstName })} />
      <Field label="Last name" value={draft.lastName} placeholder="Last name" onChangeText={(lastName) => set({ lastName })} />
      <Field label="Note" value={draft.notes} placeholder="Birthday, high chair, window table…" onChangeText={(notes) => set({ notes })} />
      {error ? <Text role="small" tone="danger">{error}</Text> : null}
      <Button label={busy ? "Requesting…" : member ? "Reserve" : "Sign in to reserve"} onPress={() => void send()} busy={busy} />
    </ScrollView>
  );
}

function Field({ label, ...props }: { label: string; value: string; placeholder: string; onChangeText: (value: string) => void }) {
  return (
    <>
      <Text role="label">{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.muted} maxFontSizeMultiplier={maxFontSizeMultiplier} style={styles.field} />
    </>
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
