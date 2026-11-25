import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { space } from "@/theme";

import { blockPerson, getPerson } from "../api";

export function PersonScreen({
  event,
  onReport,
  onBlocked,
  onOpenPlace,
}: {
  event: { placeId: string; kind: string; at: string };
  onReport: () => void;
  onBlocked: () => void;
  onOpenPlace: (placeId: string) => void;
}) {
  const member = useSession().guestId !== null;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["person", event.placeId, event.kind, event.at],
    queryFn: ({ signal }) => getPerson(event, signal),
  });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  if (!query.data) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">This person is not available.</Text>
      </ScrollView>
    );
  }
  const block = async () => {
    await blockPerson(event);
    await queryClient.invalidateQueries({ queryKey: ["social"] });
    onBlocked();
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text role="title">{query.data.name}</Text>
      {query.data.history.map((item) => (
        <Text key={`${item.placeId}-${item.at}`} role="body" onPress={() => onOpenPlace(item.placeId)}>
          {item.kind === "saved" ? "Saved" : "Viewed"} {item.placeName}
        </Text>
      ))}
      {member ? <Button label="Report" kind="secondary" onPress={onReport} /> : null}
      {member ? <Button label="Block" kind="danger" onPress={() => void block()} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.md },
});
