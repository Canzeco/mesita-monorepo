import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { space } from "@/theme";

import { listNotices } from "../api";

export function NoticesScreen() {
  const query = useQuery({ queryKey: ["notices"], queryFn: ({ signal }) => listNotices(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">No notifications yet</Text>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {query.data.map((row) => (
        <Text key={row.id} role="body">{row.kind.split("_").join(" ")}</Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.md },
});
