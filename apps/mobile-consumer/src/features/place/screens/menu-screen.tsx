import { Linking, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { space } from "@/theme";

import { getPlace } from "../api";
import { Row } from "./place-screen";

export function MenuScreen({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["place", id], queryFn: ({ signal }) => getPlace(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  const place = query.data;
  const url = place?.menuUrl || place?.website;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {url ? <Row label="Open the menu" onPress={() => void Linking.openURL(url)} /> : <Text role="body">No menu yet</Text>}
    </ScrollView>
  );
}

export function ContactScreen({ id }: { id: string }) {
  const query = useQuery({ queryKey: ["place", id], queryFn: ({ signal }) => getPlace(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} onRetry={() => void query.refetch()} />;
  const place = query.data;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {place?.phone ? <Row label={place.phone} onPress={() => void Linking.openURL(`tel:${place.phone}`)} /> : null}
      {place?.address ? <Text role="body">{place.address}</Text> : null}
      {!place?.phone && !place?.address ? <Text role="body">No contact yet</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: space.lg, gap: space.md },
});
