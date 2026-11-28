import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Icon } from "@/components/icon";
import { RemoveSaved } from "@/components/remove-saved";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, pressedStyle, radius, space } from "@/theme";
import type { PlaceDetail } from "@/generated/shared/place-detail";
import { formatCompactCount, formatDistanceKm, formatRating } from "@/generated/shared/lib/format";
import { toAmPm } from "@/generated/shared/lib/place-time";

import { getPlaceDetail } from "../api";
import { MenuTab } from "./menu-panel";
import { Overview } from "./overview";
import { Reviews } from "./reviews";
import { Social } from "./social";

type Nav = {
  onMenu: () => void;
  onOpenMenu: (index: number) => void;
  onContact: () => void;
  onReport: () => void;
  onReserve: () => void;
  onOffers: () => void;
  onBack: () => void;
  saved: boolean;
  onSave: () => void;
};

const TABS = ["Overview", "Reviews", "Social", "Menu"] as const;
type Tab = (typeof TABS)[number];

export function PlaceScreen({ id, center = null, ...nav }: Nav & { id: string; center?: { lat: number; lng: number } | null }) {
  const query = useQuery({ queryKey: ["place-detail", id], queryFn: ({ signal }) => getPlaceDetail(id, signal) });
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
  return <PlaceView place={query.data} center={center} {...nav} />;
}

export function PlaceView({ place, center = null, onMenu, onOpenMenu, onContact, onReport, onReserve, onOffers, onBack, saved, onSave }: Nav & { place: PlaceDetail; center?: { lat: number; lng: number } | null }) {
  const width = useWindowDimensions().width;
  const [tab, setTab] = useState<Tab>("Overview");
  const [photo, setPhoto] = useState(0);
  const [drop, setDrop] = useState(false);
  const open = place.open_now;
  const when = open ? place.closes_at : place.opens_at;
  const price = priceChip(place);
  const distance = kmBetween(center, place);
  const reserveOn = place.reservations_enabled === true;
  const offersOn = (place.money?.sell.length ?? 0) > 0;
  const share = () => void Share.share({ message: `${place.name}\nhttps://mesita.ai/place/${place.id}` });
  const maps = () => {
    if (place.lat == null || place.lng == null) return;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`);
  };

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page} testID="place">
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.iconBtn}>
          <Icon strokeWidth={2.25} name="arrow-left" size={22} />
        </Pressable>
        <Text role="strong" numberOfLines={1} style={styles.topName}>{place.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={onReport} style={styles.iconBtn}>
          <Text role="strong">···</Text>
        </Pressable>
      </View>
      <View style={styles.identity}>
        {place.profilePhoto ? (
          <Image source={place.profilePhoto} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatar} />
        )}
        <Stat mark="G" value={place.google.rating != null ? formatRating(place.google.rating) ?? "-" : "-"} detail={place.google.count != null ? formatCompactCount(place.google.count, true) : undefined} />
        <Stat mark="IG" value={place.instagram.followers != null ? formatCompactCount(place.instagram.followers) : "-"} />
        <Stat mark="f" value={place.facebook.followers != null ? formatCompactCount(place.facebook.followers) : "-"} />
      </View>
      <View style={styles.facts}>
        {place.category ? <Fact label={place.category} /> : null}
        {price ? <Fact label={price} /> : null}
        {place.google.rating != null ? <Fact label={`${formatRating(place.google.rating)} (${place.google.count ?? 0})`} /> : null}
        {open !== null ? <Fact label={`${open ? "Open" : "Closed"}${when ? ` until ${toAmPm(when)}` : ""}`} tone={open ? "price" : "closed"} /> : null}
        {place.zone ? <Fact label={place.zone} /> : null}
        {distance != null ? <Fact label={formatDistanceKm(distance)} /> : null}
      </View>
      <View style={styles.actions}>
        <Black label={saved ? "Saved" : "Save"} icon={saved ? "heart-filled" : "heart"} onPress={() => (saved ? setDrop(true) : onSave())} />
        <Black label="Maps" icon="map-pin" onPress={maps} />
        <Black label="Contact" icon="phone" onPress={onContact} />
        <Black label="Share" icon="share-2" onPress={share} />
        <Black label="Upgrade" icon="rocket" onPress={() => void Linking.openURL(`https://mesita.ai/place/${place.id}/upgrade`)} />
      </View>
      <View style={styles.split}>
        <Pressable accessibilityRole="button" onPress={() => (reserveOn ? onReserve() : Alert.alert("Reserve", "This place doesn't offer reservations."))} style={styles.half}>
          <Icon strokeWidth={2.25} name="calendar" size={16} color={colors.onInk} />
          <Text role="label" tone="onInk">Reserve</Text>
          <Text role="caption" tone="onInk" style={styles.off}>{reserveOn ? "" : "Off"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => (offersOn ? onOffers() : Alert.alert("Offers", "This place has no offers right now."))} style={styles.half}>
          <Text role="label" tone="onInk">Offers</Text>
          <Text role="caption" tone="onInk" style={styles.off}>{offersOn ? "" : "Off"}</Text>
        </Pressable>
      </View>
      <RemoveSaved
        name={drop ? place.name : null}
        onCancel={() => setDrop(false)}
        onConfirm={() => {
          setDrop(false);
          onSave();
        }}
      />
      <View style={styles.tabs}>
        {TABS.map((name) => (
          <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: tab === name }} onPress={() => setTab(name)} style={styles.tab}>
            <Text role="label" tone={tab === name ? "ink" : "muted"}>{name}</Text>
            {tab === name ? <View style={styles.tabLine} /> : null}
          </Pressable>
        ))}
      </View>
      {tab === "Overview" ? <Overview place={place} width={width} photo={photo} onPhoto={setPhoto} /> : null}
      {tab === "Reviews" ? <Reviews place={place} /> : null}
      {tab === "Social" ? <Social placeId={place.id} /> : null}
      {tab === "Menu" ? <MenuTab place={place} onMenu={onMenu} onOpen={onOpenMenu} /> : null}
    </ScrollView>
  );
}

