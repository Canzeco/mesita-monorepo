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
import type { MapDot, Place } from "@/lib/api/places";
import {
  MONTERREY_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_USER_ZOOM,
  MAP_WAIT_COLOR,
  MAP_MINIMAL_STYLES,
  MAP_PIN_CURSOR,
  MAP_PIN_HIT_SIZE,
  MAP_PIN_STROKE_COLOR,
  MAP_USER_LOCATION_STROKE_COLOR,
  MAP_USER_LOCATION_PIN_COLOR,
  MAP_DOT_RADIUS,
  MAP_DOT_SIZE,
  mapDotIcon,
  mapPinIcon,
} from "@/lib/map-defaults";
import type { Coords } from "@/lib/use-user-location";
import { cn } from "@/lib/utils";
import {
  cameraStep,
  sameCamera,
  type CameraIntent,
  type CameraState,
} from "./camera-intent";
import { RING_INSET } from "./search-utils";
import {
  MapVeil,
  SIGHT_BOTTOM_CSS,
  SIGHT_MID_TOP,
  SIGHT_TOP_CSS,
} from "./search-catalog-overlays";
import { SearchMapPinLabels } from "./SearchMapPinLabels";
import {
  pinFillColor,
  pinToneColor,
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
  radius?: number,
) {
  const raw = mapPinIcon(fillColor, strokeColor, strokeWeight, radius);
  const maps = (globalThis as { google?: { maps?: Partial<MapsCtor> } }).google
    ?.maps;
  // THE NAMESPACE COMES BEFORE ITS CLASSES (MESITA-3027). The Maps loader
  // defines `google.maps` first and fills in Size and Point when the core
  // library lands, so a pin drawn in between threw "Size is not a
  // constructor" and took the whole Search screen down. Until both exist the
  // plain icon draws; the next render, once they do, sizes it.
  if (typeof maps?.Size !== "function" || typeof maps.Point !== "function") {
    return raw;
  }
  return {
    url: raw.url,
    scaledSize: new maps.Size(MAP_PIN_HIT_SIZE, MAP_PIN_HIT_SIZE),
    anchor: new maps.Point(MAP_PIN_HIT_SIZE / 2, MAP_PIN_HIT_SIZE / 2),
  };
}

/** `held` is the tapped pin (purple). Premier is red. Every disk is the
 *  same size (MESITA-5001, Pato: the red dot matches black, purple, blue). */
function placeIcon(tone: PinTone, held: boolean) {
  return mapsPinIcon(
    pinFillColor(tone, held),
    pinStrokeColor(held),
    pinStrokeWeight(held),
  );
}

/** The dot (MESITA-3980): the pin's own colour — black, or red for
 *  Premier (MESITA-3992) — ringed white so it reads on the basemap. */
function dotIcon(premier: boolean) {
  const raw = mapDotIcon(
    pinToneColor(premier ? "premier" : "mesita"),
    MAP_PIN_STROKE_COLOR,
    MAP_DOT_RADIUS,
  );
  const maps = (globalThis as { google?: { maps?: Partial<MapsCtor> } }).google
    ?.maps;
  if (typeof maps?.Size !== "function" || typeof maps.Point !== "function") {
    return raw;
  }
  return {
    url: raw.url,
    scaledSize: new maps.Size(MAP_DOT_SIZE, MAP_DOT_SIZE),
    anchor: new maps.Point(MAP_DOT_SIZE / 2, MAP_DOT_SIZE / 2),
  };
}

/**
 * THE STACK (Pato, MESITA-4014: "purple > blue > black > dots … and
 * remember red"): purple (the selected pin) over the blue you-are-here dot,
 * over red Premier pins, over black pins, over red dots, over black dots.
 * No black circle ever covers the blue or the purple. Every marker is drawn
 * unoptimized so Maps honours one z order across all of them (an optimized
 * marker sits on its own canvas layer, outside the order).
 */
const Z = {
  dot: 1,
  premierDot: 2,
  pin: 10,
  premierPin: 11,
  you: 100,
  selected: 200,
} as const;

