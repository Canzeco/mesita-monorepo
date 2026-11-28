import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { registerPush } from "@/lib/push";
import { report } from "@/lib/report";
import { colors, space } from "@/theme";

import { listNotices, type Notice } from "../api";
import { useMarkSeen } from "../seen";
import { shortAgo } from "../when";

function openNotice(router: ReturnType<typeof useRouter>, row: Notice) {
  const view = row.view;
  if (!view) return;
  if ("reservationId" in view) router.push({ pathname: "/reservations/[id]", params: { id: view.reservationId } });
  else void Linking.openURL(`https://mesita.ai/wallet/place/${view.placeId}`);
}

async function allowNotices(): Promise<void> {
  const Notifications = await import("expo-notifications");
  const current = await Notifications.getPermissionsAsync();
  const next = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!next.granted) return;
  const token = await Notifications.getExpoPushTokenAsync();
  await registerPush(token.data);
}

export function NoticesScreen() {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const query = useQuery({ queryKey: ["notices"], queryFn: ({ signal }) => listNotices(signal) });
  useMarkSeen(query.data);
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load notifications."
        message="Check your connection and try again."
        offline={copy.offline}
        requestId={copy.requestId}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.data.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">Nothing new yet</Text>
        <Button label="Find a place" onPress={() => router.push("/")} />
        <Button kind="secondary" label="Allow notifications" onPress={() => void allowNotices().catch((err) => report(err))} />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Button kind="secondary" label="Allow notifications" onPress={() => void allowNotices().catch((err) => report(err))} />
      {query.data.map((row) => (
        <View key={row.id} style={styles.row}>
          {row.photo ? <Image source={row.photo} style={styles.photo} contentFit="cover" /> : <View style={styles.photo} />}
          <View style={styles.words}>
            <Text role="body">{`${row.place} ${row.sentence} ${shortAgo(row.when, now)}`}</Text>
          </View>
          {row.view ? (
            <Pressable accessibilityRole="button" onPress={() => openNotice(router, row)} style={styles.view}>
              <Text role="label">View</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {query.data.length >= 40 ? <Text role="caption" tone="muted" style={styles.older}>{"Older notifications aren't shown"}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.md },
  row: { gap: space.sm, flexDirection: "row", alignItems: "center" },
  photo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.fill },
  words: { flex: 1, gap: 2 },
  view: { minHeight: 32, paddingHorizontal: space.md, borderRadius: 8, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" },
  older: { textAlign: "center", paddingVertical: space.lg },
});
