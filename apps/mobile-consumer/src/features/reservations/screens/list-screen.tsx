import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { space } from "@/theme";

import { listReservations, type Reservation } from "../api";

export function ReservationsScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const query = useQuery({ queryKey: ["reservations"], queryFn: ({ signal }) => listReservations(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">No reservations yet</Text>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {query.data.map((row) => (
        <Pressable key={row.id} onPress={() => onOpen(row.id)} style={styles.row}>
          <Text role="label">{row.placeName || "Place"}</Text>
          <Text role="small" tone="muted">{lineOf(row)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function lineOf(row: Reservation): string {
  const when = row.when ? new Date(row.when).toLocaleString() : "";
  return [row.state, when, row.party ? `${row.party} guests` : ""].filter(Boolean).join(" · ");
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.md },
  row: { gap: space.xs, paddingVertical: space.sm },
});
