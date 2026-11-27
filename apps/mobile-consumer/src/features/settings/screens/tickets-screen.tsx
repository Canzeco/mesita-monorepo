import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { listGiftTickets, listTickets, listVoucherTickets } from "../hub";

const TABS = [
  { id: "visits", label: "Visits", empty: "No visits yet" },
  { id: "vouchers", label: "Vouchers", empty: "No vouchers yet" },
  { id: "gifts", label: "Gifts", empty: "No gifts yet" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function ticketLine(row: { place: string; status?: string; amount?: string | null; line?: string }): string {
  if (row.line) return `${row.place} · ${row.line}`;
  return `${row.place} · ${row.status ?? ""}${row.amount ? ` · ${row.amount}` : ""}`;
}

/** Visits, Vouchers, and Gifts, the web Tickets tabs. */
export function TicketsScreen({ onVisit }: { onVisit: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>("visits");
  const visits = useQuery({ queryKey: ["tickets"], queryFn: ({ signal }) => listTickets(signal) });
  const vouchers = useQuery({ queryKey: ["voucher-tickets"], queryFn: ({ signal }) => listVoucherTickets(signal) });
  const gifts = useQuery({ queryKey: ["gift-tickets"], queryFn: ({ signal }) => listGiftTickets(signal) });
  const query = tab === "visits" ? visits : tab === "vouchers" ? vouchers : gifts;
  const copy = useErrorCopy(query.error);
  const empty = TABS.find((row) => row.id === tab)?.empty ?? "";
  return (
    <View style={styles.fill}>
      <View style={styles.tabs}>
        {TABS.map((row) => (
          <Pressable key={row.id} accessibilityRole="tab" accessibilityState={{ selected: tab === row.id }} onPress={() => setTab(row.id)} style={styles.tab}>
            <Text role="label" tone={tab === row.id ? "ink" : "muted"}>{row.label}</Text>
            {tab === row.id ? <View style={styles.line} /> : null}
          </Pressable>
        ))}
      </View>
      {query.isPending ? <Skeleton style={styles.fill} /> : null}
      {query.isError ? <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && query.data.length === 0 ? (
        <ScrollView contentContainerStyle={styles.page}><Text role="body">{empty}</Text></ScrollView>
      ) : null}
      {query.isSuccess && query.data.length > 0 ? (
        <ScrollView contentContainerStyle={styles.page}>
          {query.data.map((row) =>
            tab === "visits" ? (
              <Pressable key={row.id} accessibilityRole="button" onPress={() => onVisit(row.id)}>
                <Text role="body">{ticketLine(row)}</Text>
              </Pressable>
            ) : (
              <Text key={row.id} role="body">{ticketLine(row)}</Text>
            ),
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  tabs: { flexDirection: "row", backgroundColor: colors.paper },
  tab: { flex: 1, alignItems: "center", paddingVertical: space.md, gap: space.xs },
  line: { height: 2, alignSelf: "stretch", backgroundColor: colors.ad },
  page: { padding: space.lg, gap: space.md },
});
