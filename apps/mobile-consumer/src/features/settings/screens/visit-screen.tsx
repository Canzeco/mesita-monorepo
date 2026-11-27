import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, radius, space } from "@/theme";

import { getVisit, type Visit } from "../visit";

function when(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function stateOf(visit: Visit): string {
  if (visit.status === "paid") {
    if (visit.guestTyped && !visit.verified) return "Paid · waiting for the waiter's signature";
    return visit.paidAt ? `Paid · ${new Date(visit.paidAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Paid";
  }
  if (visit.status === "expired") return "Expired · nothing was paid";
  if (visit.status === "cancelled") return "Cancelled · nothing was paid";
  if (visit.status === "paying") return "Paying";
  if (visit.status === "billed") return "Billed · not paid yet";
  return "Waiting for the bill";
}

function Line({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <View style={styles.line}>
      <View style={styles.words}>
        <Text role="small">{label}</Text>
        {sub ? <Text role="caption" tone="muted">{sub}</Text> : null}
      </View>
      <Text role="label">{value}</Text>
    </View>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text role="strong">{title}</Text>
      {children}
    </View>
  );
}

/** One visit: the receipt, how it was paid, and the details. */
export function VisitScreen({ id }: { id: string }) {
  const router = useRouter();
  const query = useQuery({ queryKey: ["visit", id], queryFn: ({ signal }) => getVisit(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const visit = query.data;
  if (!visit) return <Text role="body">{"Couldn't load this visit"}</Text>;
  const paid = visit.status === "paid";
  const open = visit.status === "open" || visit.status === "billed" || visit.status === "paying";
  const unpaid = !paid && !open;
  const showReceipt = visit.bill != null || !unpaid;
  const typedBy = visit.waiter ?? (visit.guestTyped ? null : "The waiter");
  const tipValue = visit.tipCents > 0 ? visit.tip : "No tip";
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {visit.testMode ? <Text role="small">Test mode. No real money is moving, and the offers are fake.</Text> : null}
      <Text role="title">{visit.billCents == null && visit.tipCents === 0 && visit.creditCents === 0 ? "No bill" : visit.total}</Text>
      <Text role="label">{stateOf(visit)}</Text>
      <Text role="body">{visit.place}</Text>
      <Text role="caption" tone="muted">{when(visit.paidAt ?? visit.openedAt ?? visit.billedAt)}</Text>
      {showReceipt ? null : <Text role="small" tone="muted">Nothing was charged.</Text>}
      {showReceipt && visit.bill ? (
        <Panel title={unpaid ? "The bill" : "Receipt"}>
          <Line label="Bill" value={visit.bill} />
          {visit.discount ? <Line label="Discount" value={`−${visit.discount}`} /> : null}
          <Line label="Tip" value={tipValue} sub={visit.suggestedTip ? `The waiter suggested ${visit.suggestedTip}` : null} />
          <Line label="Total" value={visit.total} />
        </Panel>
      ) : null}
      {showReceipt && !unpaid ? (
        <Panel title="Paid with">
          {visit.creditCents > 0 ? <Line label="Credits" value={visit.credit} sub={`Your credit at ${visit.place} · bill only`} /> : null}
          {visit.cardCents > 0 ? <Line label="Card" value={visit.card} /> : null}
          {visit.cashCents > 0 ? <Line label="Cash or card" value={visit.cash} sub="Paid to the waiter" /> : null}
          {visit.creditCents === 0 && visit.cardCents === 0 && visit.cashCents === 0 ? <Line label="No payment method chosen yet" value="" /> : null}
        </Panel>
      ) : null}
      <Panel title="Details">
        {visit.bill && typedBy ? <Line label="Bill typed by" value={typedBy} /> : null}
        {visit.waiter ? <Line label="Waiter" value={visit.waiter} /> : null}
        {visit.ticket ? <Line label="Ticket" value={`#${visit.ticket}`} /> : null}
        <Line label="Visit number" value={visit.id.slice(0, 8).toUpperCase()} />
      </Panel>
      <Pressable accessibilityRole="button" onPress={() => router.push("/pay/code")} style={styles.action}>
        <Text role="label" tone="onInk">Pay Bill</Text>
      </Pressable>
      {visit.placeId ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/place/[id]", params: { id: visit.placeId! } })}>
          <Text role="label">Open the place</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
  panel: { backgroundColor: colors.paper, borderRadius: radius.card, padding: space.md, gap: space.sm },
  line: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  words: { flex: 1, gap: 2 },
  action: { minHeight: 48, borderRadius: radius.control, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
});
