import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { blockPerson, getPerson } from "../api";
import { historyTiles } from "../history";

const SEX = { female: colors.faceFemale, male: colors.faceMale, other: colors.faceOther } as const;

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
  const [tab, setTab] = useState<"viewed" | "saved">("viewed");
  const width = useWindowDimensions().width;
  const tile = Math.floor((width - space.lg * 2 - 4) / 3);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  if (!query.data) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">{"This profile isn't available"}</Text>
      </ScrollView>
    );
  }
  const person = query.data;
  const block = () => {
    Alert.alert("Block this person?", "They disappear from your feed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: () => {
          void blockPerson(event).then(async () => {
            await queryClient.invalidateQueries({ queryKey: ["social"] });
            onBlocked();
          });
        },
      },
    ]);
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.who}>
        {person.avatarUrl ? (
          <Image source={person.avatarUrl} style={styles.face} contentFit="cover" />
        ) : person.age != null ? (
          <View style={[styles.face, { backgroundColor: SEX[person.sex ?? "other"] }]}>
            <Text role="label" tone="onInk">{person.age}</Text>
          </View>
        ) : (
          <View style={[styles.face, { backgroundColor: colors.fill }]} />
        )}
        <View style={styles.names}>
          <Text role="title">{person.name}</Text>
          {person.vip ? <Text role="small" tone="muted">VIP</Text> : null}
          {person.handle ? <Text role="small" tone="muted">@{person.handle}</Text> : null}
        </View>
      </View>
      <View style={styles.tabs}>
        {(["viewed", "saved"] as const).map((id) => (
          <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={styles.tab}>
            <Text role="label" tone={tab === id ? "ink" : "muted"}>{id === "viewed" ? "Views" : "Likes"}</Text>
            {tab === id ? <View style={styles.bar} /> : null}
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {historyTiles(person.history, tab).length === 0 ? (
          <Text role="body" tone="muted">{tab === "viewed" ? "No views yet" : "No likes yet"}</Text>
        ) : historyTiles(person.history, tab).map((item) => (
          <Pressable key={item.placeId} accessibilityRole="button" accessibilityLabel={item.placeName} onPress={() => onOpenPlace(item.placeId)} style={{ width: tile, height: tile }}>
            {item.photo ? <Image source={item.photo} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, styles.tileEmpty]} />}
            <Text role="caption" tone="onInk" numberOfLines={1} style={styles.tileName}>{item.placeName}</Text>
          </Pressable>
        ))}
      </View>
      {member ? <Button label="Report" kind="secondary" onPress={onReport} /> : null}
      {member ? <Button label="Block" kind="danger" onPress={block} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.md },
  who: { flexDirection: "row", alignItems: "center", gap: space.md },
  names: { flex: 1, gap: 2 },
  face: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tabs: { flexDirection: "row" },
  tab: { flex: 1, alignItems: "center", paddingVertical: space.sm, gap: space.xs },
  bar: { height: 2, alignSelf: "stretch", backgroundColor: colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  tileEmpty: { backgroundColor: colors.fill },
  tileName: { position: "absolute", left: 4, right: 4, bottom: 4 },
});
