import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { getPlaceDetail } from "@/features/place";
import { placeDateTime, placeInstantIso } from "@/generated/shared/lib/place-time";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { listReservations, updateReservation } from "../api";
import { buildDateOptions, openSlots, parseHoursTable, resolveSlot } from "../slots";

const MAX_PARTY = 10;
const DINNER_FROM = "17:00";

function movable(state: string, when: string, now: number): boolean {
  const live = state === "created" || state === "booking" || state === "confirmed";
  const at = Date.parse(when);
  return live && Number.isFinite(at) && at >= now;
}

/** Move a table. It stays until the place says yes. */
export function RescheduleScreen({ id, onDone }: { id: string; onDone: () => void }) {
  const [now] = useState(() => Date.now());
  const [picked, setPicked] = useState<{ date: string; time: string; party: string } | null>(null);
  const [moreDates, setMoreDates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["reservations"], queryFn: ({ signal }) => listReservations(signal) });
  const copy = useErrorCopy(query.error);
  const row = query.data?.find((item) => item.id === id) ?? null;
  const detail = useQuery({
    queryKey: ["place-detail", row?.placeId ?? ""],
    queryFn: ({ signal }) => getPlaceDetail(row?.placeId ?? "", signal),
    enabled: Boolean(row?.placeId),
  });
  const hours = useMemo(() => parseHoursTable(detail.data?.hours_table), [detail.data]);
  const tz = detail.data?.timezone;
  const options = useMemo(() => buildDateOptions(hours, tz), [hours, tz]);
  const days = moreDates ? options : options.slice(0, 7);
  const held = row && !(row.placeId && detail.isPending) ? placeDateTime(row.when, tz) : null;
  const seededDate = held && options.some((day) => day.iso === held.date && !day.disabled)
    ? held.date
    : (options.find((day) => !day.disabled)?.iso ?? held?.date ?? "");
  const seededTime = resolveSlot(seededDate, held?.time ?? null, hours, tz) ?? held?.time ?? "";
  const date = picked?.date ?? seededDate;
  const time = picked?.time ?? seededTime;
  const party = picked?.party ?? (row?.party ? String(row.party) : "2");
  const choose = (next: Partial<{ date: string; time: string; party: string }>) =>
    setPicked({ date, time, party, ...next });
  const slots = openSlots(date, hours, tz);
  const lunch = slots.filter((slot) => !slot.afterMidnight && slot.time < DINNER_FROM);
  const dinner = [
    ...slots.filter((slot) => !slot.afterMidnight && slot.time >= DINNER_FROM),
    ...slots.filter((slot) => slot.afterMidnight),
  ];
  const groups = [
    { label: "Lunch", slots: lunch },
    { label: "Dinner", slots: dinner },
  ].filter((group) => group.slots.length > 0);

  const send = async () => {
    const size = Number(party);
    if (!date || !time || !Number.isInteger(size)) {
      setError("Add a date, a time, and a party.");
      return;
    }
    setBusy(true);
    try {
      await updateReservation(id, placeInstantIso(date, time, tz), size);
      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      onDone();
    } catch {
      setError("Couldn't update the reservation.");
      setBusy(false);
    }
  };

  if (query.isPending || (row?.placeId && detail.isPending)) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  if (!row || !movable(row.state, row.when, now)) {
    return (
      <View style={styles.missing}>
        <Text role="body" tone="muted">{"This table can't be moved."}</Text>
      </View>
    );
  }
  const size = Number(party);
  const noun = size === 1 ? "person" : "people";
  const label = busy ? "Updating…" : !time ? "No times left" : `Ask for ${size} ${noun} at ${time}`;
  const place = row.placeName || "the place";
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text role="title">Move your table</Text>
      <Text role="small" tone="muted">{`${place} · now ${held ? `${held.date} ${held.time}` : ""}`}</Text>
      <Text role="body" tone="muted">{`Pick a new slot and Mesita calls ${place} again to confirm it. Your table isn't moved until they say yes.`}</Text>
      <View style={styles.heading}>
        <Text role="label">Date</Text>
        <Pressable accessibilityRole="button" onPress={() => setMoreDates((open) => !open)}>
          <Text role="label">{moreDates ? "Fewer dates" : "More dates"}</Text>
        </Pressable>
      </View>
      <View style={styles.days}>
        {days.map((day, index) => {
          const on = date === day.iso;
          const top = index > 0 && day.day === 1 ? day.month : day.weekday;
          return (
            <Pressable
              key={day.iso}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: day.disabled }}
              disabled={day.disabled}
              onPress={() => choose({ date: day.iso, time: resolveSlot(day.iso, time || null, hours, tz) ?? "" })}
              style={[styles.day, on && styles.on, day.disabled && styles.dead]}
            >
              <Text role="caption" tone={on ? "onInk" : "muted"}>{top}</Text>
              <Text role="strong" tone={on ? "onInk" : "ink"}>{String(day.day)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text role="label">Time</Text>
      {groups.length === 0 ? <Text role="body" tone="muted">No times left on this day. Pick another date.</Text> : groups.map((group) => (
        <View key={group.label} style={styles.times}>
          {groups.length > 1 ? <Text role="body" tone="muted">{group.label}</Text> : null}
          <View style={styles.pills}>
            {group.slots.map((slot) => {
              const on = time === slot.time;
              return (
                <Pressable key={slot.time} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => choose({ time: slot.time })} style={[styles.pill, on && styles.on]}>
                  <Text role="label" tone={on ? "onInk" : "ink"}>{slot.time}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <View style={styles.heading}>
        <Text role="label">People</Text>
        <View style={styles.stepper}>
          <Pressable accessibilityLabel="Fewer people" disabled={size <= 1} onPress={() => choose({ party: String(Math.max(1, size - 1)) })} style={styles.step}>
            <Text role="strong">−</Text>
          </Pressable>
          <Text role="strong">{String(size || party)}</Text>
          <Pressable accessibilityLabel="More people" disabled={size >= MAX_PARTY} onPress={() => choose({ party: String(Math.min(MAX_PARTY, size + 1)) })} style={styles.step}>
            <Text role="strong">+</Text>
          </Pressable>
        </View>
      </View>
      {error ? <Text role="small" tone="danger">{error}</Text> : null}
      <Button label={label} onPress={() => void send()} busy={busy} disabled={!date || !time} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  page: { padding: space.lg, gap: space.sm },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  day: { width: "13%", minHeight: 56, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.paper },
  on: { backgroundColor: colors.ink },
  dead: { opacity: 0.4 },
  times: { gap: 6 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { width: "22%", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.paper },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  step: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.paper },
});
