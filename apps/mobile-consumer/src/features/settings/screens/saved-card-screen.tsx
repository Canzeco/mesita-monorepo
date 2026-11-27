import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, ScrollView, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { EdgeError } from "@/lib/edge";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { listCards, removeCard } from "../hub";

/** One saved card. Removing it detaches it. A card a pledge uses stays. */
export function SavedCardScreen({ id, onRemoved }: { id: string; onRemoved: () => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["cards"], queryFn: ({ signal }) => listCards(signal) });
  const copy = useErrorCopy(query.error);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const card = query.data.cards.find((row) => row.id === id);
  if (!card) return <Text role="body">That card is already gone.</Text>;
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : "Card";
  const remove = () => {
    Alert.alert(`Remove ${brand} ···· ${card.last4}?`, "You can add it again any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          setSaid(null);
          void removeCard(card.id)
            .then(async () => {
              await queryClient.invalidateQueries({ queryKey: ["cards"] });
              onRemoved();
            })
            .catch((err: unknown) => {
              const code = err instanceof EdgeError ? err.code : "";
              setSaid(code === "in_use" ? "This card pays your Premier plan. Change it there first." : "Couldn't remove the card. Try again.");
              setBusy(false);
            });
        },
      },
    ]);
  };
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      <Text role="title">{`${brand} ···· ${card.last4}`}</Text>
      {card.exp ? <Text role="body">{`Expires ${card.exp}`}</Text> : null}
      <Text role="small" tone="muted">Saved on your Mesita account. Stripe keeps the card number; Mesita only sees the last four digits.</Text>
      {card.inUse ? <Text role="small">{"This card pays your Premier plan. To remove it, change the plan's card first."}</Text> : null}
      {said ? <Text role="small">{said}</Text> : null}
      {card.inUse ? null : <Button label={busy ? "Removing…" : "Remove card"} kind="danger" busy={busy} onPress={remove} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
});
