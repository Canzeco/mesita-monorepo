import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useActiveLocation } from "@/features/discovery";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { listFeed, type FeedItem } from "../api";

const BLOCKED: Record<string, string> = {
  private: "Your profile is private. Make it public to see what other guests view and like.",
  minor: "Social is for guests over 18.",
  no_birth_year: "Add your year of birth. Then you can see what other guests view and like.",
};

export function FeedScreen({
  onPlaces,
  onOpen,
}: {
  onPlaces: () => void;
  onOpen: (item: FeedItem) => void;
}) {
  const location = useActiveLocation().location;
  const point = location ? { lat: location.lat, lng: location.lng } : null;
  const query = useQuery({
    queryKey: ["social", point?.lat ?? null, point?.lng ?? null],
    queryFn: ({ signal }) => listFeed(point, undefined, signal),
    enabled: location !== undefined,
  });
  const copy = useErrorCopy(query.error);
  return (
    <View style={styles.page}>
      <Switch onPlaces={onPlaces} social />
      {location === undefined || query.isPending ? <Skeleton style={styles.fill} /> : null}
      {query.isError ? <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} /> : null}
      {query.data?.blocked ? (
        <Text role="body" style={styles.pad}>{BLOCKED[query.data.blocked] ?? "Social is not available."}</Text>
      ) : null}
      {query.data && !query.data.blocked ? (
        <ScrollView contentContainerStyle={styles.list}>
          {query.data.items.length === 0 ? <Text role="body">Nothing nearby</Text> : null}
          {query.data.items.map((item) => (
            <Pressable key={`${item.placeId}-${item.kind}-${item.at}`} onPress={() => onOpen(item)} style={styles.row}>
              <Text role="label">{item.name}</Text>
              <Text role="small" tone="muted">
                {item.kind === "saved" ? "saved" : "viewed"} {item.placeName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function Switch({ onPlaces, social }: { onPlaces: () => void; social: boolean }) {
  return (
    <View style={styles.switch}>
      <Pressable onPress={onPlaces}>
        <Text role="label" tone={social ? "muted" : "ink"}>Places</Text>
      </Pressable>
      <Text role="label">Social</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  fill: { flex: 1 },
  pad: { padding: space.lg },
  list: { padding: space.lg, gap: space.md },
  row: { gap: 2, paddingVertical: space.sm },
  switch: {
    flexDirection: "row",
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.paper,
  },
});
