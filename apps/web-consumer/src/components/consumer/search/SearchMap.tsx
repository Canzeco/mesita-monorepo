"use client";

// Trimmed local variant of the discover map for the Search page.
//
// ConsumerDiscoverMap ships its own page chrome (counts pill + legend
// header, geolocation banner, bottom preview card) which would collide
// with this page's floating search bar and catalog rail — and the Search
// page can't edit that shared component. This copy keeps only the base
// layer: the light-styled canvas, place pins, the user dot, and pan/zoom
// behaviour. Pin taps report up via onSelectPlace so the page can sync
// the catalog rail instead of opening a preview card.

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import {
  APIProvider,
  APILoadingStatus,
  Map,
  Marker,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import type { Place } from "@/lib/api/places";
import { Skeleton, Spinner } from "@/components/shared";
import {
  MONTERREY_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_USER_ZOOM,
  MAP_MINIMAL_STYLES,
  MAP_PIN_CURSOR,
  MAP_PIN_HIT_SIZE,
  MAP_PIN_STROKE_COLOR,
  MAP_USER_LOCATION_PIN_COLOR,
  mapPinIcon,
} from "@/lib/map-defaults";
import type { Coords } from "@/lib/use-user-location";
import {
  pinFillColor,
  pinStrokeColor,
  placeMembershipTone,
  type MembershipTone,
} from "@/lib/search-membership";

type MapsCtor = {
  Size: new (w: number, h: number) => { width: number; height: number };
  Point: new (x: number, y: number) => { x: number; y: number };
};

function mapsPinIcon(fillColor: string, strokeColor: string) {
  const raw = mapPinIcon(fillColor, strokeColor);
  const maps = (globalThis as { google?: { maps?: MapsCtor } }).google?.maps;
  if (!maps) return raw;
  return {
    url: raw.url,
    scaledSize: new maps.Size(MAP_PIN_HIT_SIZE, MAP_PIN_HIT_SIZE),
    anchor: new maps.Point(MAP_PIN_HIT_SIZE / 2, MAP_PIN_HIT_SIZE / 2),
  };
}

function placeIcon(tone: MembershipTone, isSelected: boolean) {
  return mapsPinIcon(pinFillColor(tone), pinStrokeColor(isSelected));
}

function userIcon() {
  return mapsPinIcon(MAP_USER_LOCATION_PIN_COLOR, MAP_PIN_STROKE_COLOR);
}

export type SearchMapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  tone: MembershipTone;
};

export type ViewportBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type MapInstance = NonNullable<ReturnType<typeof useMap>>;

function readViewportBox(
  map: MapInstance,
): ViewportBox | null {
  const bounds = map.getBounds();
  if (!bounds) return null;
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return {
    south: sw.lat(),
    west: sw.lng(),
    north: ne.lat(),
    east: ne.lng(),
  };
}

