import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { space } from "@/theme";

import { cancelReservation, listReservations } from "../api";

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
  const when = row.when ? new Date(row.when) : null;
  const add = () => {
    if (!when) return;
    const stamp = when.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = new Date(when.getTime() + 90 * 60 * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const title = encodeURIComponent(row.placeName || "Reservation");
    void Linking.openURL(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${stamp}/${end}`);
  };
  const cancel = async () => {
    await cancelReservation(row.id);
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };
  return (
    <ScrollView contentContainerStyle={styles.page} testID="reservation">
      <Text role="title">{row.placeName || "Reservation"}</Text>
      <Text role="body">{stateLabel(row.state, row.when, now)}</Text>
      {when ? <Text role="body">{when.toLocaleString()}</Text> : null}
      {row.party ? <Text role="body">{row.party} guests</Text> : null}
      {row.reference ? <Text role="small" tone="muted">{row.reference}</Text> : null}
      {row.notes ? <Text role="body">{row.notes}</Text> : null}
      <Button label="Add to calendar" kind="secondary" onPress={add} />
      <Button label="Reschedule" kind="secondary" onPress={onReschedule} />
      <Button
        label="Cancel reservation"
        kind="danger"
        onPress={() => Alert.alert("Cancel this reservation", undefined, [
          { text: "Keep it", style: "cancel" },
          { text: "Yes, cancel it", style: "destructive", onPress: () => void cancel() },
        ])}
      />
      <Button label="Your reservations" kind="quiet" onPress={onList} />
    </ScrollView>
  );
}

function stateLabel(state: string, when: string, now: number): string {
  const live = state === "created" || state === "booking" || state === "confirmed";
  const at = Date.parse(when);
  if (state === "passed" || (live && Number.isFinite(at) && at < now)) return "Passed";
  if (state === "confirmed") return "Confirmed";
  if (state === "cancelled") return "Cancelled";
  if (state === "declined" || state === "failed") return "Couldn't take the table";
  return state ? state[0].toUpperCase() + state.slice(1) : "Reservation";
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.sm },
});
