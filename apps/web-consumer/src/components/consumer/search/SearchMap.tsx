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
import {
  MONTERREY_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_USER_ZOOM,
  MAP_MINIMAL_STYLES,
  MAP_PIN_CURSOR,
  MAP_PIN_HIT_SIZE,
  MAP_USER_LOCATION_STROKE_COLOR,
  MAP_USER_LOCATION_PIN_COLOR,
  MAP_SELECTED_PLACE_PIN_RADIUS,
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
import { SIGHT_Y } from "./search-utils";
import { MapVeil } from "./search-catalog-overlays";
import { SearchMapPinLabels } from "./SearchMapPinLabels";
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
  radius?: number,
) {
  const raw = mapPinIcon(fillColor, strokeColor, strokeWeight, radius);
  const maps = (globalThis as { google?: { maps?: MapsCtor } }).google?.maps;
  if (!maps) return raw;
  return {
    url: raw.url,
    scaledSize: new maps.Size(MAP_PIN_HIT_SIZE, MAP_PIN_HIT_SIZE),
    anchor: new maps.Point(MAP_PIN_HIT_SIZE / 2, MAP_PIN_HIT_SIZE / 2),
  };
}

/** `held` is the tapped pin (ink, MESITA-2488), not the Selected tone. */
function placeIcon(tone: PinTone, held: boolean) {
  const weight = pinStrokeWeight(held);
  const radius =
    tone === "selected" && !held ? MAP_SELECTED_PLACE_PIN_RADIUS : undefined;
  return mapsPinIcon(
    pinFillColor(tone, held),
    pinStrokeColor(held),
    weight,
    radius,
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
  onLiveViewport,
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
  onUserViewport?: (box: ViewportBox, meta: ViewportMeta) => void;
  /** The camera started moving: a pending reload is cancelled. */
  onCameraMoveStart?: () => void;
  /** Every camera change, once a frame, while dragging too: the view as it
   *  is now, for the live readout (MESITA-2512). Never loads. */
  onLiveViewport?: (box: ViewportBox) => void;
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
    // A size container, so the search ring can read the map's height
    // (cqh) as well as its width (MESITA-2511).
    <div className="[container-type:size] absolute inset-0 overflow-hidden">
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
          onLiveViewport={onLiveViewport}
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

/** The search ring's diameter: twice the cross's distance to the nearest
 *  edge of the map — the full width, or twice the gap to the nearer of top
 *  and bottom, whichever is smaller (MESITA-2511), the server's screen
 *  radius on screen. Container units of the map's box. */
export const SEARCH_RING_SIZE = `min(100cqw, ${
  Math.round(2 * Math.min(SIGHT_Y, 1 - SIGHT_Y) * 1000) / 10
}cqh)`;

/** Screen-fixed sight SIGHT_Y down the canvas (the middle; MESITA-2448,
 *  MESITA-2514) — the catalog fetch point: the plus, its dot, and THE
 *  SEARCH RING (Pato, MESITA-2508: "keep the circle, but make it doted …
 *  and move it realative to the cruz … it must feel more dynamic"). The ring
 *  is the circle the next load searches — the server's screen radius, the
 *  cross's distance to the nearest edge, so it always fits on the map
 *  (MESITA-2511) — dashed, riding the cross while the guest pans, and it
 *  pulses while a load is in flight. A second, solid ring at half the
 *  diameter says the centre is denser (Pato, MESITA-2773: "double circle for
 *  density") — the proximity half-strength distance at the default
 *  radiusDivisor of 2 (MESITA-2720). The shade brightens toward the cross, a
 *  spotlight: the map outside the big ring darkest, the band gray, the small
 *  ring's disc light (Pato, MESITA-2775: "dark, gray, light (background, big
 *  circle, small circle)"). One shade disc under the rings draws all three
 *  steps — a spread shadow outside, a radial gradient clear inside half its
 *  radius — so no tint stacks, the map box clips the shadow, and only the
 *  ring lines pulse, never the shade. */
function SearchMapReticle({ searching }: { searching: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-[15] flex -translate-y-1/2 justify-center"
      style={{ top: `${SIGHT_Y * 100}%` }}
      data-search-sight
    >
      <div
        className="absolute top-1/2 left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_closest-side,rgb(255_255_255/0.12)_50%,rgb(0_0_0/0.05)_50%)] shadow-[0_0_0_200vmax_rgb(0_0_0/0.1)]"
        style={{ width: SEARCH_RING_SIZE }}
        data-search-shade
      />
      <div
        className={cn(
          "border-foreground/45 absolute top-1/2 left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed",
          searching && "animate-pulse",
        )}
        style={{ width: SEARCH_RING_SIZE }}
        data-search-ring
      />
      <div
        className={cn(
          "border-foreground/30 absolute top-1/2 left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border",
          searching && "animate-pulse",
        )}
        style={{ width: `calc(${SEARCH_RING_SIZE} / 2)` }}
        data-search-ring-inner
      />
      <div className="relative h-3.5 w-3.5">
        <div className="bg-foreground absolute top-1/2 left-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="bg-foreground absolute top-1/2 left-1/2 h-0.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="bg-primary absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
      </div>
    </div>
  );
}

// Muted skeleton veil that hides the blank canvas until tiles paint — the
// same MapVeil search/loading.tsx draws, so the route's skeleton hands over
// without a move (MESITA-2701). Renders nothing once the SDK reports a load
// failure — an error state must never sit under an eternal skeleton.
function MapLoadingVeil() {
  const status = useApiLoadingStatus();
  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return null;
  }
  return <MapVeil />;
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
  onLiveViewport,
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
  onUserViewport?: (box: ViewportBox, meta: ViewportMeta) => void;
  onCameraMoveStart?: () => void;
  onLiveViewport?: (box: ViewportBox) => void;
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
