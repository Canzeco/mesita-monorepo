import { useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Icon } from "@/components/icon";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useActiveLocation } from "@/features/discovery";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, radius, space } from "@/theme";

import { listFeed, type FeedItem } from "../api";

const BLOCKED: Record<string, { title: string; body: string; fix: string | null }> = {
  private: {
    title: "Your profile is private",
    body: "Make it public to see what other guests view and like.",
    fix: "Change privacy",
  },
  minor: { title: "Social is for guests over 18", body: "Your profile is always private.", fix: null },
  no_birth_year: {
    title: "Add your year of birth",
    body: "Then you can see what other guests view and like.",
    fix: "Open Profile",
  },
};

const SEX = { female: colors.faceFemale, male: colors.faceMale, other: colors.faceOther } as const;

function ago(iso: string): string {
  const mins = Math.floor(Math.max(0, Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(mins) || mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function km(value: number): string {
  return `${value < 10 ? value.toFixed(1) : Math.round(value).toString()} km`;
}

function Face({ item }: { item: FeedItem }) {
  return (
    <View style={styles.face}>
      {item.avatarUrl ? (
        <Image source={item.avatarUrl} style={styles.faceFill} contentFit="cover" />
      ) : item.age != null ? (
        <View style={[styles.faceFill, { backgroundColor: SEX[item.sex ?? "other"] }]}>
          <Text role="label" tone="onInk">{item.age}</Text>
        </View>
      ) : (
        <View style={[styles.faceFill, { backgroundColor: colors.fill }]} />
      )}
      {item.vip ? (
        <View style={styles.crown}>
          <Icon strokeWidth={2.25} name="star-filled" size={11} color={colors.onVip} />
        </View>
      ) : null}
    </View>
  );
}

function Row({ item, onPerson, onPlace }: { item: FeedItem; onPerson: () => void; onPlace: () => void }) {
  const verb = item.kind === "saved" ? "liked" : "viewed";
  return (
    <View style={styles.row}>
      <Pressable accessibilityLabel={`${item.name}'s profile`} onPress={onPerson} style={styles.person}>
        <Face item={item} />
        <View style={styles.sentence}>
          <Text role="small">
            <Text role="label" style={styles.link}>{item.name}</Text>
            {` ${verb} `}
            <Text role="label" style={styles.link}>{item.placeName}</Text>
          </Text>
          <View style={styles.quiet}>
            <Icon strokeWidth={2.25} name="clock" size={12} color={colors.muted} />
            <Text role="caption" tone="muted">{ago(item.at)}</Text>
            {item.distanceKm != null ? <Text role="caption" tone="muted">· {km(item.distanceKm)}</Text> : null}
          </View>
        </View>
      </Pressable>
      <Pressable accessibilityLabel={item.placeName} onPress={onPlace}>
        {item.photo ? (
          <Image source={item.photo} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={styles.thumb}>
            <Text role="label">{item.placeName.slice(0, 1)}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function FeedScreen({
  onPlaces,
  onOpen,
  onOpenPlace,
  onFix,
}: {
  /** The old Places | Social row; Home's Social chip passes none (MESITA-4758). */
  onPlaces?: () => void;
  onOpen: (item: FeedItem) => void;
  onOpenPlace: (placeId: string) => void;
  onFix: () => void;
}) {
  const location = useActiveLocation().location;
  const point = location ? { lat: location.lat, lng: location.lng } : null;
  const query = useInfiniteQuery({
    queryKey: ["social", point?.lat ?? null, point?.lng ?? null],
    queryFn: ({ pageParam, signal }) => listFeed(point, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next ?? undefined,
    enabled: location !== undefined,
  });
  const copy = useErrorCopy(query.error);
  const blocked = query.data?.pages[0]?.blocked ?? null;
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const notice = blocked ? (BLOCKED[blocked] ?? { title: "Social is not available.", body: "", fix: null }) : null;
  return (
    <View style={styles.page}>
      {onPlaces ? <Switch onPlaces={onPlaces} social /> : null}
      {location === undefined || query.isPending ? <Skeleton style={styles.fill} /> : null}
      {query.isError ? <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} /> : null}
      {notice ? (
        <View style={styles.pad}>
          <Text role="heading">{notice.title}</Text>
          {notice.body ? <Text role="body">{notice.body}</Text> : null}
          {notice.fix ? <Button label={notice.fix} kind="secondary" onPress={onFix} /> : null}
        </View>
      ) : null}
      {query.data && !blocked ? (
        <ScrollView contentContainerStyle={styles.list}>
          {items.length === 0 ? (
            <View style={styles.pad}>
              <Text role="heading">No activity yet</Text>
              <Text role="body" tone="muted">When members like or view a place, it shows up here.</Text>
            </View>
          ) : null}
          {items.map((item) => (
            <Row
              key={`${item.placeId}-${item.kind}-${item.at}-${item.name}`}
              item={item}
              onPerson={() => onOpen(item)}
              onPlace={() => onOpenPlace(item.placeId)}
            />
          ))}
          {query.hasNextPage ? (
            <Button label="More" kind="secondary" busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} />
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function Switch({ onPlaces, social }: { onPlaces: () => void; social: boolean }) {
  return (
    <View style={styles.switch}>
      <Pressable onPress={onPlaces} accessibilityRole="button" accessibilityLabel="Places">
        <Text role="label" tone={social ? "muted" : "ink"}>Places</Text>
      </Pressable>
      <Text role="label">Social</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  fill: { flex: 1 },
  pad: { padding: space.lg, gap: space.sm },
  list: { paddingBottom: space.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  person: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md },
  sentence: { flex: 1, gap: 2 },
  link: { textDecorationLine: "underline" },
  quiet: { flexDirection: "row", alignItems: "center", gap: 4 },
  face: { width: 44, height: 44 },
  faceFill: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  crown: {
    position: "absolute",
    left: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.vip,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  switch: {
    flexDirection: "row",
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