function pinZ(tone: PinTone, held: boolean): number {
  if (held) return Z.selected;
  return tone === "premier" ? Z.premierPin : Z.pin;
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

/** Why an idle happened: the page moved the camera (`programmatic`), or
 *  nothing did and the map was only resized (`resized`, MESITA-2510);
 *  neither is the guest's move. */
export type ViewportMeta = { programmatic: boolean; resized: boolean };

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
  dots = [],
  userLocation,
  chosenLocation,
  selectedId,
  pins,
  searching = false,
  cameraIntent,
  onTapPlacePin,
  onSelectPin,
  onFirstViewport,
  onMapFailed,
  onUserViewport,
  onCameraMoveStart,
  onLiveViewport,
}: {
  apiKey: string;
  /** Where the map opens with no device fix. */
  chosenLocation: Coords | null;
  places: Place[];
  /** Places n+1…m of this view (MESITA-3980): small, no label, no tap. */
  dots?: MapDot[];
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
  /** The Maps script failed: no viewport will ever report. */
  onMapFailed?: () => void;
  onUserViewport?: (box: ViewportBox, meta: ViewportMeta) => void;
  /** The camera started moving: a pending reload is cancelled. */
  onCameraMoveStart?: () => void;
  /** Every camera change, once a frame, while dragging too: the view as it
   *  is now, for the live readout (MESITA-2512). Never loads. */
  onLiveViewport?: (box: ViewportBox) => void;
}) {
  // The Maps SDK bootstrap + first tile paint leave the canvas blank for a
  // beat — hold a green skeleton veil over it until tiles actually land
  // (or the SDK load fails, so the veil can't sit there forever).
  const [mapReady, setMapReady] = useState(false);
  const handleMapReady = useCallback(() => setMapReady(true), []);

  // No key → the overlays (search, Ask AI, rail) still work; the base
  // layer degrades to a branded hero wash instead of a dead screen.
  if (!apiKey) {
    return (
      <div className="bg-hero absolute inset-0">
        <div className="text-muted-foreground bg-card/90 shadow-elev type-label absolute bottom-40 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold backdrop-blur">
          <MapPin className="h-3 w-3" />
          Live map coming soon
        </div>
      </div>
    );
  }

  return (
    // A size container, so the search ring can read the map's height
    // (cqh) as well as its width (MESITA-2511).
    <div className="[container-type:size] absolute inset-0 overflow-hidden">
      <APIProvider apiKey={apiKey} libraries={["places"]}>
        <SearchMapCanvas
          places={places}
          dots={dots}
          userLocation={userLocation}
          chosenLocation={chosenLocation}
          selectedId={selectedId}
          pins={pins}
          cameraIntent={cameraIntent}
          onTapPlacePin={onTapPlacePin}
          onSelectPin={onSelectPin}
          onReady={handleMapReady}
          onFirstViewport={onFirstViewport}
          onUserViewport={onUserViewport}
          onCameraMoveStart={onCameraMoveStart}
          onLiveViewport={onLiveViewport}
        />
        {!mapReady && <MapLoadingVeil onGiveUp={handleMapReady} />}
        <MapFailureReporter onFailed={onMapFailed} />
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

/** The search ring's diameter: RING_INSET of the clear window's smaller
 *  side — its full width, or its height between the chips and the cards
 *  (MESITA-3020; MESITA-2511 measured the whole canvas), the server's
 *  screen radius on screen. Container units of the map's box. */
const SEARCH_RING_SIZE = `min(${Math.round(RING_INSET * 1000) / 10}cqw, calc(${
  Math.round(RING_INSET * 1000) / 10
}cqh * (${SIGHT_BOTTOM_CSS} - ${SIGHT_TOP_CSS})))`;

/** Screen-fixed sight at the clear window's middle (MESITA-3020; MESITA-2448,
 *  MESITA-2514) — the catalog fetch point, marked by ONE
 *  DISCREET WHITE RING for the search radius (Pato, MESITA-2908: "draw the
 *  circle of the radious, but only one circle, not two, make the radious
 *  kinda white, like really discreet and pretty"). MESITA-2906 had removed
 *  both dashed rings; the inner density ring (MESITA-2773) stays gone. A
 *  solid 3px white line with a thin dark outline and a soft glow, so it
 *  reads on the light basemap (MESITA-2912: "a bit more visible"; MESITA-2908
 *  drew 2px at 85% with a hair halo), and a whisper of white fill. It pulses during a load; the cross
 *  that sat at its centre is gone (MESITA-2917). Screen CSS, never map geometry (MESITA-2847: it rides the
 *  cross in real time). */
const RING_CLASS =
  "absolute top-1/2 left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-white/[0.06] shadow-[0_0_0_1px_rgba(0,0,0,0.18),inset_0_0_0_0.5px_rgba(0,0,0,0.10),0_1px_6px_rgba(0,0,0,0.12)]";

function SearchMapReticle({ searching }: { searching: boolean }) {
  // The ring rides the measured clear window (MESITA-3020) through CSS
  // variables SearchClient writes (MESITA-3035): always centred between the
  // chips and the cards, whatever the phone's height, with no re-render.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-[15] flex -translate-y-1/2 justify-center"
      style={{ top: SIGHT_MID_TOP }}
      data-search-sight
    >
      {/* No cross (Pato, MESITA-2917: "remove the cruz as the center, the
          circle is enough"): the ring alone marks the sight, and it is
          what pulses while a load is in flight. */}
      <div
        className={cn(RING_CLASS, searching && "animate-pulse")}
        style={{ width: SEARCH_RING_SIZE }}
        data-search-ring
      />
    </div>
  );
}

// Green skeleton veil that hides the blank canvas until tiles paint — the
// same MapVeil search/loading.tsx draws, so the route's skeleton hands over
// without a move (MESITA-2701). Renders nothing once the SDK reports a load
// failure — an error state must never sit under an eternal skeleton.
// IT ALWAYS LIFTS (MESITA-4814): a reused map may not report its tiles again,
// so 1.5s after the SDK is up it goes; the canvas under it is green too.
function MapLoadingVeil({ onGiveUp }: { onGiveUp: () => void }) {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status !== APILoadingStatus.LOADED) return;
    const t = setTimeout(onGiveUp, 1500);
    return () => clearTimeout(t);
  }, [status, onGiveUp]);
  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return null;
  }
  return <MapVeil />;
}