export function SearchMap({
  apiKey,
  places,
  userLocation,
  viewCenter,
  selectedId,
  pins,
  onSelectPlace,
  onOpenPlace,
  onSelectPin,
  onMapClick,
  onFirstViewport,
  onUserViewport,
}: {
  apiKey: string;
  places: Place[];
  userLocation: Coords | null;
  viewCenter: Coords | null;
  selectedId: string | null;
  pins?: SearchMapPin[] | null;
  onSelectPlace: (place: Place) => void;
  onOpenPlace: (place: Place) => void;
  onSelectPin?: (pin: SearchMapPin) => void;
  onMapClick?: () => void;
  onFirstViewport?: (box: ViewportBox) => void;
  onUserViewport?: (
    box: ViewportBox,
    meta: { programmatic: boolean },
  ) => void;
}) {
  // The Maps SDK bootstrap + first tile paint leave the canvas blank for a
  // beat — hold a muted skeleton veil over it until tiles actually land
  // (or the SDK load fails, so the veil can't sit there forever).
  const [mapReady, setMapReady] = useState(false);
  const handleMapReady = useCallback(() => setMapReady(true), []);

  // No key → the overlays (search, Ask AI, rail) still work; the base
  // layer degrades to a branded hero wash instead of a dead screen.
  if (!apiKey) {
    return (
      <div className="bg-hero absolute inset-0">
        <div className="text-muted-foreground bg-card/90 shadow-elev type-label absolute bottom-40 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 font-medium backdrop-blur">
          <MapPin className="h-3 w-3" />
          Live map coming soon
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <APIProvider apiKey={apiKey} libraries={["places"]}>
        <SearchMapCanvas
          places={places}
          userLocation={userLocation}
          viewCenter={viewCenter}
          selectedId={selectedId}
          pins={pins}
          onSelectPlace={onSelectPlace}
          onOpenPlace={onOpenPlace}
          onSelectPin={onSelectPin}
          onMapClick={onMapClick}
          onReady={handleMapReady}
          onFirstViewport={onFirstViewport}
          onUserViewport={onUserViewport}
        />
        {!mapReady && <MapLoadingVeil />}
      </APIProvider>
      {mapReady && <SearchMapReticle />}
    </div>
  );
}

/** Rail / pin / GPS pans stay programmatic until a real finger-drag.
 *  A time window leaked: a slow panTo idle fired after 600ms and
 *  counted catalog browsing as travel. dragstart is the only user
 *  gesture that may accrue Reload after. */
let cameraMoveIsProgrammatic = false;

function noteProgrammaticCamera() {
  cameraMoveIsProgrammatic = true;
}

function noteUserMapDrag() {
  cameraMoveIsProgrammatic = false;
}

function isProgrammaticIdle() {
  return cameraMoveIsProgrammatic;
}

/** Screen-fixed sight at the canvas center — the catalog fetch point.
 *  Plus + primary dot only. No ring: that read as a measured radius. */
export function SearchMapReticle() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center"
    >
      <div className="relative h-3.5 w-3.5">
        <div className="bg-foreground absolute top-1/2 left-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="bg-foreground absolute top-1/2 left-1/2 h-0.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="bg-primary absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
      </div>
    </div>
  );
}

// Muted skeleton veil that hides the blank canvas until tiles paint.
// Renders nothing once the SDK reports a load failure — an error state
// must never sit under an eternal skeleton. z-10 keeps it above the map
// but below the page's floating search chrome (z-20/z-30).
function MapLoadingVeil() {
  const status = useApiLoadingStatus();
  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return null;
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner
          label="Loading map"
          className="border-border border-t-primary"
        />
      </div>
    </div>
  );
}

function hasCoords(
  place: Place,
): place is Place & { lat: number; lng: number } {
  return typeof place.lat === "number" && typeof place.lng === "number";
}

