import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, radius, space } from "@/theme";

import { getCredit, type Credit } from "../credit";
import { readyIn } from "../gift";

function Line({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <View style={styles.line}>
      <View style={styles.words}>
        <Text role="small">{label}</Text>
        {sub ? <Text role="caption" tone="muted">{sub}</Text> : null}
      </View>
      {value ? <Text role="label">{value}</Text> : null}
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

function RefundBody({ credit }: { credit: Credit }) {
  const card = credit.refundCard;
  if (!card) return null;
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {credit.testMode ? <Text role="small">Test mode. No real money is moving, and the offers are fake.</Text> : null}
      <Text role="title">{credit.headline}</Text>
      <Text role="label">{credit.state}</Text>
      <Text role="body">{credit.place}</Text>
      <Text role="caption" tone="muted">{credit.when}</Text>
      {credit.note ? <Text role="small" tone="muted">{credit.note}</Text> : null}
      <Panel title="Timeline">
        {card.bought ? <Line label="Bought" value={card.bought.value} sub={card.bought.when} /> : null}
        <Line label="Refunded" value={card.amount} sub={card.refundedOn} />
      </Panel>
      <Panel title="Refund">
        <Line label="Refunded amount" value={card.amount} />
        {card.taken ? <Line label="Credit taken back" value={card.taken} /> : null}
        <Line label="Refunded on" value={card.refundedOn} />
        {card.original ? <Line label="Original purchase" value={card.original.value} sub={card.original.when} /> : null}
        <Line label="Purchase number" value={card.purchase} />
      </Panel>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://mesita.ai/wallet/place/${credit.placeId}`)}>
        <Text role="button">Open the Loyalty Card</Text>
      </Pressable>
    </ScrollView>
  );
}

function Body({ credit, now }: { credit: Credit; now: number }) {
  const router = useRouter();
  if (credit.refundCard) return <RefundBody credit={credit} />;
  const step = credit.bonusStep;
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {credit.testMode ? <Text role="small">Test mode. No real money is moving, and the offers are fake.</Text> : null}
      <Text role="title">{credit.headline}</Text>
      <Text role="label">{credit.state}</Text>
      <Text role="body">{credit.place}</Text>
      <Text role="caption" tone="muted">{credit.when}</Text>
      {credit.note ? <Text role="small" tone="muted">{credit.note}</Text> : null}
      {step ? (
        <Panel title="Bonus">
          <Line label="Pay" value={step.pay} />
          <Line label="Wait 3 hours" value={step.waiting ? "Now" : "Done"} sub={step.ready && Date.parse(step.ready) > now ? `in ${readyIn(step.ready, now)}` : null} />
          <Line label="Get Bonus" value={step.bonus} />
        </Panel>
      ) : null}
      {credit.bought ? (
        <Panel title="Your credit">
          <Line label="Bought" value={credit.bought} />
          {credit.bonus ? <Line label="Bonus" value={credit.bonus} /> : null}
          {credit.totalCredit ? <Line label="Total credit" value={credit.totalCredit} /> : null}
        </Panel>
      ) : null}
      {credit.type ? (
        <Panel title="Details">
          <Line label="Type" value={credit.type} />
        </Panel>
      ) : null}
      {credit.refund ? (
        <Panel title="Refund">
          <Line label="Refund ticket" value={credit.refund} sub={credit.refundWhen} />
        </Panel>
      ) : null}
      <Panel title={`At ${credit.place}`}>
        <Line label="Available" value={credit.available} />
        {credit.pending ? <Line label="Pending" value={credit.pending} /> : null}
        <Line label="You can spend now" value={credit.spendable} />
      </Panel>
      {credit.purchase ? (
        <Panel title="Purchase">
          <Line label="Purchase number" value={credit.purchase} />
        </Panel>
      ) : null}
      {credit.canPay ? (
        <Pressable accessibilityRole="button" onPress={() => router.push("/pay/code")} style={styles.action}>
          <Text role="label" tone="onInk">Pay Bill</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://mesita.ai/wallet/place/${credit.placeId}`)}>
        <Text role="label">Open the Loyalty Card</Text>
      </Pressable>
      {credit.canGift ? (
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://mesita.ai/wallet/place/${credit.placeId}/send`)}>
          <Text role="label" tone="muted">Gift credit</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

/** One credit ticket. Buying and sending stay on the web. */
export function CreditScreen({ placeId, entryKey }: { placeId: string; entryKey: string }) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ["credit", placeId, entryKey],
    queryFn: ({ signal }) => getCredit(placeId, entryKey, signal),
    enabled: placeId.length > 0 && entryKey.length > 0,
  });
  const copy = useErrorCopy(query.error);
  if (!placeId || !entryKey) {
    return (
      <View style={styles.missing}>
        <Text role="title">{"This credit isn't here any more"}</Text>
        <Text role="small" tone="muted">It may have moved since the list loaded.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push("/me/tickets")}>
          <Text role="label">Back to Tickets</Text>
        </Pressable>
      </View>
    );
  }
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) {
    return <ErrorState title="Couldn't load this credit" message="Check your connection and try again." offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  }
  if (!query.data) {
    return (
      <View style={styles.missing}>
        <Text role="title">{"This credit isn't here any more"}</Text>
        <Text role="small" tone="muted">It may have moved since the list loaded.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push("/me/tickets")}>
          <Text role="label">Back to Tickets</Text>
        </Pressable>
      </View>
    );
  }
  return <Body credit={query.data} now={now} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
  panel: { backgroundColor: colors.paper, borderRadius: radius.card, padding: space.md, gap: space.sm },
  line: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  words: { flex: 1, gap: 2 },
  action: { minHeight: 48, borderRadius: radius.control, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  missing: { flex: 1, backgroundColor: colors.page, padding: space.lg, gap: space.md, justifyContent: "center" },
});
