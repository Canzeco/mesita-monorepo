import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, radius, space } from "@/theme";

import { blockPerson, getPerson } from "../api";

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
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  if (!query.data) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">This person is not available.</Text>
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
      {person.history.map((item) => (
        <Pressable key={`${item.placeId}-${item.kind}-${item.at}`} onPress={() => onOpenPlace(item.placeId)} style={styles.row}>
          <Text role="body">
            {item.kind === "saved" ? "Liked" : "Viewed"} {item.placeName}
          </Text>
        </Pressable>
      ))}
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
  row: {
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderRadius: radius.control,
  },
});