function SearchMapCanvas({
  places,
  userLocation,
  viewCenter,
  selectedId,
  pins,
  onSelectPlace,
  onOpenPlace,
  onSelectPin,
  onMapClick,
  onReady,
  onFirstViewport,
  onUserViewport,
}: {
  places: Place[];
  userLocation: Coords | null;
  viewCenter: Coords | null;
  selectedId: string | null;
  pins?: SearchMapPin[] | null;
  onSelectPlace: (place: Place) => void;
  onOpenPlace: (place: Place) => void;
  onSelectPin?: (pin: SearchMapPin) => void;
  onMapClick?: () => void;
  onReady: () => void;
  onFirstViewport?: (box: ViewportBox) => void;
  onUserViewport?: (
    box: ViewportBox,
    meta: { programmatic: boolean },
  ) => void;
}) {
  const located = places.filter(hasCoords);
  const lookAt = viewCenter ?? userLocation;
  const selected = pins != null
    ? (pins.find((p) => p.id === selectedId) ?? null)
    : (located.find((p) => p.id === selectedId) ?? null);
  const selectedLat = selected?.lat ?? null;
  const selectedLng = selected?.lng ?? null;

  return (
    <Map
      defaultCenter={lookAt ?? MONTERREY_CENTER}
      defaultZoom={lookAt ? MAP_USER_ZOOM : MAP_DEFAULT_ZOOM}
      gestureHandling="greedy"
      disableDefaultUI
      clickableIcons={false}
      reuseMaps
      draggableCursor={MAP_PIN_CURSOR}
      draggingCursor={MAP_PIN_CURSOR}
      className="absolute inset-0 h-full w-full cursor-default [&_*]:!cursor-default"
      colorScheme="LIGHT"
      styles={
        MAP_MINIMAL_STYLES as unknown as Parameters<typeof Map>[0]["styles"]
      }
      onTilesLoaded={onReady}
      // Bare canvas tap toggles the name overlay. Pan/drag does not
      // fire click — SearchClient closes the overlay from onUserViewport.
      onClick={onMapClick ? () => onMapClick() : undefined}
    >
      {userLocation && (
        <Marker
          position={userLocation}
          title="You're here"
          icon={userIcon()}
          clickable={false}
          cursor={MAP_PIN_CURSOR}
        />
      )}
      {pins != null
        ? pins.map((pin) => (
            <Marker
              key={pin.id}
              position={{ lat: pin.lat, lng: pin.lng }}
              title={pin.title}
              icon={placeIcon(pin.tone, pin.id === selectedId)}
              zIndex={pin.id === selectedId ? 10 : 0}
              optimized={false}
              cursor={MAP_PIN_CURSOR}
              onClick={() => onSelectPin?.(pin)}
            />
          ))
        : located.map((place) => (
            <Marker
              key={place.id}
              position={{ lat: place.lat, lng: place.lng }}
              title={place.name}
              icon={placeIcon(
                placeMembershipTone(place),
                place.id === selectedId,
              )}
              zIndex={place.id === selectedId ? 10 : 0}
              optimized={false}
              cursor={MAP_PIN_CURSOR}
              // First tap selects (membership fill + black ring + rail); later tap opens.
              onClick={() =>
                place.id === selectedId
                  ? onOpenPlace(place)
                  : onSelectPlace(place)
              }
            />
          ))}
      <Recentre target={lookAt} />
      {selectedLat != null && selectedLng != null && (
        <PanTo lat={selectedLat} lng={selectedLng} />
      )}
      <ViewportReporter
        onFirst={onFirstViewport}
        onUser={onUserViewport}
      />
    </Map>
  );
}

function ViewportReporter({
  onFirst,
  onUser,
}: {
  onFirst?: (box: ViewportBox) => void;
  onUser?: (box: ViewportBox, meta: { programmatic: boolean }) => void;
}) {
  const map = useMap();
  const first = useRef(true);

  useEffect(() => {
    if (!map) return;
    const drag = map.addListener("dragstart", noteUserMapDrag);
    const listener = map.addListener("idle", () => {
      const box = readViewportBox(map);
      if (!box) return;
      if (first.current) {
        first.current = false;
        onFirst?.(box);
        return;
      }
      onUser?.(box, { programmatic: isProgrammaticIdle() });
    });
    return () => {
      drag.remove();
      listener.remove();
    };
  }, [map, onFirst, onUser]);

  return null;
}

// Shared by Recentre/PanTo: pan to the target, and bump zoom in only if
// it's currently more zoomed-out than the user-focused level (never zooms
// the consumer's own framing back out).
function panAndEnsureZoom(
  map: NonNullable<ReturnType<typeof useMap>>,
  target: Coords,
) {
  noteProgrammaticCamera();
  map.panTo(target);
  if ((map.getZoom() ?? MAP_DEFAULT_ZOOM) < MAP_USER_ZOOM) {
    map.setZoom(MAP_USER_ZOOM);
  }
}

// Pan to the look-at center (filter zone, else the device) once it resolves.
function Recentre({ target }: { target: Coords | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    panAndEnsureZoom(map, target);
  }, [map, target]);
  return null;
}

// Pan to whichever pin/rail card the consumer just picked. Primitive
// lat/lng deps (not a fresh object literal) so the effect fires only when
// the SELECTION changes — re-renders must never fight the user's panning.
function PanTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    panAndEnsureZoom(map, { lat, lng });
  }, [map, lat, lng]);
  return null;
}
