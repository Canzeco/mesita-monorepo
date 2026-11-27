import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { space } from "@/theme";

import { listCards } from "../hub";

export function CardScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const query = useQuery({ queryKey: ["cards"], queryFn: ({ signal }) => listCards(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {query.data.testMode ? <Text role="small" tone="muted">Test mode. No real money is moving.</Text> : null}
      {query.data.cards.length === 0 ? <Text role="body">No card saved</Text> : null}
      {query.data.cards.map((card) => (
        <Pressable key={card.id} accessibilityRole="button" onPress={() => onOpen(card.id)}>
          <Text role="body">{`${card.brand} ···· ${card.last4}${card.exp ? ` · ${card.exp}` : ""}`}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 }, page: { padding: space.lg, gap: space.md } });
