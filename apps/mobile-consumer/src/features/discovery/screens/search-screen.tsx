import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { useEffect, useEffectEvent, useRef, useState, type ComponentRef } from "react";
import { Alert, ScrollView, Share, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { RemoveSaved } from "@/components/remove-saved";
import { Pulse } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/features/auth";
import { colors, radius, searchMapStyle, shadow, text, weight } from "@/theme";

import type { MapBounds, Suggestion } from "../api";
import { GenerateSheet, type GenerateTarget } from "../components/generate-sheet";
import { ResultsPanel, SmallButton } from "../components/results-panel";
import { AddCard, SearchCard, SearchCardSkeleton } from "../components/search-card";
import { SearchHeader, type Locate } from "../components/search-header";
import { chipsFor, type ChipKey } from "../families";
import { useActiveLocation } from "../location-context";
import { shareUrl, type CatalogPlace, type Point } from "../model";
import { useMapPlaces, usePlaceSearch, useResolveLocation, useSaved, useShareCode, useToggleSaved } from "../queries";
import {
  boundsOf,
  boxOf,
  centerForSight,
  labelWidth,
  LABEL_LEFT,
  movedShare,
  PIN_NAME_MIN_ZOOM,
  regionAt,
  reloadIdleSec,
  reloadMinViewportPct,
  RING_INSET,
  screenOf,
  sightOf,
  START_ZOOM,
  visibleLabels,
  zoomOf,
  type Box,
  type Region,
} from "../search-map";

type Nav = {
  onChooseLocation: () => void;
  onMenu: () => void;
  onOpen: (placeId: string) => void;
  onReserve?: (placeId: string) => void;
  onAdd?: () => void;
  onSignIn: () => void;
};

type Pin = { id: string; lat: number; lng: number; name: string | null; premier: boolean; dot: boolean };

/** The rail rests 8 + 4 above the map's foot (the web's bottom-2 and pb-1). */
const RAIL_BOTTOM = 12;
/** One card page is the screen less 48; each card 3 in from its page (the web's RAIL_PAGE). */
const PAGE_INSET = 48;

const SEARCH_FAILED = "Search failed — try again.";
const SEARCH_UNAVAILABLE = "Search is unavailable right now. Try again.";

/** The web's Search: the map is the page; the bar, chips, ring and cards float on it. */
export function SearchScreen({ onChooseLocation, onMenu, onOpen, onReserve, onAdd, onSignIn }: Nav) {
  const { location, mapChip, selectMapChip } = useActiveLocation();
  const member = useSession().guestId !== null;
  const saved = useSaved();
  const toggle = useToggleSaved();
  const shareCode = useShareCode();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const shown: ChipKey = mapChip === "saved" || mapChip === "social" ? "all" : mapChip;
  const [drop, setDrop] = useState<CatalogPlace | null>(null);
  const [term, setTerm] = useState("");
  const [focused, setFocused] = useState(false);
  const [token] = useState(() => Crypto.randomUUID());
  const [chosen, setChosen] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [generate, setGenerate] = useState<GenerateTarget | null>(null);
  const [you, setYou] = useState<Point | null>(null);
  const [locate, setLocate] = useState<Locate>("idle");
  const [mapReady, setMapReady] = useState(false);
  const [size, setSize] = useState({ width: screenWidth, height: screenHeight });
  const [sight, setSight] = useState({ top: 0, bottom: 0 });
  const [region, setRegion] = useState<Region | null>(null);
  const [loadAt, setLoadAt] = useState<{ point: Point; bounds: MapBounds | null } | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const mapRef = useRef<ComponentRef<typeof MapView>>(null);
  const field = useRef<ComponentRef<typeof TextInput>>(null);
  const railRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const lastLoad = useRef<{ box: Box; at: number } | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const map = useMapPlaces(loadAt, shown);
  const querying = term.trim().length >= 2;
  const suggestions = usePlaceSearch(term, token, member, loadAt?.point ?? null);
  const resolve = useResolveLocation();

  // The clear window between the chips and the cards; the sight is its middle.
  const sightY = sight.bottom > sight.top && size.height > 0 ? (sight.top + sight.bottom) / 2 / size.height : 0.5;
  const ring = RING_INSET * Math.min(size.width, Math.max(0, sight.bottom - sight.top));

  const load = (box: Box) => {
    lastLoad.current = { box, at: Date.now() };
    setLoadAt({ point: sightOf(box, sightY), bounds: boundsOf(box) });
  };

  /** Put `p` under the sight, keeping the zoom (zoom 14 the first time), and load there. */
  const moveTo = (p: Point, from: Region | null) => {
    const base = from ?? regionAt(p, START_ZOOM, size.width, size.height);
    const c = centerForSight(p, boxOf({ ...base, latitude: p.lat, longitude: p.lng }), sightY);
    const next = { ...base, latitude: c.lat, longitude: c.lng };
    mapRef.current?.animateToRegion(next, 300);
    setRegion(next);
    load(boxOf(next));
  };

  // The first camera, once the map and the sight are known, and again when
  // the guest picks another location.
  const start = useEffectEvent(() => {
    if (!location || !mapReady || sight.bottom === 0) return;
    const key = `${location.lat},${location.lng}`;
    if (startedAt === key) return;
    setStartedAt(key);
    moveTo(location, null);
  });
  useEffect(() => {
    // After the layout pass that produced these values, not inside it.
    const id = setTimeout(start, 0);
    return () => clearTimeout(id);
  }, [location, mapReady, sight.bottom]);

  // The device's own point: the blue dot, and Locate's recentre.
  const findMe = async (recentre: boolean) => {
    setLocate("locating");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setLocate("blocked");
        if (recentre) Alert.alert("Location is off for Mesita", "Allow location for Mesita in Settings, then tap again.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setYou(p);
      setLocate("located");
      if (recentre) moveTo(p, region);
    } catch {
      setLocate("blocked");
      if (recentre) Alert.alert("Couldn't find you", "Turn on Location Services, then tap again.");
    }
  };
  const firstFix = useEffectEvent(() => void findMe(false));
  useEffect(() => {
    const id = setTimeout(firstFix, 0);
    return () => {
      clearTimeout(id);
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);

  // A guest move reloads when the map rests, at most once every reloadIdleSec
  // from the last reload, and only past reloadMinViewportPct of that screen.
  const onRest = (next: Region, gesture: boolean) => {
    setRegion(next);
    if (!gesture) return;
    if (pending.current) clearTimeout(pending.current);
    const idleMs = reloadIdleSec(map.data?.reloadIdleSec ?? null) * 1000;
    const minPct = reloadMinViewportPct(map.data?.reloadMinViewportPct ?? null);
    const wait = lastLoad.current ? Math.max(0, lastLoad.current.at + idleMs - Date.now()) : 0;
    pending.current = setTimeout(() => {
      pending.current = null;
      const box = boxOf(next);
      const from = lastLoad.current?.box ?? null;
      if (from && minPct > 0 && movedShare(from, box, sightY) * 100 < minPct) return;
      load(box);
    }, wait);
  };

  if (location === undefined) return <SearchLoading width={screenWidth} insetTop={insets.top} />;
  if (location === null) {
    return (
      <View style={styles.none} testID="empty-state">
        <View style={styles.gate}>
          <Button label="Choose location" icon="map-pin" onPress={onChooseLocation} />
        </View>
      </View>
    );
  }

  const raw = map.data?.places ?? [];
  // A bar pick is card one (the web's prependAnchorPlace).
  const anchored = anchorId ? raw.find((p) => p.id === anchorId) : undefined;
  const places = anchored ? [anchored, ...raw.filter((p) => p.id !== anchorId)] : raw;
  const picked = places.find((p) => p.id === chosen) ?? places[0] ?? null;
  const resultPins: Pin[] = querying
    ? (suggestions.data ?? []).flatMap((row) =>
        row.kind !== "location" && row.onMesita && row.point
          ? [{ id: row.mesitaId ?? row.placeId, lat: row.point.lat, lng: row.point.lng, name: row.mainText, premier: row.premier, dot: false }]
          : [],
      )
    : [];
  const pins = [...pinsOf(places, map.data?.dots ?? []), ...resultPins.filter((r) => !places.some((p) => p.id === r.id))];
  const zoom = region ? zoomOf(region, size.width) : START_ZOOM;
  const named =
    region && zoom >= PIN_NAME_MIN_ZOOM
      ? visibleLabels(
          pins.flatMap((pin) => {
            if (pin.dot || !pin.name) return [];
            const at = screenOf(pin, boxOf(region), size.width, size.height);
            return [{ id: pin.id, title: pin.name, x: at.x, y: at.y, focused: pin.id === picked?.id }];
          }),
        )
      : new Set<string>();
  const page = size.width - PAGE_INSET;
  const card = page - 6;
  const railShown = !querying && !focused;
  const failed = map.isError;
  const filterLabel = shown === "near" || shown === "all" ? null : (chipsFor(false).find((row) => row.key === shown)?.label ?? null);

  const scrollToPlace = (id: string) => {
    const i = places.findIndex((p) => p.id === id);
    if (i >= 0) railRef.current?.scrollTo({ x: (i + 1) * page, animated: true });
  };

  // A catalog pin: select · fly · open (the web's pinGesture).
  const tapPin = (pin: Pin) => {
    if (pin.dot) return;
    if (picked?.id !== pin.id) {
      setChosen(pin.id);
      scrollToPlace(pin.id);
      return;
    }
    const box = region ? boxOf(region) : null;
    const at = box ? screenOf(pin, box, size.width, size.height) : null;
    const underSight = at ? Math.hypot(at.x - size.width / 2, at.y - sightY * size.height) < 24 : true;
    if (!underSight && box && region) {
      const c = centerForSight(pin, box, sightY);
      mapRef.current?.animateToRegion({ ...region, latitude: c.lat, longitude: c.lng }, 300);
      return;
    }
    onOpen(pin.id);
  };

  // Every bar pick anchors the map; a Google-only place opens Generate at once.
  const pickRow = (row: Suggestion) => {
    if (row.kind === "location") {
      setTerm("");
      field.current?.blur();
      resolve.mutate(row.placeId, { onSuccess: (point) => moveTo(point, region) });
      return;
    }
    if (!row.onMesita) {
      setGenerate({ gid: row.placeId, name: row.mainText, address: row.secondaryText });
      return;
    }
    if (!row.point) {
      if (row.mesitaId) onOpen(row.mesitaId);
      return;
    }
    setTerm("");
    field.current?.blur();
    if (row.mesitaId) {
      setAnchorId(row.mesitaId);
      setChosen(row.mesitaId);
    }
    moveTo(row.point, region);
  };

  const actRow = (row: Suggestion) => {
    if (row.onMesita && row.mesitaId) onOpen(row.mesitaId);
    else setGenerate({ gid: row.placeId, name: row.mainText, address: row.secondaryText });
  };

  const searchError = suggestions.isError
    ? (suggestions.error as { status?: number } | null)?.status === 502
      ? SEARCH_UNAVAILABLE
      : SEARCH_FAILED
    : null;

  const savedIds = saved.data?.ids ?? [];
  const onSave = (place: CatalogPlace) => {
    if (!member) {
      onSignIn();
      return;
    }
    if (savedIds.includes(place.id)) setDrop(place);
    else toggle.mutate({ place, on: true });
  };

  return (
    <View style={styles.page} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={searchMapStyle}
        initialRegion={regionAt(location, START_ZOOM, size.width, size.height)}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={(next, details) => onRest(next, details?.isGesture === true)}
        testID="search-map"
      >
        {pins.map((pin) => (
          <PlaceMarker key={pin.id} pin={pin} selected={pin.id === picked?.id} named={named.has(pin.id)} onPress={() => tapPin(pin)} />
        ))}
        {you ? (
          <Marker coordinate={{ latitude: you.lat, longitude: you.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={100}>
            <View style={[styles.disc, styles.you]} />
          </Marker>
        ) : null}
      </MapView>
      {mapReady ? null : <View pointerEvents="none" style={styles.veil} />}
      {mapReady && ring > 0 ? (
        <View pointerEvents="none" style={[styles.sight, { top: sightY * size.height - ring / 2, height: ring }]}>
          <Pulse on={map.isFetching} style={[styles.ring, { width: ring, height: ring }]}>
            <View />
          </Pulse>
        </View>
      ) : null}
      <View
        style={[styles.chrome, { paddingTop: insets.top }]}
        pointerEvents="box-none"
        onLayout={(e) => {
          const bottom = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
          // A hidden chip row keeps the last measure: the ring never jumps under a focus.
          if (!querying && !focused) setSight((s) => (s.top === bottom ? s : { ...s, top: bottom }));
        }}
      >
        <SearchHeader
          term={term}
          onTerm={setTerm}
          field={field}
          onFocus={setFocused}
          locate={locate}
          onLocate={() => void findMe(true)}
          chips={chipsFor(false)}
          chosen={shown}
          onChip={(key) => {
            selectMapChip(key);
            // Nearby is Popular at the guest's own point.
            if (key === "near" && you) moveTo(you, region);
          }}
          onMenu={onMenu}
          chipsHidden={querying}
        >
          {querying ? (
            <ResultsPanel
              rows={suggestions.data ?? []}
              searching={suggestions.waiting || suggestions.isFetching}
              error={searchError}
              maxHeight={Math.round(screenHeight * 0.55)}
              onSignIn={member ? undefined : onSignIn}
              onPick={pickRow}
              onAction={actRow}
              onRetry={() => void suggestions.refetch()}
              onClear={() => setTerm("")}
            />
          ) : null}
          {!querying && failed ? (
            <View style={styles.failed}>
              <View style={styles.errorBox}>
                <Text role="caption" tone="danger">
                  {"Couldn't load places in this area."}
                </Text>
              </View>
              <SmallButton label="Try again" icon="rotate-cw" filled onPress={() => void map.refetch()} />
            </View>
          ) : null}
        </SearchHeader>
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
      {railShown ? (
        <View
          style={styles.rail}
          testID="search-rail"
          onLayout={(e) => {
            const top = e.nativeEvent.layout.y;
            setSight((s) => (s.bottom === top ? s : { ...s, bottom: top }));
          }}
        >
          {map.isPending ? (
            <View style={styles.pages}>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.pageBox, { width: page }]}>
                  <SearchCardSkeleton width={card} />
                </View>
              ))}
            </View>
          ) : places.length === 0 ? (
            <View style={styles.pagesCentred}>
              <View style={[styles.pageBox, { width: page }]}>
                <AddCard width={card} empty={!failed} filterLabel={filterLabel} onAdd={onAdd ?? onSignIn} />
              </View>
            </View>
          ) : (
            <ScrollView
              ref={railRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={page}
              decelerationRate="fast"
              disableIntervalMomentum
              contentOffset={{ x: page, y: 0 }}
              contentContainerStyle={styles.railContent}
              onMomentumScrollEnd={(e) => {
                const place = places[Math.round(e.nativeEvent.contentOffset.x / page) - 1];
                if (place && place.id !== picked?.id) setChosen(place.id);
              }}
            >
              {/* Page 0: the Add card, off-screen left while the rail rests on place one. */}
              <View style={[styles.pageBox, { width: page }]}>
                <AddCard width={card} empty={false} filterLabel={null} onAdd={onAdd ?? onSignIn} />
              </View>
              {places.map((place) => (
                <View key={place.id} style={[styles.pageBox, { width: page }, map.isFetching && styles.dimmed]}>
                  <SearchCard
                    place={place}
                    width={card}
                    selected={place.id === picked?.id}
                    saved={savedIds.includes(place.id)}
                    onOpen={() =>
                      place.googleOnly && place.googleId ? setGenerate({ gid: place.googleId, name: place.name, address: null }) : onOpen(place.id)
                    }
                    onReserve={() => (onReserve ? onReserve(place.id) : onOpen(place.id))}
                    onSave={() => onSave(place)}
                    onShare={() => void Share.share({ message: `${place.name}\n${shareUrl(place, shareCode)}` })}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

/** The web's search/loading.tsx: the green veil, the bar, the chip placeholders, two skeleton cards. */
function SearchLoading({ width, insetTop }: { width: number; insetTop: number }) {
  const page = width - PAGE_INSET;
  return (
    <View style={styles.page} testID="search-loading">
      <View style={[styles.chrome, styles.loadingChrome, { paddingTop: insetTop + 12 }]}>
        <View style={styles.barBlock} />
        <View style={styles.chipsBlock}>
          {["Menu", "Popular", "Coffee", "Breakfast", "Brunch", "Bakery"].map((w) => (
            <View key={w} style={[styles.chipBlock, { width: 28 + w.length * 8 }]} />
          ))}
        </View>
      </View>
      <View style={styles.rail}>
        <View style={styles.pages}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.pageBox, { width: page }]}>
              <SearchCardSkeleton width={page - 6} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function pinsOf(places: readonly CatalogPlace[], dots: readonly { id: string; lat: number; lng: number; premier: boolean }[]): Pin[] {
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

/** A pin: the web's 7-radius disc with a white ring in a 44 tap pad, or a
 *  3-radius dot nobody taps; its name 9 right of the centre when shown. */
function PlaceMarker({ pin, selected, named, onPress }: { pin: Pin; selected: boolean; named: boolean; onPress: () => void }) {
  const fill = selected ? colors.mapSelected : pin.premier ? colors.mapPremier : colors.mapPin;
  // The web's stacking: dot 1, Premier dot 2, pin 10, Premier pin 11, you 100, selected 200.
  const z = selected ? 200 : pin.dot ? (pin.premier ? 2 : 1) : pin.premier ? 11 : 10;
  const pad = pin.dot ? 12 : 44;
  const width = named && pin.name ? pad / 2 + LABEL_LEFT + labelWidth(pin.name) : pad;
  return (
    <Marker
      coordinate={{ latitude: pin.lat, longitude: pin.lng }}
      // The anchor is the disc's centre, half a pad in from the left.
      anchor={{ x: pad / 2 / width, y: 0.5 }}
      tracksViewChanges={false}
      zIndex={z}
      tappable={!pin.dot}
      onPress={pin.dot ? undefined : onPress}
    >
      <View style={[styles.marker, { width, height: pad }]}>
        <View style={[styles.pad, { width: pad, height: pad }]}>
          <View style={[pin.dot ? styles.dot : styles.disc, { backgroundColor: fill }]} />
        </View>
        {named && pin.name ? (
          <Text
            numberOfLines={1}
            style={[styles.pinName, { left: pad / 2 + LABEL_LEFT, maxWidth: labelWidth(pin.name) }, selected ? styles.pinNameOn : styles.pinNameOff]}
          >
            {pin.name}
          </Text>
        ) : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.mapWait },
  none: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.page },
  gate: { width: "100%", maxWidth: 320 },
  veil: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.mapWait },
  sight: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  // 3 pt white, a whisper of white, a thin dark outline and a soft glow.
  ring: {
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: colors.paper,
    backgroundColor: colors.mapRing,
    boxShadow: shadow.ring,
  },
  chrome: { position: "absolute", top: 0, left: 0, right: 0 },
  loadingChrome: { paddingHorizontal: 12, gap: 12 },
  failed: { alignItems: "center", gap: 8 },
  errorBox: { alignSelf: "stretch", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.xl, backgroundColor: colors.dangerSoft },
  rail: { position: "absolute", left: 0, right: 0, bottom: RAIL_BOTTOM },
  railContent: { paddingHorizontal: PAGE_INSET / 2, alignItems: "flex-end" },
  pages: { flexDirection: "row", paddingLeft: PAGE_INSET / 2, alignItems: "flex-end", overflow: "hidden" },
  pagesCentred: { flexDirection: "row", justifyContent: "center" },
  pageBox: { paddingHorizontal: 3 },
  dimmed: { opacity: 0.55 },
  marker: { justifyContent: "center" },
  pad: { alignItems: "center", justifyContent: "center" },
  disc: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.25, borderColor: colors.paper },
  dot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: colors.paper },
  you: { backgroundColor: colors.mapYou },
  // type-label, ink with a white halo (the web strokes 2 px white and shadows 1 px each way).
  pinName: {
    position: "absolute",
    ...text.label,
    textShadowColor: colors.paper,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  pinNameOn: { color: colors.mapLabelOn, fontWeight: weight.semibold },
  pinNameOff: { color: colors.mapLabelOff, fontWeight: weight.normal },
  barBlock: { height: 48, borderRadius: radius.full, backgroundColor: colors.paper, boxShadow: shadow.float },
  chipsBlock: { flexDirection: "row", gap: 8, overflow: "hidden" },
  chipBlock: { height: 32, borderRadius: radius.full, backgroundColor: colors.paper, boxShadow: shadow.float },
});
