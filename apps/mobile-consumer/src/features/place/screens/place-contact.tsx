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

function externalOk(key: "opentable_url" | "uber_eats_url", url: string): boolean {
  try {
    const parsed = new URL(url);
    if (key === "uber_eats_url") return parsed.hostname.includes("ubereats.com") && parsed.pathname.includes("/store/");
    return parsed.hostname.includes("opentable.") && parsed.pathname.startsWith("/r/");
  } catch {
    return false;
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
  const openTable = place.reservations.opentable_url;
  const uberEats = place.reservations.uber_eats_url;
  const rows = [
    place.phone ? { key: "phone", icon: "phone" as const, label: "Phone", sub: place.phone, url: `tel:${place.phone.replace(/\s+/g, "")}` } : null,
    place.channels.website_url ? { key: "web", icon: "scroll" as const, label: "Website", sub: hostOf(place.channels.website_url), url: place.channels.website_url } : null,
    place.channels.whatsapp_url ? { key: "wa", icon: "message" as const, label: "WhatsApp", sub: null, url: place.channels.whatsapp_url } : null,
    place.channels.instagram_url ? { key: "ig", icon: "sparkles" as const, label: "Instagram", sub: null, url: place.channels.instagram_url } : null,
    place.channels.facebook_url ? { key: "fb", icon: "user" as const, label: "Facebook", sub: null, url: place.channels.facebook_url } : null,
    openTable && externalOk("opentable_url", openTable) ? { key: "ot", icon: "calendar" as const, label: "OpenTable", sub: null, url: openTable } : null,
    uberEats && externalOk("uber_eats_url", uberEats) ? { key: "eats", icon: "navigation" as const, label: "Uber Eats", sub: null, url: uberEats } : null,
    place.reviews_maps.google_maps_url ? { key: "maps", icon: "compass" as const, label: "Google Maps", sub: null, url: place.reviews_maps.google_maps_url } : null,
  ].flatMap((row) => (row ? [row] : []));
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      {rows.length ? (
        <SettingsGroup>
          {rows.map((row) => (
            <SettingsRow key={row.key} icon={row.icon} label={row.label} sub={row.sub ?? undefined} onPress={() => void Linking.openURL(row.url)} />
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
