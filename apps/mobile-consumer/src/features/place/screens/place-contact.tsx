import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Linking, ScrollView, StyleSheet } from "react-native";

import { ErrorState } from "@/components/error-state";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

import { getPlaceDetail } from "../api";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Visit website";
  }
}

/** WhatsApp, Call, Instagram, Website, then Report. */
export function PlaceContact({ id }: { id: string }) {
  const router = useRouter();
  const query = useQuery({ queryKey: ["place-detail", id], queryFn: ({ signal }) => getPlaceDetail(id, signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const place = query.data;
  if (!place) return <Text role="body">This place is gone</Text>;
  const rows = [
    place.channels.whatsapp_url ? { key: "wa", icon: "message" as const, label: "WhatsApp", sub: "Chat on WhatsApp", url: place.channels.whatsapp_url } : null,
    place.phone ? { key: "call", icon: "phone" as const, label: "Call", sub: place.phone, url: `tel:${place.phone.replace(/\s+/g, "")}` } : null,
    place.channels.instagram_url ? { key: "ig", icon: "sparkles" as const, label: "Instagram", sub: "Send a direct message", url: place.channels.instagram_url } : null,
    place.channels.website_url ? { key: "web", icon: "scroll" as const, label: "Website", sub: hostOf(place.channels.website_url), url: place.channels.website_url } : null,
  ].flatMap((row) => (row ? [row] : []));
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {rows.length ? (
        <SettingsGroup>
          {rows.map((row) => (
            <SettingsRow key={row.key} icon={row.icon} label={row.label} sub={row.sub} onPress={() => void Linking.openURL(row.url)} />
          ))}
        </SettingsGroup>
      ) : (
        <Text role="body" tone="muted">No contact details yet.</Text>
      )}
      <SettingsGroup>
        <SettingsRow icon="message" label="Report" sub="Something wrong with this place" onPress={() => router.push({ pathname: "/place/[id]/report", params: { id } })} />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
});