function MapFailureReporter({ onFailed }: { onFailed?: () => void }) {
  const status = useApiLoadingStatus();
  const failed =
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE;
  useEffect(() => {
    if (failed) onFailed?.();
  }, [failed, onFailed]);
  return null;
}

function hasCoords(
  place: Place,
): place is Place & { lat: number; lng: number } {
  return typeof place.lat === "number" && typeof place.lng === "number";
}

function SearchMapCanvas({
  places,
  dots,
  userLocation,
  chosenLocation,
  selectedId,
  pins,
  cameraIntent,
  onTapPlacePin,
  onSelectPin,
  onReady,
  onFirstViewport,
  onUserViewport,
  onCameraMoveStart,
  onLiveViewport,
}: {
  places: Place[];
  dots: MapDot[];
  userLocation: Coords | null;
  chosenLocation: Coords | null;
  selectedId: string | null;
  pins?: SearchMapPin[] | null;
  cameraIntent?: CameraIntent | null;
  /** A catalog pin was tapped; the page counts the taps (select · fly ·
   *  open, MESITA-2488). */
  onTapPlacePin: (place: Place) => void;
  onSelectPin?: (pin: SearchMapPin) => void;
  onReady: () => void;
  onFirstViewport?: (box: ViewportBox) => void;
  onUserViewport?: (box: ViewportBox, meta: ViewportMeta) => void;
  onCameraMoveStart?: () => void;
  onLiveViewport?: (box: ViewportBox) => void;
}) {
  const located = places.filter(hasCoords);
  const opensAt = userLocation ?? chosenLocation;

  return (
    <Map
      // Uncontrolled: these are read once, at mount. Every later move is a
      // CameraIntent the guest asked for.
      defaultCenter={opensAt ?? MONTERREY_CENTER}
      defaultZoom={opensAt ? MAP_USER_ZOOM : MAP_DEFAULT_ZOOM}
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
      backgroundColor={MAP_WAIT_COLOR}
      draggableCursor={MAP_PIN_CURSOR}
      draggingCursor={MAP_PIN_CURSOR}
      className="absolute inset-0 h-full w-full cursor-default [&_*]:!cursor-default"
      colorScheme="LIGHT"
      styles={
        MAP_MINIMAL_STYLES as unknown as Parameters<typeof Map>[0]["styles"]
      }
      onTilesLoaded={onReady}
    >
      {/* THE DOTS (Pato, MESITA-3980: "little dots means that there is
          something but i need to make zoom to load them"): under every pin
          (THE STACK), never a tap, never a label. Zooming in reloads the map and the top ones become pins. */}
      {dots.map((dot) => (
        <Marker
          key={`dot:${dot.id}`}
          position={{ lat: dot.lat, lng: dot.lng }}
          icon={dotIcon(dot.premier)}
          clickable={false}
          zIndex={dot.premier ? Z.premierDot : Z.dot}
          optimized={false}
          cursor={MAP_PIN_CURSOR}
        />
      ))}
      {userLocation && (
        <Marker
          position={userLocation}
          title="You're here"
          icon={userIcon()}
          clickable={false}
          zIndex={Z.you}
          optimized={false}
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
              zIndex={pinZ(pin.tone, pin.id === selectedId)}
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
              zIndex={pinZ(placePinTone(place), place.id === selectedId)}
              optimized={false}
              cursor={MAP_PIN_CURSOR}
              // Select (ink pin + rail) · fly there · open — the page counts.
              onClick={() => onTapPlacePin(place)}
            />
          ))}
      {cameraIntent && <CameraDirector intent={cameraIntent} />}
      <SearchMapPinLabels
        focusedId={selectedId}
        items={
          pins != null
            ? pins.map((pin) => ({
                id: pin.id,
                lat: pin.lat,
                lng: pin.lng,
                title: pin.title,
              }))
            : located.map((place) => ({
                id: place.id,
                lat: place.lat,
                lng: place.lng,
                title: place.name,
              }))
        }
      />
      <ViewportReporter
        onFirst={onFirstViewport}
        onUser={onUserViewport}
        onMoveStart={onCameraMoveStart}
        onLive={onLiveViewport}
      />
    </Map>
  );
}

