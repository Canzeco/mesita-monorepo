import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, radius, space } from "@/theme";

import { getPlan, type Plan } from "../hub";

function usedLine(used: number, cap: number): string {
  return used > cap ? `${used} reservations used · limit ${cap}` : `${used} of ${cap} reservations used`;
}

/** Status only. Subscribing stays on the web: the iOS binary has no checkout. */
export function PlanScreen() {
  const query = useQuery({ queryKey: ["plan"], queryFn: ({ signal }) => getPlan(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState title="Couldn't load your plan." message="Try again." offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const plan = query.data;
  const full = plan.cap > 0 && plan.used >= plan.cap;
  const ratio = plan.cap > 0 ? Math.min(plan.used / plan.cap, 1) : full ? 1 : 0;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card} accessibilityLabel="This month">
        <View style={styles.row}>
          <Text role="label">{usedLine(plan.used, plan.cap)}</Text>
          {full ? <Text role="caption" tone="danger">Limit reached</Text> : null}
        </View>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: plan.cap, now: Math.min(plan.used, plan.cap) }}>
          <View style={[styles.fillBar, { width: `${ratio * 100}%` }, full && styles.fillFull]} />
        </View>
      </View>
      <PlanRow title="Free" perk="10 reservations per month" price="$0" current={plan.name === "Free"} />
      <PlanRow title="Pro" perk="30 reservations per month" soon="Better prepay rates" price={plan.price ? `${plan.price} USD a month` : "$3 USD a month"} current={plan.name === "Pro"} />
      {plan.name === "Free" ? <Text role="caption" tone="muted">Pro is on the web.</Text> : null}
    </ScrollView>
  );
}

function PlanRow({ title, perk, soon, price, current }: { title: string; perk: string; soon?: string; price: string; current: boolean }) {
  return (
    <View style={styles.card} accessibilityLabel={title}>
      <View style={styles.row}>
        <View style={styles.words}>
          <Text role="heading">{current ? `${title} · Current` : title}</Text>
          <Text role="small" tone="muted">{perk}</Text>
          {soon ? <Text role="caption" tone="muted">{`${soon} · Soon`}</Text> : null}
        </View>
        <Text role="label">{price}</Text>
      </View>
    </View>
  );
}

export type { Plan };

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.md },
  card: { padding: space.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.paper, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  words: { flex: 1, gap: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.fill, overflow: "hidden" },
  fillBar: { height: 6, backgroundColor: colors.ink },
  fillFull: { backgroundColor: colors.danger },
});
