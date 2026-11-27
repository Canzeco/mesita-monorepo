import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { space } from "@/theme";

import { getPlan } from "../hub";

/** Status only. Subscribing stays on the web: the iOS binary has no checkout. */
export function PlanScreen() {
  const query = useQuery({ queryKey: ["plan"], queryFn: ({ signal }) => getPlan(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const plan = query.data;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text role="title">{plan.name}</Text>
      <Text role="body">{`${plan.used} of ${plan.cap} reservations this month`}</Text>
      {plan.name === "Free" && plan.price ? <Text role="small" tone="muted">{`Pro is ${plan.price} a month on the web.`}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 }, page: { padding: space.lg, gap: space.md } });