function ViewportReporter({
  onFirst,
  onUser,
  onMoveStart,
  onLive,
}: {
  onFirst?: (box: ViewportBox) => void;
  onUser?: (box: ViewportBox, meta: ViewportMeta) => void;
  onMoveStart?: () => void;
  onLive?: (box: ViewportBox) => void;
}) {
  const map = useMap();
  const first = useRef(true);
  // The camera at the last idle: an idle that finds it unchanged is a
  // resize, never the guest's move (MESITA-2510).
  const lastCamera = useRef<CameraState | null>(null);

  useEffect(() => {
    if (!map) return;
    const readCamera = (): CameraState | null => {
      const c = map.getCenter();
      const zoom = map.getZoom();
      return c && typeof zoom === "number"
        ? { lat: c.lat(), lng: c.lng(), zoom }
        : null;
    };
    const drag = map.addListener("dragstart", () => {
      noteUserMapDrag();
      onMoveStart?.();
    });
    // Any camera change — drag, pinch, wheel, an animated pan — cancels a
    // pending reload; the idle that ends it decides again. It also feeds
    // the live readout, once a frame (MESITA-2512).
    let frame: number | null = null;
    const moving = map.addListener("bounds_changed", () => {
      onMoveStart?.();
      if (!onLive || frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const box = readViewportBox(map);
        if (box) onLive(box);
      });
    });
    const listener = map.addListener("idle", () => {
      const box = readViewportBox(map);
      if (!box) return;
      const camera = readCamera();
      const unmoved = sameCamera(lastCamera.current, camera);
      lastCamera.current = camera;
      if (first.current) {
        first.current = false;
        takeProgrammaticIdle();
        onFirst?.(box);
        return;
      }
      // A resize (the band under the map changed height) leaves the camera
      // where it was: it is not the guest's move — counting it as one looped
      // a reload every reloadIdleSec with no touch (MESITA-2510).
      const programmatic = takeProgrammaticIdle();
      onUser?.(box, { programmatic, resized: !programmatic && unmoved });
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
      if (frame !== null) cancelAnimationFrame(frame);
      drag.remove();
      moving.remove();
      listener.remove();
      div.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      fingerOnMap = false;
    };
  }, [map, onFirst, onUser, onMoveStart, onLive]);

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
