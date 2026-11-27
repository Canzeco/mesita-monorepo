import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { space } from "@/theme";

import { listTickets } from "../hub";

export function TicketsScreen() {
  const query = useQuery({ queryKey: ["tickets"], queryFn: ({ signal }) => listTickets(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">No tickets yet</Text>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {query.data.map((row) => (
        <Text key={row.id} role="body">{`${row.place} · ${row.status}${row.amount ? ` · ${row.amount}` : ""}`}</Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 }, page: { padding: space.lg, gap: space.md } });
