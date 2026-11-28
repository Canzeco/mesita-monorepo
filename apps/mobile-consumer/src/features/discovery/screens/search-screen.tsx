import * as Crypto from "expo-crypto";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useContext, useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Share, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { Button } from "@/components/button";
import { RemoveSaved } from "@/components/remove-saved";
import { ErrorState } from "@/components/error-state";
import { Icon, PremierSeal } from "@/components/icon";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, maxFontSizeMultiplier, pressedOpacity, radius, searchMapStyle, space, type } from "@/theme";

import { GenerateSheet, type GenerateTarget } from "../components/generate-sheet";
import { ResultsPanel } from "../components/results-panel";
import { chipsFor, isSpecial, type Chip, type ChipKey } from "../families";
import { useActiveLocation } from "../location-context";
import { factsOf, shareUrl, type CatalogPlace } from "../model";
import { useMapPlaces, usePlaceSearch, useResolveLocation, useSaved, useToggleSaved } from "../queries";

type Nav = {
  onChooseLocation: () => void;
  onMenu: () => void;
  onOpen: (placeId: string) => void;
  onReserve?: (placeId: string) => void;
  onAdd?: () => void;
  onSignIn: () => void;
};

type Pin = { id: string; lat: number; lng: number; name: string | null; premier: boolean; dot: boolean };

