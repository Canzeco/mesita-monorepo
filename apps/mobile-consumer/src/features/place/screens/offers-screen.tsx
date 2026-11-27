import { useQuery } from "@tanstack/react-query";
import { Linking, ScrollView, StyleSheet } from "react-native";

import { ErrorState } from "@/components/error-state";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import type { VoucherKey } from "@/generated/shared/place-detail";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { getPlaceDetail } from "../api";

const NAME: Record<VoucherKey, string> = {
  voucher_welcome: "Welcome",
  voucher_200: "$200",
  voucher_1000: "$1,000",
  voucher_5000: "$5,000",
  voucher_vip: "VIP",
};

function money(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
}

/** What this place sells. Paying for one stays on the web. */
export function OffersScreen({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["place-detail", id], queryFn: ({ signal }) => getPlaceDetail(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const place = query.data;
  const moneyBox = place?.money;
  const sell = moneyBox?.sell ?? [];
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {moneyBox?.test_mode ? <Text role="small">Test mode. No real money is moving, and the offers are fake.</Text> : null}
      {sell.length === 0 ? <Text role="body">No offers right now</Text> : (
        <SettingsGroup>
          {sell.map((key) => {
            const line = moneyBox?.catalog[key];
            const sub = line ? `${money(line.price_cents, moneyBox?.currency ?? "mxn")} · ${money(line.credit_cents, moneyBox?.currency ?? "mxn")} credit` : "On the web";
            return (
              <SettingsRow
                key={key}
                icon="coins"
                label={NAME[key]}
                sub={sub}
                onPress={() => void Linking.openURL(`https://mesita.ai/place/${id}/offers/${key}`)}
              />
            );
          })}
        </SettingsGroup>
      )}
      <Text role="caption" tone="muted">Buying an offer happens on the web.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
});
