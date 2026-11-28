import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { colors, radius, space } from "@/theme";

import { listPlaceActivity, type PlaceActivity } from "../api";

const BLOCKED = {
  private: "Your profile is private. Make it public to see what other guests view and like.",
  minor: "Social is for guests over 18. Your profile is always private.",
  no_birth_year: "Add your year of birth. Then you can see what other guests view and like.",
} as const;

const VERB = { saved: "liked", viewed: "viewed" } as const;

function ago(iso: string, now: number): string {
  const mins = Math.floor(Math.max(0, now - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(mins) || mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/** Who viewed and liked this place. The links live on Contact. */
export function Social({ placeId }: { placeId: string }) {
  const [now] = useState(() => Date.now());
  const query = useInfiniteQuery({
    queryKey: ["place-activity", placeId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => listPlaceActivity(placeId, pageParam, signal),
    getNextPageParam: (last) => last.next ?? undefined,
  });
  if (query.isPending) return <ActivitySkeleton />;
  if (query.isError) {
    return (
      <View style={styles.card}>
        <Text role="body" tone="muted" style={styles.center}>{"Couldn't load this place's activity."}</Text>
        <Button label="Try again" onPress={() => void query.refetch()} />
      </View>
    );
  }
  const blocked = query.data.pages[0]?.blocked;
  if (blocked) {
    return (
      <View style={styles.card}>
        <Text role="body" tone="muted" style={styles.center}>{BLOCKED[blocked]}</Text>
      </View>
    );
  }
  const items = query.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <View style={styles.card}>
        <Text role="body" tone="muted" style={styles.center}>No one has viewed or liked this place yet.</Text>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      {items.map((item, index) => (
        <View key={`${item.at}-${item.kind}-${item.name}-${index}`} style={styles.row}>
          <Text role="body">{`${item.name} ${VERB[item.kind]} this place`}</Text>
          <Text role="caption" tone="muted">{ago(item.at, now)}</Text>
        </View>
      ))}
      {query.hasNextPage ? (
        <Pressable accessibilityRole="button" disabled={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} style={styles.more}>
          <Text role="label">{query.isFetchingNextPage ? "Loading…" : "Show more"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ActivitySkeleton() {
  return (
    <View style={styles.card}>
      {[0, 1, 2].map((row) => <View key={row} style={styles.bone} />)}
    </View>
  );
}

export type { PlaceActivity };

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius["2xl"], backgroundColor: colors.paper, overflow: "hidden" },
  center: { textAlign: "center", padding: space.lg },
  row: { gap: 2, padding: space.lg, borderBottomWidth: 1, borderColor: colors.border },
  more: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  bone: { height: 56, margin: space.md, borderRadius: radius.lg, backgroundColor: colors.fill },
});
