import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { cancelReservation, listReservations } from "../api";
import { whenLine } from "../when";

export function ReservationScreen({
  id,
  onReschedule,
  onList,
}: {
  id: string;
  onReschedule: () => void;
  onList: () => void;
}) {
  const queryClient = useQueryClient();
  const [now] = useState(() => Date.now());
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["reservations"], queryFn: ({ signal }) => listReservations(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  const row = query.data.find((item) => item.id === id);
  if (!row) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">That reservation is not on this account.</Text>
      </ScrollView>
    );
  }
  const when = whenLine(row.when, row.timezone);
  const at = row.when ? new Date(row.when) : null;
  const add = () => {
    if (!at || Number.isNaN(at.getTime())) return;
    const stamp = at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = new Date(at.getTime() + 90 * 60 * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const title = encodeURIComponent(row.placeName || "Reservation");
    void Linking.openURL(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${stamp}/${end}`);
  };
  const cancel = async () => {
    setBusy(true);
    try {
      await cancelReservation(row.id);
      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setAsk(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.page} testID="reservation">
      <Text role="title">{row.placeName || "Reservation"}</Text>
      <Progress state={row.state} />
      {banner(row.state) ? <Text role="body" tone="muted">{banner(row.state)}</Text> : null}
      <Text role="body">{stateLabel(row.state, row.when, now)}</Text>
      {when ? <Text role="body">{when}</Text> : null}
      {row.party ? <Text role="body">{`Table for ${row.party}`}</Text> : null}
      {row.reference ? <Text role="small" tone="muted">{row.reference}</Text> : null}
      {row.notes ? <Text role="body">{row.notes}</Text> : null}
      <Button label="Add to calendar" kind="secondary" onPress={add} />
      {canMove(row.state, row.when, now) ? <Button label="Reschedule" kind="secondary" onPress={onReschedule} /> : null}
      {canMove(row.state, row.when, now) && !ask ? (
        <Button label="Cancel reservation" kind="danger" onPress={() => setAsk(true)} />
      ) : null}
      {ask ? (
        <View style={styles.ask}>
          <Text role="heading">Cancel this reservation?</Text>
          <Text role="body" tone="muted">{`${row.placeName || "Reservation"} · ${when}. We'll stop calling and let the place know. You can always book again.`}</Text>
          <Button label={busy ? "Cancelling…" : "Yes, cancel it"} busy={busy} disabled={busy} onPress={() => void cancel()} />
          <Button label="Keep it" kind="secondary" disabled={busy} onPress={() => setAsk(false)} />
        </View>
      ) : null}
      <Button label="Your reservations" kind="quiet" onPress={onList} />
    </ScrollView>
  );
}

function canMove(state: string, when: string, now: number): boolean {
  const live = state === "created" || state === "booking" || state === "confirmed";
  const at = Date.parse(when);
  return live && Number.isFinite(at) && at >= now;
}

function stateLabel(state: string, when: string, now: number): string {
  const live = state === "created" || state === "booking" || state === "confirmed";
  const at = Date.parse(when);
  if (state === "passed" || (live && Number.isFinite(at) && at < now)) return "Passed";
  if (state === "confirmed") return "Confirmed";
  if (state === "cancelled") return "Cancelled";
  if (state === "declined" || state === "failed") return "Not booked";
  return state ? state[0].toUpperCase() + state.slice(1) : "Reservation";
}

const FLOW = ["created", "booking", "confirmed", "passed"] as const;

function banner(state: string): string | null {
  if (state === "created") return "Mesita is about to call the place to book your table.";
  if (state === "booking") return "We're booking this for you — you'll get the answer here as soon as the place replies.";
  return null;
}

function Progress({ state }: { state: string }) {
  const index = FLOW.indexOf(state as (typeof FLOW)[number]);
  if (index < 0) return null;
  const labels = ["Created", "Booking", "Confirmed", "Passed"];
  return (
    <View accessibilityLabel="Reservation progress" style={styles.flow}>
      {FLOW.map((step, i) => (
        <View key={step} style={styles.step}>
          <View style={[styles.bar, i <= index ? styles.barOn : null]} />
          <Text role="caption" tone={i === index ? "ink" : "muted"}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.sm },
  ask: { gap: space.sm },
  flow: { flexDirection: "row", gap: 6 },
  step: { flex: 1, gap: 6 },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  barOn: { backgroundColor: colors.ink },
});