/** The web's Search: the map is the page, and the bar, chips, ring and card float on it. */
export function SearchScreen({ onChooseLocation, onMenu, onOpen, onReserve, onAdd, onSignIn }: Nav) {
  const { location, choose, chip, selectChip } = useActiveLocation();
  const member = useSession().guestId !== null;
  const saved = useSaved();
  const toggle = useToggleSaved();
  const [drop, setDrop] = useState<CatalogPlace | null>(null);
  const shown: ChipKey = chip === "saved" ? "near" : chip;
  const map = useMapPlaces(location ?? null, shown);
  const copy = useErrorCopy(map.error);
  const [term, setTerm] = useState("");
  const [token] = useState(() => Crypto.randomUUID());
  const [chosen, setChosen] = useState<string | null>(null);
  const [generate, setGenerate] = useState<GenerateTarget | null>(null);
  const [you, setYou] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const field = useRef<ComponentRef<typeof TextInput>>(null);
  const suggestions = usePlaceSearch(term, token, member);
  const resolve = useResolveLocation();
  const { width, height } = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const querying = term.trim().length >= 2;

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!live || perm.status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({});
        if (live) setYou({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // The map still draws. The blue dot needs a location answer.
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (location === undefined) return <Skeleton style={styles.loading} />;
  if (location === null) {
    return (
      <View style={styles.none} testID="empty-state">
        <Button label="Choose location" icon="map-pin" onPress={onChooseLocation} />
      </View>
    );
  }

  const places = map.data?.places ?? [];
  const pins = pinsOf(places, map.data?.dots ?? []);
  const picked = places.find((place) => place.id === chosen) ?? places[0] ?? null;
  const names = labeledIds(pins, picked?.id ?? null);
  const cardWidth = Math.max(260, width - 72);

  const pickSuggestion = (placeId: string, name: string) => {
    setTerm("");
    resolve.mutate(placeId, {
      onSuccess: (point) => choose({ ...point, name }),
    });
  };

  return (
    <View style={styles.page}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={searchMapStyle}
        initialRegion={{
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        }}
        onMapReady={() => setMapReady(true)}
        testID="search-map"
      >
        {pins.map((pin) => (
          <PlaceMarker
            key={pin.id}
            pin={pin}
            selected={pin.id === picked?.id}
            named={names.has(pin.id)}
            onPress={() => setChosen(pin.id)}
          />
        ))}
        {you ? (
          <Marker coordinate={{ latitude: you.lat, longitude: you.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={50}>
            <View style={[styles.dot, styles.you]} />
          </Marker>
        ) : null}
      </MapView>
      {mapReady ? null : <View pointerEvents="none" style={styles.veil} />}
      <View pointerEvents="none" style={styles.ringWrap}>
        <View style={styles.ring} />
      </View>
      <View style={[styles.chrome, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Location: ${location.name}. Change location`}
            onPress={onChooseLocation}
            testID="location"
            style={({ pressed }) => [styles.locate, pressed && { opacity: pressedOpacity }]}
          >
            <Icon name="navigation" size={18} />
          </Pressable>
          <Icon name="search" size={16} color={colors.muted} />
          <TextInput
            ref={field}
            value={term}
            onChangeText={setTerm}
            placeholder="Search places…"
            placeholderTextColor={colors.muted}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            style={styles.field}
            testID="search-field"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask AI"
            onPress={() => field.current?.focus()}
            style={({ pressed }) => [styles.ai, pressed && { opacity: pressedOpacity }]}
          >
            <Sparkle />
            <Text role="label">AI</Text>
          </Pressable>
        </View>
        {querying && member ? (
          <ResultsPanel
            rows={suggestions.data ?? []}
            searching={suggestions.isFetching && (suggestions.data?.length ?? 0) === 0}
            failed={suggestions.isError}
            maxHeight={Math.round(height * 0.55)}
            onOpen={onOpen}
            onLocate={pickSuggestion}
            onGenerate={(row) => setGenerate({ gid: row.placeId, name: row.mainText, address: row.secondaryText })}
            onRetry={() => void suggestions.refetch()}
            onClear={() => setTerm("")}
          />
        ) : null}
        {querying && !member ? (
          <View style={styles.signBox}>
            <Text role="label">Sign in to search by name</Text>
            <Text role="caption" tone="muted">Or clear the search to browse the map.</Text>
            <Pressable accessibilityRole="button" onPress={() => setTerm("")} style={styles.signIn}>
              <Text role="label">Clear search</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onSignIn} style={styles.signIn}>
              <Text role="label">Sign in</Text>
            </Pressable>
          </View>
        ) : null}
        {querying ? null : (
          <MapChips chips={chipsFor(false)} chosen={shown} onSelect={selectChip} onMenu={onMenu} />
        )}
      </View>
      <GenerateSheet target={generate} onClose={() => setGenerate(null)} onOpen={onOpen} />
      <RemoveSaved
        name={drop?.name ?? null}
        onCancel={() => setDrop(null)}
        onConfirm={() => {
          if (drop) toggle.mutate({ place: drop, on: false });
          setDrop(null);
        }}
      />
      {map.isPending ? null : map.isError ? (
        <View style={[styles.mapError, { bottom: insets.bottom + 64 }]}>
          <ErrorState title="Couldn't load places in this area." message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void map.refetch()} />
        </View>
      ) : (
        <Rail
          places={places}
          picked={picked?.id ?? null}
          cardWidth={cardWidth}
          bottom={insets.bottom + 64}
          filterLabel={shown === "near" || shown === "all" ? null : chipsFor(false).find((row) => row.key === shown)?.label ?? null}
          onAdd={member ? onAdd : undefined}
          onPick={setChosen}
          onOpen={onOpen}
          onReserve={onReserve}
          saved={(id) => saved.data?.ids.includes(id) ?? false}
          onSave={(place) => {
            if (!member) {
              onSignIn();
              return;
            }
            if (saved.data?.ids.includes(place.id)) setDrop(place);
            else toggle.mutate({ place, on: true });
          }}
          onShare={(place) => void Share.share({ message: `${place.name}\n${shareUrl(place)}` })}
        />
      )}
    </View>
  );
}

function pinsOf(
  places: readonly CatalogPlace[],
  dots: readonly { id: string; lat: number; lng: number; premier: boolean }[],
): Pin[] {
  const fromCards = places.flatMap((place) =>
    place.lat !== null && place.lng !== null
      ? [{ id: place.id, lat: place.lat, lng: place.lng, name: place.name, premier: place.isPremier, dot: false }]
      : [],
  );
  const seen = new Set(fromCards.map((pin) => pin.id));
  const extra = dots
    .filter((dot) => !seen.has(dot.id))
    .map((dot) => ({ id: dot.id, lat: dot.lat, lng: dot.lng, name: null, premier: dot.premier, dot: true }));
  return [...fromCards, ...extra];
}

/** Names beside the nearer pins. The selected place always keeps its name. */
function labeledIds(pins: readonly Pin[], selected: string | null): Set<string> {
  const cards = pins.filter((pin) => !pin.dot && pin.name);
  const first = cards.find((pin) => pin.id === selected);
  const order = first ? [first, ...cards.filter((pin) => pin.id !== first.id)] : cards;
  const kept: Pin[] = [];
  for (const pin of order) {
    const crowded = kept.some((other) => Math.abs(other.lat - pin.lat) < 0.004 && Math.abs(other.lng - pin.lng) < 0.008);
    if (crowded && pin.id !== selected) continue;
    kept.push(pin);
    if (kept.length >= 12) break;
  }
  return new Set(kept.map((pin) => pin.id));
}

function PlaceMarker({ pin, selected, named, onPress }: { pin: Pin; selected: boolean; named: boolean; onPress: () => void }) {
  const fill = selected ? colors.mapSelected : pin.premier ? colors.mapPremier : colors.mapPin;
  return (
    <Marker
      coordinate={{ latitude: pin.lat, longitude: pin.lng }}
      anchor={{ x: named ? 0.06 : 0.5, y: 0.5 }}
      tracksViewChanges={false}
      zIndex={selected ? 40 : pin.premier ? 20 : pin.dot ? 1 : 10}
      onPress={onPress}
    >
      <View style={styles.marker}>
        <View style={[pin.dot ? styles.pebble : styles.dot, { backgroundColor: fill }]} />
        {named && pin.name ? (
          <Text role="caption" numberOfLines={1} style={styles.pinName}>
            {pin.name}
          </Text>
        ) : null}
      </View>
    </Marker>
  );
}

function Sparkle() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path d="M12 2.5 13.7 8.3 19.5 10 13.7 11.7 12 17.5 10.3 11.7 4.5 10 10.3 8.3 12 2.5Z" fill={colors.ink} />
      <Path d="M18.2 14.2 19 16.4 21.2 17.2 19 18 18.2 20.2 17.4 18 15.2 17.2 17.4 16.4 18.2 14.2Z" fill={colors.ink} />
    </Svg>
  );
}

function MapChips({
  chips,
  chosen,
  onSelect,
  onMenu,
}: {
  chips: readonly Chip[];
  chosen: ChipKey;
  onSelect: (key: ChipKey) => void;
  onMenu: () => void;
}) {
  const filtered = !isSpecial(chosen);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filtered ? "Menu, a family is chosen" : "Menu"}
        onPress={onMenu}
        testID="menu"
        style={[styles.chip, filtered ? styles.chipFiltered : styles.chipOff]}
      >
        <Icon name="layout-grid" size={16} color={filtered ? colors.onInk : colors.ink} />
        <Text role="label" tone={filtered ? "onInk" : "ink"}>Menu</Text>
      </Pressable>
      {chips.map((row) => {
        const on = row.key === chosen;
        return (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={row.label}
            onPress={() => onSelect(row.key)}
            style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
          >
            <Image source={row.picture} style={styles.chipMark} contentFit="contain" accessible={false} />
            <Text role="label" tone={on ? "onInk" : "ink"}>{row.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Rail({
  places,
  picked,
  cardWidth,
  bottom,
  filterLabel,
  onAdd,
  onPick,
  onOpen,
  onReserve,
  saved,
  onSave,
  onShare,
}: {
  places: readonly CatalogPlace[];
  picked: string | null;
  cardWidth: number;
  bottom: number;
  filterLabel: string | null;
  onAdd?: () => void;
  onPick: (id: string) => void;
  onOpen: (id: string) => void;
  onReserve?: (id: string) => void;
  saved: (id: string) => boolean;
  onSave: (place: CatalogPlace) => void;
  onShare: (place: CatalogPlace) => void;
}) {
  if (places.length === 0) {
    return (
      <View style={[styles.emptyRail, { bottom }]} testID="search-rail">
        <Text role="label" tone="onInk">Add a new place to Mesita</Text>
        <Text role="small" tone="onInk">
          {filterLabel ? `Nothing here for ${filterLabel} yet. Takes under 10 seconds.` : "Nothing here yet. Takes under 10 seconds."}
        </Text>
        {onAdd ? (
          <Pressable accessibilityRole="button" onPress={onAdd} style={styles.addPill}>
            <Text role="label">Add a place</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.rail, { bottom }]}
      contentContainerStyle={styles.railContent}
      snapToInterval={cardWidth + space.sm}
      decelerationRate="fast"
      testID="search-rail"
    >
      {places.map((place) => (
        <RailCard
          key={place.id}
          place={place}
          on={place.id === picked}
          width={cardWidth}
          saved={saved(place.id)}
          onPress={() => {
            onPick(place.id);
            onOpen(place.id);
          }}
          onReserve={onReserve ? () => onReserve(place.id) : undefined}
          onSave={() => onSave(place)}
          onShare={() => onShare(place)}
        />
      ))}
    </ScrollView>
  );
}

function RailCard({
  place,
  on,
  width,
  saved,
  onPress,
  onReserve,
  onSave,
  onShare,
}: {
  place: CatalogPlace;
  on: boolean;
  width: number;
  saved: boolean;
  onPress: () => void;
  onReserve?: () => void;
  onSave: () => void;
  onShare: () => void;
}) {
  const facts = factsOf(place);
  return (
    <View style={[styles.card, { width }, on && styles.cardOn]}>
      {place.reservable ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Reserve ${place.name}`} onPress={onReserve ?? onPress} style={styles.reserve}>
          <Icon name="calendar" size={14} color={colors.onInk} />
          <Text role="label" tone="onInk">Reserve</Text>
        </Pressable>
      ) : null}
      <Pressable accessible={false} onPress={onPress} style={styles.cardBody}>
        <View style={styles.thumb}>
          {place.photo ? (
            <Image source={place.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          {/* Premier sits on the photo, top left (MESITA-5059, MESITA-5061). */}
          {place.isPremier ? (
            <View style={styles.premier}>
              <PremierSeal size={16} color={colors.onVip} check={colors.onInk} />
              <Text role="label" tone="onVip">Premier</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.facts}>
          <View>
            <Text role="strong" numberOfLines={1}>{place.name}</Text>
            {facts.kind ? (
              <Text role="small" numberOfLines={1}>{facts.kind}</Text>
            ) : null}
            <View style={styles.cardLine}>
              {facts.rating ? (
                <>
                  <Icon name="star-filled" size={14} color={colors.ink} />
                  <Text role="small">{`${facts.rating}${facts.reviews ? ` (${facts.reviews})` : ""}`}</Text>
                </>
              ) : null}
              {facts.open ? (
                <Text role="small">{facts.open.now ? "Open" : "Closed"}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.cardActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={saved ? "Saved" : "Save"} onPress={onSave} style={styles.action}>
              <Icon name={saved ? "heart-filled" : "heart"} size={14} />
              <Text role="small">{saved ? "Saved" : "Save"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={onShare} style={styles.action}>
              <Icon name="share-2" size={14} />
              <Text role="small">Share</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const FLOAT = {
  backgroundColor: colors.paper,
  shadowColor: colors.photo,
  shadowOpacity: 0.16,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.mapWait },
  loading: { flex: 1 },
  none: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.page },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: colors.mapWait },
  ringWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  ring: {
    width: "78%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.paper,
    backgroundColor: colors.mapRing,
  },
  chrome: { position: "absolute", top: 0, left: 0, right: 0, gap: space.sm, paddingHorizontal: space.md },
  bar: {
    ...FLOAT,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    overflow: "hidden",
  },
  locate: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  field: { flex: 1, height: 48, marginLeft: space.sm, color: colors.ink, ...type.label },
  ai: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingLeft: space.md,
    paddingRight: space.lg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  signBox: {
    ...FLOAT,
    padding: space.md,
    gap: space.xs,
    borderRadius: radius.card,
    alignItems: "center",
  },
  signIn: {
    marginTop: space.xs,
    paddingHorizontal: space.md,
    height: 36,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { gap: space.sm, paddingVertical: space.xs, paddingRight: space.md },
  chip: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: 16,
  },
  chipOff: FLOAT,
  chipOn: { backgroundColor: colors.ink },
  chipFiltered: { backgroundColor: colors.danger },
  chipMark: { width: 16, height: 16 },
  marker: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 180 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: colors.paper,
  },
  pebble: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.paper,
  },
  you: { backgroundColor: colors.mapYou, width: 14, height: 14, borderRadius: 7 },
  pinName: {
    fontWeight: "600",
    textShadowColor: colors.paper,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  mapError: {
    position: "absolute",
    left: space.md,
    right: space.md,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.paper,
  },
  rail: { position: "absolute", left: 0, right: 0 },
  railContent: { paddingHorizontal: space.md, gap: space.sm },
  emptyRail: {
    position: "absolute",
    left: space.md,
    right: space.md,
    padding: space.md,
    gap: space.xs,
    borderRadius: radius.card,
    backgroundColor: colors.ink,
  },
  addPill: {
    alignSelf: "flex-start",
    marginTop: space.xs,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.panel,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    ...FLOAT,
    borderRadius: radius.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardOn: { borderColor: colors.ink },
  reserve: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    backgroundColor: colors.reserve,
  },
  cardBody: { flexDirection: "row", height: 132 },
  thumb: { width: 132, height: 132, overflow: "hidden", backgroundColor: colors.fill },
  facts: { flex: 1, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm },
  premier: {
    position: "absolute",
    left: space.sm,
    top: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 999,
    backgroundColor: colors.vip,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  name: { flexShrink: 1 },
  cardLine: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: space.sm, marginTop: "auto" },
  action: {
    flex: 1,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
