import { useNavigation } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { useMyProfile, useSession } from "@/features/auth";
import { getPlaceDetail } from "@/features/place";
import { pad, placeInstantIso, slotMinutes } from "@/generated/shared/lib/place-time";
import { colors, maxFontSizeMultiplier, space, type } from "@/theme";

import { createReservation, type ReserveNotify, type ReserveWindow } from "../api";
import { buildDateOptions, openSlots, parseHoursTable, resolveSlot } from "../slots";

const MAX_PARTY = 10;
const DINNER_FROM = "17:00";

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
  const [windowMinutes, setWindowMinutes] = useState<ReserveWindow>(30);
  const place = useQuery({
    queryKey: ["place-detail", draft.placeId],
    queryFn: ({ signal }) => getPlaceDetail(draft.placeId, signal),
    enabled: draft.placeId.length > 0,
  });
  const hours = useMemo(() => parseHoursTable(place.data?.hours_table), [place.data]);
  const tz = place.data?.timezone;
  const options = useMemo(() => buildDateOptions(hours, tz), [hours, tz]);
  const days = moreDates ? options : options.slice(0, 7);
  const party = Number(draft.party) || 2;
  const slots = openSlots(draft.date, hours, tz);
  const lunch = slots.filter((slot) => !slot.afterMidnight && slot.time < DINNER_FROM);
  const dinner = [
    ...slots.filter((slot) => !slot.afterMidnight && slot.time >= DINNER_FROM),
    ...slots.filter((slot) => slot.afterMidnight),
  ];
  const groups = [
    { label: "Lunch", slots: lunch },
    { label: "Dinner", slots: dinner },
  ].filter((group) => group.slots.length > 0);
  const dirty = draft.notes.length > 0 || draft.party !== "2" || draft.date.length > 0 || draft.time.length > 0;

  useEffect(() => {
    if (profile && !draft.firstName && profile.firstName) onChange({ ...draft, firstName: profile.firstName, lastName: profile.lastName ?? "" });
  }, [profile, draft, onChange]);

  useEffect(() => {
    if (place.isPending) return;
    const date = options.some((day) => day.iso === draft.date && !day.disabled)
      ? draft.date
      : (options.find((day) => !day.disabled)?.iso ?? "");
    const time = resolveSlot(date, draft.time || null, hours, tz) ?? "";
    if (date === draft.date && time === draft.time) return;
    onChange({ ...draft, date, time });
  }, [place.isPending, options, hours, tz, draft, onChange]);

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
      const reservedAt = placeInstantIso(draft.date, draft.time, tz);
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
        windowMinutes,
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
        {days.map((day, index) => {
          const on = draft.date === day.iso;
          const top = index > 0 && day.day === 1 ? day.month : day.weekday;
          return (
            <Pressable
              key={day.iso}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: day.disabled }}
              accessibilityLabel={`${day.weekday} ${day.day} ${day.month}${day.disabled ? ", no times" : ""}`}
              disabled={day.disabled}
              onPress={() => set({ date: day.iso, time: resolveSlot(day.iso, draft.time || null, hours, tz) ?? "" })}
              style={[styles.day, on && styles.dayOn, day.disabled && styles.dayDead]}
            >
              <Text role="caption" tone={on ? "onInk" : "muted"}>{top}</Text>
              <Text role="strong" tone={on ? "onInk" : "ink"}>{String(day.day)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text role="label">Time</Text>
      {groups.length === 0 ? (
        <Text role="body" tone="muted">No times left on this day. Pick another date.</Text>
      ) : (
        groups.map((group) => (
          <View key={group.label} style={styles.times}>
            {groups.length > 1 ? <Text role="body" tone="muted">{group.label}</Text> : null}
            <View style={styles.pills}>
              {group.slots.map((slot) => {
                const on = draft.time === slot.time;
                return (
                  <Pressable
                    key={slot.time}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => set({ time: slot.time })}
                    style={[styles.pill, on && styles.dayOn]}
                  >
                    <Text role="label" tone={on ? "onInk" : "ink"}>{slot.time}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
      {groups.length > 0 ? <WindowPicker time={draft.time} value={windowMinutes} onChange={setWindowMinutes} /> : null}
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
      <Button label={submitLabel(busy, member, draft, party, options)} onPress={() => void send()} busy={busy} disabled={member && !draft.time} />
    </ScrollView>
  );
}

function shiftHhmm(time: string, minutes: number): string {
  const total = ((slotMinutes(time) + minutes) % 1440 + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function WindowPicker({
  time,
  value,
  onChange,
}: {
  time: string;
  value: ReserveWindow;
  onChange: (next: ReserveWindow) => void;
}) {
  const options: { value: ReserveWindow; label: string }[] = [
    { value: 0, label: "Exact" },
    { value: 30, label: "± 30 min" },
    { value: 60, label: "± 1 hour" },
  ];
  const range = !time ? null : value === 0 ? time : `${shiftHhmm(time, -value)}–${shiftHhmm(time, value)}`;
  return (
    <View style={styles.window}>
      <Text role="body">How flexible?</Text>
      <View style={styles.notify}>
        {options.map((option) => {
          const on = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(option.value)}
              style={[styles.notifyChoice, on && styles.dayOn]}
            >
              <Text role="label" tone={on ? "onInk" : "ink"}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {range ? (
        <Text role="body" tone="muted">
          {value === 0 ? `We ask for ${range} only.` : `We try for ${time} first. If it's taken, we book ${range} without asking.`}
        </Text>
      ) : null}
    </View>
  );
}

function submitLabel(
  busy: boolean,
  member: boolean,
  draft: Draft,
  party: number,
  options: { iso: string; weekday: string }[],
): string {
  if (busy) return "Requesting…";
  if (!member) return "Sign in to reserve";
  if (!draft.time) return "No times left";
  if (!draft.firstName.trim() || !draft.lastName.trim()) return "Add the name the table is under";
  const day = options.find((option) => option.iso === draft.date);
  const noun = party === 1 ? "person" : "people";
  return `Reserve · ${day?.weekday ?? ""} ${draft.time} · ${party} ${noun}`;
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
  dayDead: { opacity: 0.4 },
  times: { gap: 6 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    width: "22%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.paper,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  step: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.paper,
  },
  window: { gap: 6, marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderColor: colors.border },
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
