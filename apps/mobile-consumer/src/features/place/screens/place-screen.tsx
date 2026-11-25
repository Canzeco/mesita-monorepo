import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, pressedOpacity, radius, space } from "@/theme";
import { computeOpenState } from "@/generated/shared/place-to-detail-helpers";
import { formatRating } from "@/generated/shared/lib/format";

import { getPlace, type Place } from "../api";

type Nav = { onMenu: () => void; onContact: () => void; onReport: () => void };

export function PlaceScreen({ id, ...nav }: Nav & { id: string }) {
  const query = useQuery({ queryKey: ["place", id], queryFn: ({ signal }) => getPlace(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  if (!query.data) {
    return (
      <View style={styles.gone}>
        <Text role="heading">This place is gone</Text>
      </View>
    );
  }
  return <PlaceView place={query.data} {...nav} />;
}

export function PlaceView({ place, onMenu, onContact, onReport }: Nav & { place: Place }) {
  const open = computeOpenState(place.hours, place.timezone ?? undefined);
  const when = open.open_now ? open.closes_at : open.opens_at;
  return (
    <ScrollView contentContainerStyle={styles.page} testID="place">
      {place.photo ? <Image source={place.photo} style={styles.photo} contentFit="cover" /> : <View style={styles.photo} />}
      <Text role="title">{place.name}</Text>
      {place.category ? <Text role="small" tone="muted">{place.category}</Text> : null}
      {place.rating ? <Text role="small">{formatRating(place.rating)}</Text> : null}
      {open.open_now !== null ? (
        <Text role="label" tone={open.open_now ? "price" : "closed"}>
          {open.open_now ? "Open" : "Closed"}
          {when ? ` · ${open.open_now ? "until" : "opens"} ${when}` : ""}
        </Text>
      ) : null}
      {place.pitch ? <Text role="body">{place.pitch}</Text> : null}
      <View style={styles.actions}>
        <Button label="Menu" onPress={onMenu} kind="secondary" />
        <Button label="Contact" onPress={onContact} kind="secondary" />
        <Button label="Report" onPress={onReport} kind="quiet" />
      </View>
    </ScrollView>
  );
}

export function Row({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, pressed && onPress && { opacity: pressedOpacity }]}>
      <Text role="body">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  gone: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  page: { padding: space.lg, gap: space.sm },
  photo: { height: 220, borderRadius: radius.card, backgroundColor: colors.fill },
  actions: { gap: space.sm, marginTop: space.md },
  row: {
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
});
