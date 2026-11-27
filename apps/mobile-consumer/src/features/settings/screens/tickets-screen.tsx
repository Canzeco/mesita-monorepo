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
  { id: "visits", label: "Visits", empty: "No visits yet", action: "Pay" },
  { id: "vouchers", label: "Vouchers", empty: "No vouchers yet", action: "Find a place" },
  { id: "gifts", label: "Gifts", empty: "No gifts yet", action: "Send Gift" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function ticketLine(row: { place: string; status?: string; amount?: string | null; line?: string }): string {
  if (row.line) return `${row.place} · ${row.line}`;
  return `${row.place} · ${row.status ?? ""}${row.amount ? ` · ${row.amount}` : ""}`;
}

/** Visits, Vouchers, and Gifts, the web Tickets tabs. */
export function TicketsScreen({
  onVisit,
  onGift,
  onVoucher,
  onEmpty,
}: {
  onVisit: (id: string) => void;
  onGift: (id: string) => void;
  onVoucher: (place: string, line: string) => void;
  onEmpty: (tab: Tab) => void;
}) {
  const [tab, setTab] = useState<Tab>("visits");
  const visits = useQuery({ queryKey: ["tickets"], queryFn: ({ signal }) => listTickets(signal) });
  const vouchers = useQuery({ queryKey: ["voucher-tickets"], queryFn: ({ signal }) => listVoucherTickets(signal) });
  const gifts = useQuery({ queryKey: ["gift-tickets"], queryFn: ({ signal }) => listGiftTickets(signal) });
  const query = tab === "visits" ? visits : tab === "vouchers" ? vouchers : gifts;
  const copy = useErrorCopy(query.error);
  const emptyTab = TABS.find((row) => row.id === tab);
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
        <ScrollView contentContainerStyle={styles.page}>
          <Text role="body">{emptyTab?.empty}</Text>
          {emptyTab ? (
            <Pressable accessibilityRole="button" onPress={() => onEmpty(tab)}>
              <Text role="label">{emptyTab.action}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}
      {query.isSuccess && query.data.length > 0 ? (
        <ScrollView contentContainerStyle={styles.page}>
          {query.data.map((row) =>
            tab === "visits" ? (
              <Pressable key={row.id} accessibilityRole="button" onPress={() => onVisit(row.id)}>
                <Text role="body">{ticketLine(row)}</Text>
              </Pressable>
            ) : tab === "gifts" ? (
              <Pressable key={row.id} accessibilityRole="button" onPress={() => onGift(row.id)}>
                <Text role="body">{ticketLine(row)}</Text>
              </Pressable>
            ) : (
              <Pressable key={row.id} accessibilityRole="button" onPress={() => onVoucher(row.place, "line" in row ? row.line : "")}>
                <Text role="body">{ticketLine(row)}</Text>
              </Pressable>
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
