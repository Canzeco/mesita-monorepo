import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet } from "react-native";

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
  if (!card) return <Text role="body">That card is not on this account.</Text>;
  const remove = () => {
    setBusy(true);
    setSaid(null);
    void removeCard(card.id)
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ["cards"] });
        onRemoved();
      })
      .catch((err: unknown) => {
        const code = err instanceof EdgeError ? err.code : "";
        setSaid(code === "in_use" ? "This card pays for Pro. It stays until that ends." : "Couldn't remove that card. Try again.");
        setBusy(false);
      });
  };
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      <Text role="title">{`${card.brand} ···· ${card.last4}`}</Text>
      {card.exp ? <Text role="body">{`Expires ${card.exp}`}</Text> : null}
      {said ? <Text role="small">{said}</Text> : null}
      <Button label="Remove card" kind="danger" busy={busy} onPress={remove} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
});
