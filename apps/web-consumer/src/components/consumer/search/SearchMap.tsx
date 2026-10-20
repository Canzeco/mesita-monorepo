"use client";

// The Search page's map: base layer only — the light-styled canvas, place
// pins, the user dot, and pan/zoom behaviour. It carries no page chrome of
// its own, because the page's floating search bar and catalog rail sit on
// top of it. Pin taps report up (onTapPlacePin / onSelectPin) so the page
// can count them: select, fly there, open (MESITA-2488).

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
  MAP_USER_LOCATION_STROKE_COLOR,
  MAP_USER_LOCATION_PIN_COLOR,
  mapPinIcon,
} from "@/lib/map-defaults";
import type { Coords } from "@/lib/use-user-location";
import { cn } from "@/lib/utils";
import { cameraStep, type CameraIntent } from "./camera-intent";
import { SIGHT_Y } from "./search-utils";
import {
  pinFillColor,
  pinStrokeColor,
  pinStrokeWeight,
  placePinTone,
  type PinTone,
} from "./search-pins";

type MapsCtor = {
  Size: new (w: number, h: number) => { width: number; height: number };
  Point: new (x: number, y: number) => { x: number; y: number };
};

function mapsPinIcon(
  fillColor: string,
  strokeColor: string,
  strokeWeight?: number,
) {
  const raw = mapPinIcon(fillColor, strokeColor, strokeWeight);
  const maps = (globalThis as { google?: { maps?: MapsCtor } }).google?.maps;
  if (!maps) return raw;
  return {
    url: raw.url,
    scaledSize: new maps.Size(MAP_PIN_HIT_SIZE, MAP_PIN_HIT_SIZE),
    anchor: new maps.Point(MAP_PIN_HIT_SIZE / 2, MAP_PIN_HIT_SIZE / 2),
  };
}

function placeIcon(tone: PinTone, isSelected: boolean) {
  const weight = pinStrokeWeight(isSelected);
  return mapsPinIcon(
    pinFillColor(tone, isSelected),
    pinStrokeColor(isSelected),
    weight,
  );
}

function userIcon() {
  return mapsPinIcon(
    MAP_USER_LOCATION_PIN_COLOR,
    MAP_USER_LOCATION_STROKE_COLOR,
  );
}

export type SearchMapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  tone: PinTone;
};

export type ViewportBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type MapInstance = NonNullable<ReturnType<typeof useMap>>;

function readViewportBox(map: MapInstance): ViewportBox | null {
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
  selectedId,
  pins,
  searching = false,
  cameraIntent,
  onTapPlacePin,
  onSelectPin,
  onFirstViewport,
  onUserViewport,
  onCameraMoveStart,
}: {
  apiKey: string;
  places: Place[];
  userLocation: Coords | null;
  selectedId: string | null;
  pins?: SearchMapPin[] | null;
  /** A catalog load is in flight: the search ring pulses (MESITA-2508). */
  searching?: boolean;
  /**
   * The ONLY way the page moves the camera (MESITA-2440): an explicit ask
   * — first load, the location disc, a tap, a bar pick. `selectedId` only
   * rings a pin; it never pans, so a rail scroll or the card-0 fallback
   * cannot drag the map around.
   */
  cameraIntent?: CameraIntent | null;
  /** A catalog pin was tapped; the page counts the taps (select · fly ·
   *  open, MESITA-2488). */
  onTapPlacePin: (place: Place) => void;
  onSelectPin?: (pin: SearchMapPin) => void;
  onFirstViewport?: (box: ViewportBox) => void;
  onUserViewport?: (box: ViewportBox, meta: { programmatic: boolean }) => void;
  /** The camera started moving: a pending reload is cancelled. */
  onCameraMoveStart?: () => void;
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
          selectedId={selectedId}
          pins={pins}
          cameraIntent={cameraIntent}
          onTapPlacePin={onTapPlacePin}
          onSelectPin={onSelectPin}
          onReady={handleMapReady}
          onFirstViewport={onFirstViewport}
          onUserViewport={onUserViewport}
          onCameraMoveStart={onCameraMoveStart}
        />
        {!mapReady && <MapLoadingVeil />}
      </APIProvider>
      {mapReady && <SearchMapReticle searching={searching} />}
    </div>
  );
}

/** A camera move the PAGE made (a tap's reveal, the location disc, a bar
 *  pick) is programmatic: its idle rebases the reload origin instead of
 *  counting as travel. The flag is spent by the idle that ends the move, and
 *  a finger-drag clears it at once — a time window leaked (a slow panTo idle
 *  fired after 600ms and counted catalog browsing as travel), and a flag
 *  that only dragstart cleared turned a later pinch-zoom into "programmatic"
 *  too. Only cameraStep's real moves set it, so a no-op never strands it. */
let cameraMoveIsProgrammatic = false;

function noteProgrammaticCamera() {
  cameraMoveIsProgrammatic = true;
}

function noteUserMapDrag() {
  cameraMoveIsProgrammatic = false;
}

function takeProgrammaticIdle() {
  const programmatic = cameraMoveIsProgrammatic;
  cameraMoveIsProgrammatic = false;
  return programmatic;
}

/** A finger (or mouse button) is on the map: no reload fires under it. */
let fingerOnMap = false;

export function mapFingerIsDown(): boolean {
  return fingerOnMap;
}

