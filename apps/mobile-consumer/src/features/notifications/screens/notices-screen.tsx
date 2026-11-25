import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { registerPush } from "@/lib/push";
import { report } from "@/lib/report";
import { space } from "@/theme";

import { listNotices } from "../api";

async function allowNotices(): Promise<void> {
  const Notifications = await import("expo-notifications");
  const current = await Notifications.getPermissionsAsync();
  const next = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!next.granted) return;
  const token = await Notifications.getExpoPushTokenAsync();
  await registerPush(token.data);
}

export function NoticesScreen() {
  const query = useQuery({ queryKey: ["notices"], queryFn: ({ signal }) => listNotices(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text role="body">No notifications yet</Text>
        <Button kind="secondary" label="Allow notifications" onPress={() => void allowNotices().catch((err) => report(err))} />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Button kind="secondary" label="Allow notifications" onPress={() => void allowNotices().catch((err) => report(err))} />
      {query.data.map((row) => (
        <Text key={row.id} role="body">{row.kind.split("_").join(" ")}</Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.md },
});
