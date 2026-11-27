import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { listRefunds } from "../hub";

/** Money the wallet says was returned. */
export function RefundsScreen() {
  const query = useQuery({ queryKey: ["refunds"], queryFn: ({ signal }) => listRefunds(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState title={"Couldn't load your refunds"} message="Check your connection and try again." offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
        <Text role="body">No refunds</Text>
      </ScrollView>
    );
  }
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {query.data.map((row) => {
        const date = new Date(row.when);
        const when = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        return <Text key={row.id} role="body">{[row.place, row.amount, when].filter(Boolean).join(" · ")}</Text>;
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.page }, page: { padding: space.lg, gap: space.md } });
