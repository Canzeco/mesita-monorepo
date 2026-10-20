// THE SEARCH MAP NEVER TELEPORTS (MESITA-2440, Pato 2026-10-19: "Don't
// teleport in the map. Check Google instead.").
//
// The camera moves only when the guest asked it to, the way Google Maps
// behaves:
//   • first load — the first GPS fix centres the map once, unless the guest
//     already moved it or picked something;
//   • the location disc — centre on the guest;
//   • a pin or rail-card TAP — pan only when the place is off-screen;
//   • a search-bar pick — centre on the place, or fit a Location's viewport.
// It never moves on a later GPS fix, a rail SCROLL (that only rings the pin)
// or a catalog reload, and it never changes the zoom the guest chose; the
// one exception is the first-load fix, which zooms IN to street level when
// the map still shows the default city.
//
// A move the guest made reloads the area when the map comes to rest, at
// most once every `reloadIdleSec`, counted from the LAST RELOAD, not the
// last move, and with no distance gate (Pato, MESITA-2451).

import { haversineKm } from "@/lib/utils";
import type { ViewportBox } from "./SearchMap";
import { centerForSight, viewportSight } from "./search-utils";

type LatLng = { lat: number; lng: number };

/** What the page asks of the camera. `gen` makes every ask fire, even a
 *  repeat of the same coordinates (re-centre after wandering off). */
export type CameraIntent =
  | { gen: number; kind: "reveal"; lat: number; lng: number }
  | {
      gen: number;
      kind: "center";
      lat: number;
      lng: number;
      /** Zoom in to this level if the map is further out. First load only. */
      minZoom?: number;
    }
  | {
      gen: number;
      kind: "fit";
      bounds: { south: number; west: number; north: number; east: number };
    };

export type CameraStep =
  | { kind: "none" }
  | { kind: "pan"; lat: number; lng: number; zoom: number | null }
  | {
      kind: "fit";
      bounds: { south: number; west: number; north: number; east: number };
    };

/** What a selection came from. Only a scroll leaves the camera alone. */
export type SelectionSource = "pin" | "card" | "scroll";

export function selectionMovesCamera(source: SelectionSource): boolean {
  return source !== "scroll";
}

/**
 * Does a GPS fix move the camera? Only the one the guest asked for (the
 * location disc with no fix yet), or the very first fix when nothing else
 * has claimed the camera. Every later fix only moves the blue dot.
 */
export function gpsFixMovesCamera(fix: {
  asked: boolean;
  firstFix: boolean;
  userMoved: boolean;
  picked: boolean;
}): boolean {
  if (fix.asked) return true;
  return fix.firstFix && !fix.userMoved && !fix.picked;
}

/**
 * The share of the map the page's own chrome covers, so a place under the
 * bottom rail counts as off-screen. Fractions of the viewport's height or
 * width, measured from each edge.
 */
export const VIEW_INSETS = {
  top: 0.06,
  bottom: 0.38,
  left: 0.08,
  right: 0.08,
} as const;

type Insets = { top: number; bottom: number; left: number; right: number };

/** Is the target inside the part of the viewport the guest can see? */
export function isTargetVisible(
  view: ViewportBox,
  target: LatLng,
  insets: Insets = VIEW_INSETS,
): boolean {
  const height = view.north - view.south;
  if (!(height > 0)) return false;
  const north = view.north - height * insets.top;
  const south = view.south + height * insets.bottom;
  if (target.lat > north || target.lat < south) return false;
  // west > east is the dateline wrap: unwrap east by a full turn.
  const east = view.west <= view.east ? view.east : view.east + 360;
  const width = east - view.west;
  if (!(width > 0)) return false;
  let lng = target.lng;
  if (lng < view.west) lng += 360;
  return (
    lng >= view.west + width * insets.left && lng <= east - width * insets.right
  );
}

/** About a metre: a centre this close is already where it was asked. */
const SAME_SPOT_KM = 0.001;

/** Turn an intent into the camera call it owes, given where the map is. */
export function cameraStep(
  intent: CameraIntent,
  view: ViewportBox | null,
  zoom: number | null,
): CameraStep {
  if (intent.kind === "fit") return { kind: "fit", bounds: intent.bounds };
  const target = { lat: intent.lat, lng: intent.lng };
  // The target lands under the sight (SIGHT_Y, MESITA-2448), not the
  // canvas centre, so it sits above the rail. With no view yet there is no
  // span to offset by: the centre itself.
  const under = (scale: number) =>
    view ? centerForSight(view, target, scale) : target;
  if (intent.kind === "reveal") {
    if (view && isTargetVisible(view, target)) return { kind: "none" };
    return { kind: "pan", ...under(1), zoom: null };
  }
  const nextZoom =
    intent.minZoom != null && (zoom == null || zoom < intent.minZoom)
      ? intent.minZoom
      : null;
  if (view && nextZoom == null) {
    const { lat, lng } = viewportSight(view);
    if (haversineKm(lat, lng, target.lat, target.lng) < SAME_SPOT_KM) {
      return { kind: "none" };
    }
  }
  const scale = nextZoom != null && zoom != null ? 2 ** (zoom - nextZoom) : 1;
  return { kind: "pan", ...under(scale), zoom: nextZoom };
}

/** How long the map must be still after a guest move before it reloads. */
export const RELOAD_IDLE_SEC_DEFAULT = 1.5;
const RELOAD_IDLE_SEC_MIN = 0.5;
const RELOAD_IDLE_SEC_MAX = 10;

export function clampReloadIdleSec(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return RELOAD_IDLE_SEC_DEFAULT;
  }
  return Math.min(RELOAD_IDLE_SEC_MAX, Math.max(RELOAD_IDLE_SEC_MIN, raw));
}

/**
 * How long a guest move waits before it reloads (Pato, MESITA-2451: "if
 * more than n seconds have happened since last reload"). Counted from the
 * last reload: none yet, or `minGapMs` already gone, reloads at once;
 * otherwise it waits out the rest of the gap.
 */
export function reloadWaitMs(
  lastLoadAt: number | null,
  now: number,
  minGapMs: number,
): number {
  if (lastLoadAt == null) return 0;
  return Math.max(0, lastLoadAt + minGapMs - now);
}
