import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { getGift, giftMoney, giftOutcome, giftSentence, giftState, type Gift } from "../gift";

const STEPS = ["Send", "Receive", "Receipt"] as const;

function when(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text role="caption" tone="muted">{label}</Text>
      <Text role="label">{value}</Text>
    </View>
  );
}

function Body({ gift, step }: { gift: Gift; step: number }) {
  const amount = giftMoney(gift.amountCents, gift.currency);
  const from = gift.sender.you ? "You" : gift.sender.name || "Someone";
  const to = gift.recipient ? (gift.recipient.you ? "You" : gift.recipient.name || "A friend") : "Nobody";
  return (
    <View style={styles.body}>
      <Text role="title">{giftSentence(gift)}</Text>
      <Text role="label">{giftState(gift)}</Text>
      <Text role="small" tone="muted">{gift.place}</Text>
      {step === 0 ? (
        <View style={styles.panel}>
          <Text role="strong">Sent</Text>
          <Line label="From" value={from} />
          <Line label="When" value={when(gift.createdAt)} />
          <Line label="Amount" value={amount} />
        </View>
      ) : null}
      {step === 1 ? (
        <View style={styles.panel}>
          <Text role="strong">Received</Text>
          {gift.status === "open" ? <Line label="Status" value="Waiting for a friend" /> : null}
          {gift.status === "taken_back" ? (
            <>
              <Line label="Status" value="Nobody took it" />
              {gift.takenBackAt ? <Line label="Taken back" value={when(gift.takenBackAt)} /> : null}
            </>
          ) : null}
          {gift.status !== "open" && gift.status !== "taken_back" ? (
            <>
              <Line label="Taken by" value={to} />
              {gift.claimedAt ? <Line label="When" value={when(gift.claimedAt)} /> : null}
            </>
          ) : null}
        </View>
      ) : null}
      {step === 2 ? (
        <>
          <Text role="strong">{giftOutcome(gift)}</Text>
          <View style={styles.panel}>
            <Text role="strong">Details</Text>
            <Line label="From" value={from} />
            <Line label="To" value={to} />
            <Line label="Amount" value={amount} />
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Send, Receive, and Receipt. Taking a gift back stays on the web. */
export function GiftScreen({ id }: { id: string }) {
  const [step, setStep] = useState(0);
  const query = useQuery({ queryKey: ["gift", id], queryFn: ({ signal }) => getGift(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const gift = query.data;
  if (!gift) return <View style={styles.missing}><Text role="body">{"This gift isn't here."}</Text></View>;
  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.page}>
        <Body gift={gift} step={step} />
        {gift.status === "open" && gift.sender.you ? (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://mesita.ai/me/tickets/gift/${gift.id}`)}>
            <Text role="label">Take back on the web</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <View style={styles.steps}>
        {STEPS.map((label, index) => (
          <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: step === index }} onPress={() => setStep(index)} style={styles.step}>
            <Text role="caption" tone={step === index ? "ink" : "muted"}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
  body: { gap: space.sm },
  panel: { backgroundColor: colors.paper, borderRadius: 16, padding: space.md, gap: space.sm },
  line: { gap: 2 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  steps: { flexDirection: "row", backgroundColor: colors.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  step: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
