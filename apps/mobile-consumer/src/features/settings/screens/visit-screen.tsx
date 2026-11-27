import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { getVisit } from "../visit";

function stateOf(status: string, paidAt: string | null): string {
  if (status === "paid") return paidAt ? `Paid · ${new Date(paidAt).toLocaleTimeString()}` : "Paid";
  if (status === "expired") return "Expired · nothing was paid";
  if (status === "cancelled") return "Cancelled · nothing was paid";
  if (status === "paying") return "Paying";
  if (status === "billed") return "Billed · not paid yet";
  return "Waiting for the bill";
}

/** One visit: the state, the bill, and how it was paid. */
export function VisitScreen({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["visit", id], queryFn: ({ signal }) => getVisit(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const visit = query.data;
  if (!visit) return <Text role="body">{"Couldn't load this visit"}</Text>;
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {visit.testMode ? <Text role="small">Test mode. No real money is moving, and the offers are fake.</Text> : null}
      <Text role="title">{visit.place}</Text>
      <Text role="label">{stateOf(visit.status, visit.paidAt)}</Text>
      {visit.bill ? <Text role="body">{`The bill · ${visit.bill}`}</Text> : null}
      <Text role="body">{`Credits · ${visit.credit}`}</Text>
      <Text role="body">{`Cash or card · ${visit.cash}`}</Text>
      <Text role="body">{`Tip · ${visit.tip}`}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
});
