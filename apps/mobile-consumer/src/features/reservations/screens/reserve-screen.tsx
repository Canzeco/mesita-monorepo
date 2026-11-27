import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { useMyProfile, useSession } from "@/features/auth";
import { colors, maxFontSizeMultiplier, space, type } from "@/theme";

import { createReservation, type ReserveNotify } from "../api";

const MAX_PARTY = 10;

function dayIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function upcomingDays(count: number): { iso: string; weekday: string; day: number }[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      iso: dayIso(date),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
      day: date.getDate(),
    };
  });
}

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
  const [moreDates, setMoreDates] = useState(false);
  const [onConfirm, setOnConfirm] = useState<ReserveNotify>("app");
  const [onReject, setOnReject] = useState<ReserveNotify>("app");
  const days = upcomingDays(moreDates ? 28 : 7);
  const party = Number(draft.party) || 2;
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
        onConfirm,
        onReject,
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
      <View style={styles.heading}>
        <Text role="label">Date</Text>
        <Pressable accessibilityRole="button" onPress={() => setMoreDates((open) => !open)}>
          <Text role="label">{moreDates ? "Fewer dates" : "More dates"}</Text>
        </Pressable>
      </View>
      <View style={styles.days}>
        {days.map((day) => {
          const on = draft.date === day.iso;
          return (
            <Pressable
              key={day.iso}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${day.weekday} ${day.day}`}
              onPress={() => set({ date: day.iso })}
              style={[styles.day, on && styles.dayOn]}
            >
              <Text role="caption" tone={on ? "onInk" : "muted"}>{day.weekday}</Text>
              <Text role="strong" tone={on ? "onInk" : "ink"}>{String(day.day)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Field label="Time" value={draft.time} placeholder="20:00" onChangeText={(time) => set({ time })} />
      <View style={styles.heading}>
        <Text role="label">People</Text>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fewer people"
            disabled={party <= 1}
            onPress={() => set({ party: String(Math.max(1, party - 1)) })}
            style={styles.step}
          >
            <Text role="strong">−</Text>
          </Pressable>
          <Text role="strong">{String(party)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More people"
            disabled={party >= MAX_PARTY}
            onPress={() => set({ party: String(Math.min(MAX_PARTY, party + 1)) })}
            style={styles.step}
          >
            <Text role="strong">+</Text>
          </Pressable>
        </View>
      </View>
      <Field label="First name" value={draft.firstName} placeholder="First name" onChangeText={(firstName) => set({ firstName })} />
      <Field label="Last name" value={draft.lastName} placeholder="Last name" onChangeText={(lastName) => set({ lastName })} />
      <Field label="Note" value={draft.notes} placeholder="Birthday, high chair, window table…" onChangeText={(notes) => set({ notes })} />
      <Text role="label">How should we tell you?</Text>
      <NotifyRow label="Reservation confirmed" value={onConfirm} onChange={setOnConfirm} />
      <NotifyRow label="Reservation not possible" value={onReject} onChange={setOnReject} />
      {error ? <Text role="small" tone="danger">{error}</Text> : null}
      <Button label={busy ? "Requesting…" : member ? "Reserve" : "Sign in to reserve"} onPress={() => void send()} busy={busy} />
    </ScrollView>
  );
}

function NotifyRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ReserveNotify;
  onChange: (next: ReserveNotify) => void;
}) {
  return (
    <View>
      <Text role="body">{label}</Text>
      <View style={styles.notify}>
        {(["app", "call"] as const).map((option) => {
          const on = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(option)}
              style={[styles.notifyChoice, on && styles.dayOn]}
            >
              <Text role="label" tone={on ? "onInk" : "ink"}>{option === "app" ? "App" : "App + call"}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  day: {
    width: "13%",
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.paper,
  },
  dayOn: { backgroundColor: colors.ink },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  step: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.paper,
  },
  notify: { flexDirection: "row", gap: 6, padding: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  notifyChoice: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  field: {
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: 12,
    backgroundColor: colors.paper,
    color: colors.ink,
    ...type.body,
  },
});
