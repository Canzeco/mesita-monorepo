import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { getReceipt } from "../api";

function when(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

/** A paid bill's proof. */
export function ReceiptScreen({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["receipt", id], queryFn: ({ signal }) => getReceipt(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const proof = query.data;
  const line = proof.refunded
    ? `Refunded ${proof.refunded}`
    : proof.seenAt
      ? `Seen · ${when(proof.seenAt)}`
      : proof.paidAt
        ? `Paid · ${when(proof.paidAt)}`
        : proof.status;
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {proof.testMode ? <Text role="small">Test mode. No real money is moving, and the offers are fake.</Text> : null}
      <Text role="title">{proof.place}</Text>
      <Text role="label">{line}</Text>
      <Text role="body">{`Amount · ${proof.amount}`}</Text>
      <Text role="body">{`Credits · ${proof.credit}`}</Text>
      <Text role="body">{`Tip · ${proof.tip}`}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
});
