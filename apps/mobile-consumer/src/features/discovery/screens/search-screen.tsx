import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { Button } from "@/components/button";
import { ErrorState } from "@/components/error-state";
import { Icon } from "@/components/icon";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, maxFontSizeMultiplier, pressedOpacity, radius, space, type } from "@/theme";

import { FamilyStrip } from "../components/family-strip";
import { GenerateSheet, type GenerateTarget } from "../components/generate-sheet";
import { ResultsPanel } from "../components/results-panel";
import { chipsFor, type ChipKey } from "../families";
import { useActiveLocation } from "../location-context";
import { factsOf, type CatalogPlace } from "../model";
import { useMapPlaces, usePlaceSearch, useResolveLocation } from "../queries";

type Nav = { onChooseLocation: () => void; onMenu: () => void; onOpen: (placeId: string) => void; onAdd?: () => void; onSignIn: () => void };

/** The web's Search: a map, the families, and a rail that is only as tall as its cards. */
export function SearchScreen({ onChooseLocation, onMenu, onOpen, onAdd, onSignIn }: Nav) {
  const { location, choose, chip, selectChip } = useActiveLocation();
  const member = useSession().guestId !== null;
  const shown: ChipKey = chip === "saved" ? "near" : chip;
  const map = useMapPlaces(location ?? null, shown);
  const copy = useErrorCopy(map.error);
  const [term, setTerm] = useState("");
  const [token] = useState(() => Crypto.randomUUID());
  const [chosen, setChosen] = useState<string | null>(null);
  const [generate, setGenerate] = useState<GenerateTarget | null>(null);
  const suggestions = usePlaceSearch(term, token, member);
  const resolve = useResolveLocation();
  const height = useWindowDimensions().height;
  const querying = term.trim().length >= 2;

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

  const pickSuggestion = (placeId: string, name: string) => {
    setTerm("");
    resolve.mutate(placeId, {
      onSuccess: (point) => choose({ ...point, name }),
    });
  };

  return (
    <View style={styles.page}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Location: ${location.name}. Change location`}
        onPress={onChooseLocation}
        testID="location"
        style={({ pressed }) => [styles.where, pressed && { opacity: pressedOpacity }]}
      >
        <Icon name="map-pin" size={16} />
        <Text role="label" numberOfLines={1} style={styles.whereName}>
          {location.name}
        </Text>
      </Pressable>
      <View>
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Search places…"
          placeholderTextColor={colors.muted}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          style={styles.field}
          testID="search-field"
        />
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
      </View>
      {member && onAdd ? (
        <Pressable onPress={onAdd} style={styles.where}>
          <Text role="label">Add a place</Text>
        </Pressable>
      ) : null}
      {querying ? null : <FamilyStrip chips={chipsFor(false)} chosen={shown} onSelect={selectChip} onMenu={onMenu} />}
      <GenerateSheet target={generate} onClose={() => setGenerate(null)} onOpen={onOpen} />
      <View style={styles.mapBox}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: location.lat,
            longitude: location.lng,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          testID="search-map"
        >
          {pins.map((pin) => (
            <Marker
              key={pin.id}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              pinColor={pin.id === picked?.id ? colors.reserve : colors.ink}
              onPress={() => setChosen(pin.id)}
            />
          ))}
        </MapView>
        {map.isPending ? <Skeleton style={styles.mapWait} /> : null}
        {map.isError ? (
          <View style={styles.mapError}>
            <ErrorState title="Couldn't load places in this area." message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void map.refetch()} />
          </View>
        ) : (
          <Rail
            places={places}
            picked={picked?.id ?? null}
            filterLabel={shown === "near" || shown === "all" ? null : chipsFor(false).find((row) => row.key === shown)?.label ?? null}
            onAdd={member ? onAdd : undefined}
            onPick={setChosen}
            onOpen={onOpen}
          />
        )}
      </View>
    </View>
  );
}

function pinsOf(places: readonly CatalogPlace[], dots: readonly { id: string; lat: number; lng: number }[]) {
  const fromCards = places.flatMap((place) =>
    place.lat !== null && place.lng !== null ? [{ id: place.id, lat: place.lat, lng: place.lng }] : [],
  );
  const seen = new Set(fromCards.map((pin) => pin.id));
  return [...fromCards, ...dots.filter((dot) => !seen.has(dot.id))];
}

function Rail({
  places,
  picked,
  filterLabel,
  onAdd,
  onPick,
  onOpen,
}: {
  places: readonly CatalogPlace[];
  picked: string | null;
  filterLabel: string | null;
  onAdd?: () => void;
  onPick: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  if (places.length === 0) {
    return (
      <View style={styles.emptyRail} testID="search-rail">
        <Text role="label" tone="onInk">Add a new place to Mesita</Text>
        <Text role="small" tone="onInk">
          {filterLabel ? `Nothing here for ${filterLabel} yet. Takes under 10 seconds.` : "Nothing here yet. Takes under 10 seconds."}
        </Text>
        {onAdd ? (
          <Pressable accessibilityRole="button" onPress={onAdd} style={styles.addPill}>
            <Text role="label" tone="onInk">Add a place</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.rail}
      contentContainerStyle={styles.railContent}
      testID="search-rail"
    >
      {onAdd ? (
        <Pressable accessibilityRole="button" onPress={onAdd} style={styles.addCard}>
          <Text role="label" tone="onInk">Add a new place to Mesita</Text>
          <Text role="small" tone="onInk">Not on Mesita yet? Takes under 10 seconds.</Text>
          <Text role="label" style={styles.addPillText}>Add a place</Text>
        </Pressable>
      ) : null}
      {places.map((place) => (
        <RailCard key={place.id} place={place} on={place.id === picked} onPress={() => { onPick(place.id); onOpen(place.id); }} />
      ))}
    </ScrollView>
  );
}

function RailCard({ place, on, onPress }: { place: CatalogPlace; on: boolean; onPress: () => void }) {
  const facts = factsOf(place);
  return (
    <Pressable
      accessible={false}
      onPress={onPress}
      style={[styles.card, on && styles.cardOn]}
    >
      <Text role="label" numberOfLines={2}>
        {place.name}
      </Text>
      <View style={styles.cardLine}>
        {facts.price ? (
          <Text role="label" tone="price" testID="search-price">
            {facts.price}
          </Text>
        ) : null}
        {facts.kind ? (
          <Text role="small" tone="muted" numberOfLines={1}>
            {facts.kind}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  loading: { flex: 1 },
  none: { flex: 1, alignItems: "center", justifyContent: "center" },
  where: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    margin: space.md,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.field,
    backgroundColor: colors.paper,
  },
  whereName: { flexShrink: 1 },
  signBox: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    padding: space.md,
    gap: space.xs,
    borderRadius: radius.card,
    backgroundColor: colors.paper,
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
  field: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.field,
    backgroundColor: colors.paper,
    color: colors.ink,
    ...type.small,
  },
  suggestions: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    maxHeight: 160,
    borderRadius: radius.field,
    backgroundColor: colors.paper,
    overflow: "hidden",
  },
  suggestion: { paddingHorizontal: space.md, paddingVertical: space.sm },
  mapBox: { flex: 1 },
  mapWait: { ...StyleSheet.absoluteFill, opacity: 0.4 },
  mapError: { ...StyleSheet.absoluteFill, backgroundColor: colors.page },
  rail: { position: "absolute", left: 0, right: 0, bottom: space.md, maxHeight: 132 },
  railContent: { paddingHorizontal: space.md, gap: space.sm },
  emptyRail: {
    position: "absolute",
    left: space.md,
    right: space.md,
    bottom: space.md,
    padding: space.md,
    gap: space.xs,
    borderRadius: radius.card,
    backgroundColor: colors.ink,
  },
  addCard: {
    width: 220,
    height: 112,
    padding: space.md,
    justifyContent: "space-between",
    borderRadius: radius.card,
    backgroundColor: colors.ink,
  },
  addPillText: {
    alignSelf: "flex-start",
    backgroundColor: colors.paper,
    borderRadius: radius.panel,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    overflow: "hidden",
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
    width: 220,
    height: 112,
    padding: space.md,
    justifyContent: "space-between",
    borderRadius: radius.card,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardOn: { borderColor: colors.ink },
  cardLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
