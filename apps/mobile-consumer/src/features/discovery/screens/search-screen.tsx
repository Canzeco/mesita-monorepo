import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ComponentRef } from "react";
import { Alert, Platform, ScrollView, Share, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { RemoveSaved } from "@/components/remove-saved";
import { Pulse, Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useSession } from "@/features/auth";
import { colors, radius, searchMapStyle, shadow, text, weight } from "@/theme";

import type { MapAnswer, MapBounds, Suggestion } from "../api";
import { GenerateSheet, type GenerateTarget } from "../components/generate-sheet";
import { ResultsPanel, SmallButton } from "../components/results-panel";
import { AddCard, SearchCard, SearchCardSkeleton } from "../components/search-card";
import { SearchHeader, type Locate } from "../components/search-header";
import { chipsFor, type ChipKey } from "../families";
import { useActiveLocation } from "../location-context";
import { shareUrl, type CatalogPlace, type Point } from "../model";
import { useMapPlaces, usePlaceSearch, useResolveLocation, useSaved, useShareCode, useToggleSaved } from "../queries";
import {
  ANCHOR_DROP_KM,
  boundsOf,
  boxOf,
  centerForSight,
  clearBox,
  isUnderSight,
  isVisible,
  km,
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
  STALE_KM,
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
  /** Add a place, leaning to the map's point. */
  onAdd?: (at: Point | null) => void;
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
  // One search session per query, for Google's billing: renewed after a pick or a clear.
  const [token, setToken] = useState(() => Crypto.randomUUID());
  const renew = () => setToken(Crypto.randomUUID());
  const [chosen, setChosen] = useState<string | null>(null);
  // A bar pick: card one until a load lands 0.4 km from it.
  const [anchor, setAnchor] = useState<{ id: string; point: Point; card: CatalogPlace | null } | null>(null);
  const [generate, setGenerate] = useState<GenerateTarget | null>(null);
  const [you, setYou] = useState<Point | null>(null);
  const [locate, setLocate] = useState<Locate>("idle");
  const [mapReady, setMapReady] = useState(false);
  const [size, setSize] = useState({ width: screenWidth, height: screenHeight });
  const [sight, setSight] = useState({ top: 0, bottom: 0 });
  const [region, setRegion] = useState<Region | null>(null);
  // `n` counts loads, so a repeat (Nearby tapped twice) is a fresh read.
  const [loadAt, setLoadAt] = useState<{ point: Point; bounds: MapBounds | null; n: number } | null>(null);
  // The last set that landed: a failed reload keeps it on screen, as the web does.
  const [kept, setKept] = useState<MapAnswer | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const mapRef = useRef<ComponentRef<typeof MapView>>(null);
  const field = useRef<ComponentRef<typeof TextInput>>(null);
  const railRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const lastLoad = useRef<{ box: Box; at: number } | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The pin the camera last flew to: its next tap opens.
  const arrived = useRef<string | null>(null);

  const map = useMapPlaces(loadAt, shown);
  const querying = term.trim().length >= 2;
  const suggestions = usePlaceSearch(term, token, member, loadAt?.point ?? null);
  const resolve = useResolveLocation();

  // The clear window between the chips and the cards; the sight is its middle.
  const sightY = sight.bottom > sight.top && size.height > 0 ? (sight.top + sight.bottom) / 2 / size.height : 0.5;
  const ring = RING_INSET * Math.min(size.width, Math.max(0, sight.bottom - sight.top));

  const answer = map.data ?? (map.isError ? kept : undefined);
  const raw = answer?.places ?? [];
  // A bar pick is card one (the web's prependAnchorPlace); outside the set, its own card.
  const anchored = anchor ? (raw.find((p) => p.id === anchor.id) ?? anchor.card ?? undefined) : undefined;
  const places = anchored ? [anchored, ...raw.filter((p) => p.id !== anchored.id)] : raw;
  // While typing, the results' pins replace the catalog's; a row with no
  // point takes its catalog row's.
  const resultPins: Pin[] = querying
    ? (suggestions.data ?? []).flatMap((row) => {
        if (row.kind === "location" || !row.onMesita || !row.mesitaId) return [];
        const own = raw.find((p) => p.id === row.mesitaId);
        const at = row.point ?? (own && own.lat !== null && own.lng !== null ? { lat: own.lat, lng: own.lng } : null);
        return at ? [{ id: row.mesitaId, lat: at.lat, lng: at.lng, name: row.mainText, premier: row.premier, dot: false }] : [];
      })
    : [];
  const catalogPins = pinsOf(places, answer?.dots ?? []);
  const pins = resultPins.length > 0 ? [...catalogPins.filter((p) => p.dot), ...resultPins] : catalogPins;
  // The rail's card is the chosen place, else place one; a pin outside the
  // rail can be chosen too.
  const railPicked = places.find((p) => p.id === chosen) ?? places[0] ?? null;
  const picked = { id: pins.some((p) => p.id === chosen) ? chosen : (railPicked?.id ?? null) };

  // What timers and awaits read: this render's values, not their closure's.
  const live = useRef({ region, loadAt, sightY, size, sight, isError: map.isError, pins });
  useLayoutEffect(() => {
    live.current = { region, loadAt, sightY, size, sight, isError: map.isError, pins };
  });

  // A new selection forgets the last fly (the web clears arrived on every change).
  useEffect(() => {
    arrived.current = null;
  }, [picked.id]);

  // A set that landed: keep it, and end a bar pick that landed 0.4 km away.
  const landed = useEffectEvent(() => {
    if (!map.data || map.isPlaceholderData) return;
    setKept(map.data);
    const at = loadAt?.point;
    if (at) setAnchor((a) => (a && km(a.point, at) >= ANCHOR_DROP_KM ? null : a));
  });
  useEffect(() => {
    const id = setTimeout(landed, 0);
    return () => clearTimeout(id);
  }, [map.dataUpdatedAt]);

  /** Load at the sight; the bounds are the clear window, so the server's circle is the ring. */
  const load = (box: Box) => {
    const now = live.current;
    lastLoad.current = { box, at: Date.now() };
    const point = sightOf(box, now.sightY);
    const top = now.size.height > 0 ? now.sight.top / now.size.height : 0;
    const bottom = now.size.height > 0 && now.sight.bottom > 0 ? now.sight.bottom / now.size.height : 1;
    setLoadAt((was) => ({ point, bounds: boundsOf(clearBox(box, top, bottom)), n: (was?.n ?? 0) + 1 }));
  };

  /** Put `p` under the sight, keeping the zoom; load there unless told not to. */
  const moveTo = (p: Point, from: Region | null, reload = true) => {
    const { size: area, sightY: y } = live.current;
    const base = from ?? regionAt(p, START_ZOOM, area.width, area.height);
    const c = centerForSight(p, boxOf({ ...base, latitude: p.lat, longitude: p.lng }), y);
    const next = { ...base, latitude: c.lat, longitude: c.lng };
    mapRef.current?.animateToRegion(next, 300);
    setRegion(next);
    if (reload) load(boxOf(next));
  };

  // The first camera: the chosen point at the map's centre, zoom 14 (the
  // MapView's initialCamera); the first load goes out at the sight, from the
  // camera the map really shows. Again when the guest picks another location.
  const start = useEffectEvent(async () => {
    if (!location || !mapReady || sight.bottom === 0) return;
    const key = `${location.lat},${location.lng}`;
    if (startedAt === key) return;
    const first = startedAt === null;
    setStartedAt(key);
    if (!first) {
      mapRef.current?.animateCamera({ center: { latitude: location.lat, longitude: location.lng }, zoom: START_ZOOM }, { duration: 300 });
      await new Promise((done) => setTimeout(done, 350));
    }
    const edges = await mapRef.current?.getMapBoundaries().catch(() => null);
    const box = edges
      ? { north: edges.northEast.latitude, east: edges.northEast.longitude, south: edges.southWest.latitude, west: edges.southWest.longitude }
      : boxOf(regionAt(location, START_ZOOM, size.width, size.height));
    setRegion({
      latitude: (box.north + box.south) / 2,
      longitude: (box.east + box.west) / 2,
      latitudeDelta: box.north - box.south,
      longitudeDelta: box.east - box.west,
    });
    load(box);
  });
  useEffect(() => {
    // After the layout pass that produced these values, not inside it.
    const id = setTimeout(() => void start(), 0);
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
      // Recentre always; reload only once the fix has left the loaded set behind.
      const now = live.current;
      if (recentre) moveTo(p, now.region, !now.loadAt || km(now.loadAt.point, p) >= STALE_KM);
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

  // The rail rests on the chosen card's page for each new set, and when it comes back.
  const railKey = places.map((p) => p.id).join("|");
  const railBack = !querying && !focused;
  const rest = useEffectEvent(() => {
    const i = Math.max(0, places.findIndex((p) => p.id === railPicked?.id));
    railRef.current?.scrollTo({ x: (i + 1) * (size.width - PAGE_INSET), animated: false });
  });
  useLayoutEffect(() => {
    if (railBack) rest();
  }, [railKey, railBack]);

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
      const now = live.current;
      // After a failed load the next rest retries at any distance.
      const from = now.isError ? null : (lastLoad.current?.box ?? null);
      if (from && minPct > 0 && movedShare(from, box, now.sightY) * 100 < minPct) return;
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

  const zoom = region ? zoomOf(region, size.width) : START_ZOOM;
  const named =
    region && zoom >= PIN_NAME_MIN_ZOOM
      ? visibleLabels(
          pins.flatMap((pin) => {
            if (pin.dot || !pin.name) return [];
            const at = screenOf(pin, boxOf(region), size.width, size.height);
            return [{ id: pin.id, title: pin.name, x: at.x, y: at.y, focused: pin.id === picked.id }];
          }),
        )
      : new Set<string>();
  const page = size.width - PAGE_INSET;
  const card = page - 6;
  const railShown = !querying && !focused;
  const failed = map.isError;
  const filterLabel = shown === "near" || shown === "all" ? null : (chipsFor(false).find((row) => row.key === shown)?.label ?? null);

  // The card the rail came to rest on is the selected pin.
  const settle = (x: number) => {
    const place = places[Math.round(x / page) - 1];
    if (place && place.id !== picked.id) setChosen(place.id);
  };

  const scrollToPlace = (id: string) => {
    const i = places.findIndex((p) => p.id === id);
    if (i >= 0) railRef.current?.scrollTo({ x: (i + 1) * page, animated: true });
  };

  // iPhone's Google map hands a marker tap to the SDK (select and centre), so
  // pins there take no taps and the map's own tap finds the nearest pin.
  const hitPin = (x: number, y: number) => {
    const now = live.current;
    if (!now.region) return;
    const box = boxOf(now.region);
    let best: { pin: Pin; d: number } | null = null;
    for (const pin of now.pins) {
      if (pin.dot) continue;
      const at = screenOf(pin, box, now.size.width, now.size.height);
      const d = Math.hypot(at.x - x, at.y - y);
      if (d <= 22 && (!best || d < best.d)) best = { pin, d };
    }
    if (best) tapPin(best.pin);
  };

  const flyTo = (pin: Pin) => {
    if (!region) return;
    const c = centerForSight(pin, boxOf(region), sightY);
    mapRef.current?.animateToRegion({ ...region, latitude: c.lat, longitude: c.lng }, 300);
  };

  // A pin: select · fly · open (the web's pinGesture). The first tap pans
  // only when the pin is off the visible map.
  const tapPin = (pin: Pin) => {
    if (pin.dot) return;
    const box = region ? boxOf(region) : null;
    if (picked.id !== pin.id) {
      arrived.current = null;
      setChosen(pin.id);
      scrollToPlace(pin.id);
      if (box && !isVisible(box, pin)) flyTo(pin);
      return;
    }
    if (arrived.current === pin.id || !box || isUnderSight(box, pin, sightY)) {
      onOpen(pin.id);
      return;
    }
    arrived.current = pin.id;
    flyTo(pin);
  };

  // Every bar pick anchors the map; a Google-only place opens Generate at once.
  const pickRow = (row: Suggestion) => {
    if (row.kind === "location") {
      setTerm("");
      renew();
      field.current?.blur();
      setChosen(null);
      setAnchor(null);
      // A location fits its own extent: a city opens wide, a neighbourhood close.
      resolve.mutate(row.placeId, {
        onSuccess: (found) => {
          if (!found.viewport) {
            moveTo(found, region);
            return;
          }
          const { low, high } = found.viewport;
          const next = {
            latitude: (low.lat + high.lat) / 2,
            longitude: (low.lng + high.lng) / 2,
            latitudeDelta: Math.max(0.002, high.lat - low.lat),
            longitudeDelta: Math.max(0.002, high.lng - low.lng),
          };
          mapRef.current?.animateToRegion(next, 300);
          setRegion(next);
          load(boxOf(next));
        },
      });
      return;
    }
    if (!row.onMesita) {
      setGenerate({ gid: row.placeId, name: row.mainText, address: row.secondaryText });
      return;
    }
    const own = row.mesitaId ? raw.find((p) => p.id === row.mesitaId) : undefined;
    const point = own && own.lat !== null && own.lng !== null ? { lat: own.lat, lng: own.lng } : row.point;
    if (!point) {
      renew();
      if (row.mesitaId) onOpen(row.mesitaId);
      return;
    }
    setTerm("");
    renew();
    field.current?.blur();
    if (row.mesitaId) {
      setAnchor({ id: row.mesitaId, point, card: own ?? row.card ?? stubOf(row, point) });
      setChosen(row.mesitaId);
    }
    moveTo(point, region);
  };

  const actRow = (row: Suggestion) => {
    renew();
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
        initialCamera={{ center: { latitude: location.lat, longitude: location.lng }, zoom: START_ZOOM, heading: 0, pitch: 0 }}
        moveOnMarkerPress={false}
        onPress={(e) => {
          if (Platform.OS === "ios") hitPin(e.nativeEvent.position.x, e.nativeEvent.position.y);
        }}
        onMapReady={() => setMapReady(true)}
        // Any new move cancels a pending reload; the rest that ends it arms another.
        onRegionChange={() => {
          if (pending.current) clearTimeout(pending.current);
        }}
        onRegionChangeComplete={(next, details) => onRest(next, details?.isGesture === true)}
        testID="search-map"
      >
        {pins.map((pin) => (
          <PlaceMarker key={pin.id} pin={pin} selected={pin.id === picked.id} onPress={() => tapPin(pin)} />
        ))}
        {pins.map((pin) =>
          named.has(pin.id) && pin.name ? <PinName key={`name-${pin.id}`} pin={pin} selected={pin.id === picked.id} /> : null,
        )}
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
          onTerm={(next) => {
            if (next.trim().length < 2 && term.trim().length >= 2) renew();
            setTerm(next);
          }}
          field={field}
          onFocus={setFocused}
          locate={locate}
          onLocate={() => void findMe(true)}
          chips={chipsFor(false)}
          chosen={shown}
          onChip={(key) => {
            selectMapChip(key);
            // Nearby is Popular at the guest's own point (the chosen one without a fix).
            if (key === "near") {
              moveTo(you ?? location, region);
            }
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
              onClear={() => {
                setTerm("");
                renew();
              }}
            />
          ) : null}
          {failed ? (
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
                <AddCard width={card} empty={!failed} filterLabel={filterLabel} onAdd={() => (onAdd ? onAdd(loadAt?.point ?? null) : onSignIn())} />
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
              onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
              onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.x)}
            >
              {/* Page 0: the Add card, off-screen left while the rail rests on place one. */}
              <View style={[styles.pageBox, { width: page }]}>
                <AddCard width={card} empty={false} filterLabel={null} onAdd={() => (onAdd ? onAdd(loadAt?.point ?? null) : onSignIn())} />
              </View>
              {places.map((place) => (
                <View key={place.id} style={[styles.pageBox, { width: page }, map.isFetching && styles.dimmed]}>
                  <SearchCard
                    place={place}
                    width={card}
                    selected={place.id === picked.id}
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
            // The real chip's own width: an invisible copy over a white pulse.
            <View key={w} style={styles.chipBlock}>
              <Skeleton style={styles.chipPulse} />
              <View style={styles.chipCopy}>
                <View style={styles.chipMarkSpace} />
                <Text role="label" style={styles.invisible}>
                  {w}
                </Text>
              </View>
            </View>
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

/** A pick the server sent no card for: the web's anchorPlaceFromPrediction stub. */
function stubOf(row: Suggestion, point: Point): CatalogPlace {
  return {
    id: row.mesitaId ?? row.placeId,
    slug: null,
    name: row.mainText,
    category: null,
    photo: null,
    priceLevel: null,
    rating: null,
    reviews: null,
    hours: null,
    timezone: null,
    zone: null,
    distanceKm: null,
    isPremier: row.premier,
    isAd: false,
    lat: point.lat,
    lng: point.lng,
  };
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

/** A pin: the web's 7-radius disc with a 1.25 white stroke centred on its
 *  edge, in a 44 tap pad, or a 3-radius dot nobody taps. The key carries the
 *  colour, so a selection redraws the marker. */
function PlaceMarker({ pin, selected, onPress }: { pin: Pin; selected: boolean; onPress: () => void }) {
  const fill = selected ? colors.mapSelected : pin.premier ? colors.mapPremier : colors.mapPin;
  // The web's stacking: dot 1, Premier dot 2, pin 10, Premier pin 11, you 100, selected 200.
  const z = selected ? 200 : pin.dot ? (pin.premier ? 2 : 1) : pin.premier ? 11 : 10;
  const pad = pin.dot ? 12 : 44;
  return (
    <Marker
      key={`${pin.id}-${selected ? "on" : "off"}`}
      coordinate={{ latitude: pin.lat, longitude: pin.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      zIndex={z}
      tappable={Platform.OS !== "ios" && !pin.dot}
      onPress={pin.dot || Platform.OS === "ios" ? undefined : onPress}
    >
      <View style={[styles.pad, { width: pad, height: pad }]}>
        <View style={[pin.dot ? styles.dot : styles.disc, { backgroundColor: fill }]} />
      </View>
    </Marker>
  );
}

const HALO = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/** A pin's name, 9 right of its centre: ink over a white halo (the web's 2 px
 *  stroke and four 1 px shadows), its own marker so it takes no taps. */
function PinName({ pin, selected }: { pin: Pin; selected: boolean }) {
  const title = pin.name ?? "";
  const width = LABEL_LEFT + labelWidth(title);
  const ink = selected ? styles.pinNameOn : styles.pinNameOff;
  return (
    <Marker
      key={`name-${pin.id}-${selected ? "on" : "off"}`}
      coordinate={{ latitude: pin.lat, longitude: pin.lng }}
      anchor={{ x: 0, y: 0.5 }}
      tracksViewChanges={false}
      tappable={false}
      zIndex={selected ? 201 : 12}
    >
      <View style={[styles.nameBox, { width, height: 16 }]} pointerEvents="none">
        {HALO.map(([x, y]) => (
          <Text key={`${x}${y}`} numberOfLines={1} style={[styles.pinName, styles.halo, ink, { left: LABEL_LEFT + x, top: y, width: labelWidth(title) }]}>
            {title}
          </Text>
        ))}
        <Text numberOfLines={1} style={[styles.pinName, ink, { left: LABEL_LEFT, top: 0, width: labelWidth(title) }]}>
          {title}
        </Text>
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
  // The chips' row sits 4 + 8 under the bar, as the real one.
  loadingChrome: { paddingHorizontal: 12, gap: 4 },
  failed: { alignItems: "center", gap: 8 },
  errorBox: { alignSelf: "stretch", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.xl, backgroundColor: colors.dangerSoft },
  rail: { position: "absolute", left: 0, right: 0, bottom: RAIL_BOTTOM },
  railContent: { paddingHorizontal: PAGE_INSET / 2, alignItems: "flex-end" },
  pages: { flexDirection: "row", paddingLeft: PAGE_INSET / 2, alignItems: "flex-end", overflow: "hidden" },
  pagesCentred: { flexDirection: "row", justifyContent: "center" },
  pageBox: { paddingHorizontal: 3 },
  dimmed: { opacity: 0.55 },
  pad: { alignItems: "center", justifyContent: "center" },
  // The web strokes on the edge, half out: r 7 + 0.625 and r 3 + 0.5.
  disc: { width: 15.25, height: 15.25, borderRadius: 7.625, borderWidth: 1.25, borderColor: colors.paper },
  dot: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1, borderColor: colors.paper },
  nameBox: {},
  halo: { color: colors.paper },
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
  chipsBlock: { flexDirection: "row", gap: 8, overflow: "hidden", paddingVertical: 8 },
  chipBlock: { height: 32, borderRadius: radius.full, boxShadow: shadow.float },
  chipPulse: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.full, backgroundColor: colors.paper },
  chipCopy: { height: 32, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 13 },
  chipMarkSpace: { width: 16, height: 16 },
  invisible: { opacity: 0 },
});