function kmBetween(center: { lat: number; lng: number } | null, place: PlaceDetail): number | null {
  if (!center || place.lat == null || place.lng == null) return null;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(place.lat - center.lat);
  const dLng = rad(place.lng - center.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(center.lat)) * Math.cos(rad(place.lat)) * Math.sin(dLng / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return km > 0 ? Math.round(km * 10) / 10 : null;
}

function priceChip(place: PlaceDetail): string | null {
  if (place.price_range) return /per person/i.test(place.price_range) ? place.price_range : `${place.price_range} per person`;
  const level = place.price_level;
  if (level == null) return null;
  const ranges: Record<number, [number, number]> = { 1: [100, 200], 2: [200, 300], 3: [300, 500], 4: [500, 800] };
  const pair = ranges[level];
  return pair ? `$${pair[0]}–${pair[1]}MX per person` : null;
}

function Stat({ mark, value, detail }: { mark: string; value: string; detail?: string }) {
  return (
    <View style={styles.stat}>
      <Text role="strong">{mark}</Text>
      <Text role="small">{detail ? `${value} ${detail}` : value}</Text>
    </View>
  );
}

function Fact({ label, tone = "ink" }: { label: string; tone?: "ink" | "price" | "closed" }) {
  return (
    <View style={styles.fact}>
      <Text role="caption" tone={tone}>{label}</Text>
    </View>
  );
}

function Black({ label, icon, onPress }: { label: string; icon: "heart" | "heart-filled" | "map-pin" | "phone" | "share-2" | "rocket" | "calendar"; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.black, pressed && pressedStyle]}>
      <Icon strokeWidth={2.25} name={icon} size={18} color={colors.onInk} />
      <Text role="caption" tone="onInk">{label}</Text>
    </Pressable>
  );
}

export function Row({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, pressed && onPress && pressedStyle]}>
      <Text role="body">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  gone: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  page: { paddingBottom: space.xl, gap: space.md },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, minHeight: 48 },
  topName: { flex: 1, textAlign: "center" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.fill },
  stat: { flex: 1, alignItems: "center" },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, paddingHorizontal: space.lg },
  fact: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: space.xs },
  actions: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg },
  black: { flex: 1, backgroundColor: colors.ink, borderRadius: radius["2xl"], minHeight: 64, alignItems: "center", justifyContent: "center", gap: 4 },
  split: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg },
  half: { flex: 1, backgroundColor: colors.ink, borderRadius: radius["2xl"], minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  off: { opacity: 0.7 },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: colors.border },
  tab: { flex: 1, alignItems: "center", paddingVertical: space.md },
  tabLine: { position: "absolute", left: space.md, right: space.md, bottom: 0, height: 2, backgroundColor: colors.distance },
  hero: { height: 240, backgroundColor: colors.fill },
  count: { position: "absolute", right: space.md, top: space.md, backgroundColor: colors.scrim, borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 },
  block: { paddingHorizontal: space.lg, gap: space.xs },
  row: { paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.border },
});
