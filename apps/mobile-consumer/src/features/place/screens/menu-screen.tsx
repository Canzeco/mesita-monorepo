import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { getPlaceDetail } from "../api";
import { MenuViewer } from "./menu-viewer";

/** The place's menus. An index opens that file. A missing index says so. */
export function MenuScreen({ id, index, onOpen }: { id: string; index: number | null; onOpen: (index: number) => void }) {
  const query = useQuery({ queryKey: ["place-detail", id], queryFn: ({ signal }) => getPlaceDetail(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const place = query.data;
  const menus = place?.products.menu ?? [];
  if (index !== null) {
    const menu = menus[index];
    if (!menu) {
      return (
        <View style={styles.missing}>
          <Text role="body" tone="muted">{"This menu isn't available."}</Text>
        </View>
      );
    }
    return <MenuViewer menu={menu} placeName={place?.name ?? "A Mesita place"} />;
  }
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {menus.length === 0 ? <Text role="body">No menu yet</Text> : menus.map((item, i) => (
        <Pressable key={item.url} accessibilityRole="button" onPress={() => onOpen(i)} style={styles.row}>
          <Text role="label">{item.name || "Menu"}</Text>
          {item.updated_label ? <Text role="caption" tone="muted">{item.updated_label}</Text> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
  row: { gap: space.xs, minHeight: 44, justifyContent: "center" },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
});
