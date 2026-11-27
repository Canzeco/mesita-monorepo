import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Linking, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import type { PlaceMoney, VoucherKey } from "@/generated/shared/place-detail";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { getPlaceDetail } from "../api";

const NAME: Record<VoucherKey, string> = {
  voucher_welcome: "Welcome",
  voucher_vip: "VIP",
  voucher_200: "Small Bonus",
  voucher_1000: "Medium Bonus",
  voucher_5000: "Big Bonus",
};

function money(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
}

function isVoucherKey(value: string): value is VoucherKey {
  return value in NAME;
}

function balanceLine(box: PlaceMoney): string | null {
  const balance = box.balance;
  if (!balance) return null;
  const currency = box.currency ?? "mxn";
  const ready = money(balance.spendable_cents, currency);
  if (balance.pending_cents <= 0) return `Balance ${ready}`;
  const at = balance.next_ready_at ? new Date(balance.next_ready_at) : null;
  const when = at && !Number.isNaN(at.getTime()) ? at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
  const pending = `+${money(balance.pending_cents, currency)} ${when ? `lands at ${when}` : "lands soon"}`;
  return `Balance ${ready}. ${pending}`;
}

/** What this place sells. Paying for one stays on the web. */
export function OffersScreen({ id, offerKey = "" }: { id: string; offerKey?: string }) {
  const router = useRouter();
  const query = useQuery({ queryKey: ["place-detail", id], queryFn: ({ signal }) => getPlaceDetail(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const place = query.data;
  const moneyBox = place?.money;
  const sell = moneyBox?.sell ?? [];
  const asked = isVoucherKey(offerKey) ? offerKey : null;
  if (offerKey && asked && moneyBox && sell.includes(asked)) {
    const line = moneyBox.catalog[asked];
    const currency = moneyBox.currency ?? "mxn";
    return (
      <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
        {moneyBox.test_mode ? <Text role="small">Test mode. No real money is moving, and the offers are fake.</Text> : null}
        {balanceLine(moneyBox) ? <Text role="strong">{balanceLine(moneyBox)}</Text> : null}
        <Text role="title">{NAME[asked]}</Text>
        {line ? (
          <View style={styles.facts}>
            <Text role="body">{`${money(line.price_cents, currency)} to pay`}</Text>
            <Text role="body">{`${money(line.credit_cents, currency)} credit`}</Text>
            {line.bonus_cents > 0 ? <Text role="caption" tone="muted">{`${money(line.bonus_cents, currency)} extra`}</Text> : null}
          </View>
        ) : (
          <Text role="body">{"This offer isn't priced yet."}</Text>
        )}
        <Button label="Buy on the web" onPress={() => void Linking.openURL(`https://mesita.ai/place/${id}/offers/${asked}`)} />
        <Button kind="secondary" label="All offers" onPress={() => router.setParams({ key: "" })} />
      </ScrollView>
    );
  }
  if (offerKey) {
    return (
      <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
        <Text role="body">{"This offer isn't here."}</Text>
        <Button kind="secondary" label="All offers" onPress={() => router.setParams({ key: "" })} />
      </ScrollView>
    );
  }
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {moneyBox?.test_mode ? <Text role="small">Test mode. No real money is moving, and the offers are fake.</Text> : null}
      {moneyBox && balanceLine(moneyBox) ? <Text role="strong">{balanceLine(moneyBox)}</Text> : null}
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
                onPress={() => router.setParams({ key })}
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
  facts: { gap: space.xs },
});