/** Screen-fixed sight SIGHT_Y down the canvas (45%; MESITA-2448,
 *  MESITA-2505) — the catalog fetch point: the plus, its dot, and THE
 *  SEARCH RING (Pato, MESITA-2508: "keep the circle, but make it doted …
 *  and move it realative to the cruz … it must feel more dynamic"). The ring
 *  is the circle the next load searches — diameter = the map's width, the
 *  server's screen radius (MESITA-2507) — dashed, riding the cross while the
 *  guest pans; the map outside it is shaded a touch, and it pulses while a
 *  load is in flight. */
function SearchMapReticle({ searching }: { searching: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-[15] flex -translate-y-1/2 justify-center"
      style={{ top: `${SIGHT_Y * 100}%` }}
      data-search-sight
    >
      <div
        className={cn(
          "border-foreground/45 absolute top-1/2 left-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed shadow-[0_0_0_200vmax_rgb(0_0_0/0.04)]",
          searching && "animate-pulse",
        )}
        data-search-ring
      />
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
  selectedId,
  pins,
  cameraIntent,
  onTapPlacePin,
  onSelectPin,
  onReady,
  onFirstViewport,
  onUserViewport,
  onCameraMoveStart,
}: {
  places: Place[];
  userLocation: Coords | null;
  selectedId: string | null;
  pins?: SearchMapPin[] | null;
  cameraIntent?: CameraIntent | null;
  /** A catalog pin was tapped; the page counts the taps (select · fly ·
   *  open, MESITA-2488). */
  onTapPlacePin: (place: Place) => void;
  onSelectPin?: (pin: SearchMapPin) => void;
  onReady: () => void;
  onFirstViewport?: (box: ViewportBox) => void;
  onUserViewport?: (box: ViewportBox, meta: { programmatic: boolean }) => void;
  onCameraMoveStart?: () => void;
}) {
  const located = places.filter(hasCoords);

  return (
    <Map
      // Uncontrolled: these are read once, at mount. Every later move is a
      // CameraIntent the guest asked for.
      defaultCenter={userLocation ?? MONTERREY_CENTER}
      defaultZoom={userLocation ? MAP_USER_ZOOM : MAP_DEFAULT_ZOOM}
      gestureHandling="greedy"
      disableDefaultUI
      // `disableDefaultUI` does NOT cover this one. Google keeps a "Keyboard
      // shortcuts" button in the bottom attribution strip, which on a phone is
      // an offer of a keyboard the guest cannot use, sitting in the few pixels
      // of map the result card has not already taken. The attribution and
      // Terms beside it are Google's licence terms and stay.
      keyboardShortcuts={false}
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
              icon={placeIcon(placePinTone(place), place.id === selectedId)}
              zIndex={place.id === selectedId ? 10 : 0}
              optimized={false}
              cursor={MAP_PIN_CURSOR}
              // Select (ink pin + rail) · fly there · open — the page counts.
              onClick={() => onTapPlacePin(place)}
            />
          ))}
      {cameraIntent && <CameraDirector intent={cameraIntent} />}
      <ViewportReporter
        onFirst={onFirstViewport}
        onUser={onUserViewport}
        onMoveStart={onCameraMoveStart}
      />
    </Map>
  );
}

function ViewportReporter({
  onFirst,
  onUser,
  onMoveStart,
}: {
  onFirst?: (box: ViewportBox) => void;
  onUser?: (box: ViewportBox, meta: { programmatic: boolean }) => void;
  onMoveStart?: () => void;
}) {
  const map = useMap();
  const first = useRef(true);

  useEffect(() => {
    if (!map) return;
    const drag = map.addListener("dragstart", () => {
      noteUserMapDrag();
      onMoveStart?.();
    });
    // Any camera change — drag, pinch, wheel, an animated pan — cancels a
    // pending reload; the idle that ends it decides again.
    const moving = map.addListener("bounds_changed", () => onMoveStart?.());
    const listener = map.addListener("idle", () => {
      const box = readViewportBox(map);
      if (!box) return;
      if (first.current) {
        first.current = false;
        takeProgrammaticIdle();
        onFirst?.(box);
        return;
      }
      onUser?.(box, { programmatic: takeProgrammaticIdle() });
    });
    // NO RELOAD UNDER A FINGER: a due reload waits while one rests on the
    // map (the page re-arms it), and a finger that lifts without moving
    // leaves it due. Capture phase, because the map's own handlers stop the
    // event; the lift is read on window, since a finger can leave the map
    // before it lifts.
    const div = map.getDiv();
    const down = () => {
      fingerOnMap = true;
    };
    const up = () => {
      fingerOnMap = false;
    };
    div.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      drag.remove();
      moving.remove();
      listener.remove();
      div.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      fingerOnMap = false;
    };
  }, [map, onFirst, onUser, onMoveStart]);

  return null;
}

// The one place the camera moves. Keyed on the intent OBJECT — each ask is
// a fresh one (`gen` keeps them distinct), so re-asking the same spot moves
// again after the guest wandered off, while plain re-renders (the object is
// state-held, never a literal) fight nobody. `cameraStep` decides: a reveal
// that is already on screen does nothing, a centre pans (panTo animates
// when the hop is short, as on Google Maps) and keeps the guest's zoom, a
// Location fits its viewport.
function CameraDirector({ intent }: { intent: CameraIntent }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const step = cameraStep(
      intent,
      readViewportBox(map),
      map.getZoom() ?? null,
    );
    if (step.kind === "none") return;
    noteProgrammaticCamera();
    if (step.kind === "fit") {
      map.fitBounds(step.bounds);
      return;
    }
    map.panTo({ lat: step.lat, lng: step.lng });
    if (step.zoom != null) map.setZoom(step.zoom);
  }, [map, intent]);
  return null;
}
