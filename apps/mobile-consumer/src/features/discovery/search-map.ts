// Search's map geometry, from the web's search-utils.ts, camera-intent.ts and
// map-pin-labels.ts. Pure: the screen feeds it the map's region and sizes.

import type { MapBounds } from "./api";
import type { Point } from "./model";

/** A react-native-maps region. */
export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/** The visible map's edges, degrees. */
export type Box = { north: number; south: number; east: number; west: number };

/** The ring is this share of the clear window's smaller side (the web's RING_INSET). */
export const RING_INSET = 0.9;
/** Pin names show from this zoom (the web's MAP_PIN_NAME_MIN_ZOOM). */
export const PIN_NAME_MIN_ZOOM = 14;
/** The web's first camera: 14 with a known point. */
export const START_ZOOM = 14;
/** A reload waits this long after the last one when the server names none. */
export const RELOAD_IDLE_SEC_DEFAULT = 1.5;
/** A pan reloads once it has left this share of the last-reload screen. */
export const RELOAD_MIN_VIEWPORT_PCT_DEFAULT = 15;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The web's clampReloadIdleSec. */
export function reloadIdleSec(raw: number | null): number {
  return raw === null || !Number.isFinite(raw) ? RELOAD_IDLE_SEC_DEFAULT : clamp(raw, 0.5, 10);
}

/** The web's clampReloadMinViewportPct. */
export function reloadMinViewportPct(raw: number | null): number {
  return raw === null || !Number.isFinite(raw) ? RELOAD_MIN_VIEWPORT_PCT_DEFAULT : clamp(Math.round(raw * 10) / 10, 0, 50);
}

function mercatorY(lat: number): number {
  const s = Math.sin((clamp(lat, -85.05, 85.05) * Math.PI) / 180);
  return Math.log((1 + s) / (1 - s)) / 2;
}

function latOfMercatorY(y: number): number {
  return (Math.atan(Math.sinh(y)) * 180) / Math.PI;
}

export function boxOf(r: Region): Box {
  return {
    north: r.latitude + r.latitudeDelta / 2,
    south: r.latitude - r.latitudeDelta / 2,
    east: r.longitude + r.longitudeDelta / 2,
    west: r.longitude - r.longitudeDelta / 2,
  };
}

export function boundsOf(b: Box): MapBounds {
  return { low: { lat: b.south, lng: b.west }, high: { lat: b.north, lng: b.east } };
}

/** The region whose zoom is `zoom` on a map `width` points wide, centred on `p`. */
export function regionAt(p: Point, zoom: number, width: number, height: number): Region {
  const longitudeDelta = (360 / 2 ** zoom) * (width / 256);
  const latitudeDelta = longitudeDelta * (height / Math.max(1, width)) * Math.cos((p.lat * Math.PI) / 180);
  return { latitude: p.lat, longitude: p.lng, latitudeDelta, longitudeDelta };
}

/** Google's zoom for a region on a map `width` points wide. */
export function zoomOf(r: Region, width: number): number {
  return Math.log2((360 * (width / 256)) / Math.max(1e-9, r.longitudeDelta));
}

/** The clear window's slice of the box, top and bottom as screen fractions
 *  (the web's clearBox): what a load sends as `bounds`, so the server's
 *  circle is the ring drawn. */
export function clearBox(b: Box, top: number, bottom: number): Box {
  const north = mercatorY(b.north);
  const span = north - mercatorY(b.south);
  return { ...b, north: latOfMercatorY(north - span * top), south: latOfMercatorY(north - span * bottom) };
}

/** Great-circle kilometres. */
export function km(a: Point, b: Point): number {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A bar pick stays card one until a load lands this far from it (ANCHOR_DROP_KM). */
export const ANCHOR_DROP_KM = 0.4;
/** Locate reloads only past this from the last load (CATALOG_STALE_MIN_KM). */
export const STALE_KM = 0.2;

/** Is the point inside the view, less the web's VIEW_INSETS (6% top and bottom, 8% sides)? */
export function isVisible(b: Box, p: Point): boolean {
  const h = b.north - b.south;
  const w = b.east - b.west;
  if (!(h > 0) || !(w > 0)) return false;
  return p.lat <= b.north - h * 0.06 && p.lat >= b.south + h * 0.06 && p.lng >= b.west + w * 0.08 && p.lng <= b.east - w * 0.08;
}

/** Within 4% of the view of the sight: a fly would not move (the web's isUnderSight). */
export function isUnderSight(b: Box, p: Point, sightY: number): boolean {
  const h = b.north - b.south;
  const w = b.east - b.west;
  if (!(h > 0) || !(w > 0)) return false;
  const s = sightOf(b, sightY);
  return Math.abs(p.lat - s.lat) <= h * 0.04 && Math.abs(p.lng - s.lng) <= w * 0.04;
}

/** The point under the screen fraction `sightY` (0 top, 1 bottom): the web's viewportSight. */
export function sightOf(b: Box, sightY: number): Point {
  const north = mercatorY(b.north);
  const south = mercatorY(b.south);
  return { lat: latOfMercatorY(north - (north - south) * sightY), lng: (b.east + b.west) / 2 };
}

/** The camera centre that puts `p` under the sight (the web's centerForSight, same scale). */
export function centerForSight(p: Point, b: Box, sightY: number): Point {
  const north = mercatorY(b.north);
  const south = mercatorY(b.south);
  const height = north - south;
  const y = mercatorY(p.lat) + height * (sightY - 0.5);
  return { lat: latOfMercatorY(y), lng: p.lng };
}

/** How much of the last-reload screen a move left: the web's cameraMovedShare. */
export function movedShare(from: Box, to: Box, sightY: number): number {
  const fromH = from.north - from.south;
  const fromW = from.east - from.west;
  if (!(fromH > 0) || !(fromW > 0)) return 1;
  const a = sightOf(from, sightY);
  const b = sightOf(to, sightY);
  let dLng = Math.abs(b.lng - a.lng);
  if (dLng > 180) dLng = 360 - dLng;
  const pan = Math.max(Math.abs(b.lat - a.lat) / fromH, dLng / fromW);
  const toH = to.north - to.south;
  const toW = to.east - to.west;
  const scale = Math.max(Math.abs(toH / fromH - 1), toW > 0 ? Math.abs(toW / fromW - 1) : 0);
  return Math.max(pan, scale);
}

/** Where a point sits on screen, in points, for the map's box and size. */
export function screenOf(p: Point, b: Box, width: number, height: number): { x: number; y: number } {
  const north = mercatorY(b.north);
  const south = mercatorY(b.south);
  return {
    x: ((p.lng - b.west) / Math.max(1e-9, b.east - b.west)) * width,
    y: ((north - mercatorY(p.lat)) / Math.max(1e-9, north - south)) * height,
  };
}

/** A pin name's box beside its pin (the web's estimateLabelRect). */
export const LABEL_LEFT = 9;
export const LABEL_MAX = 168;
export function labelWidth(title: string): number {
  return Math.min(LABEL_MAX, Math.max(24, title.length * 6.2 + 4));
}

type Rect = { left: number; top: number; right: number; bottom: number };

/** Every name that does not overlap another (4 pt apart); the selected pin's
 *  name always wins. The web's pickVisiblePinLabels. */
export function visibleLabels(candidates: { id: string; title: string; x: number; y: number; focused: boolean }[]): Set<string> {
  const sorted = [...candidates].sort((a, b) => (a.focused !== b.focused ? (a.focused ? -1 : 1) : a.id.localeCompare(b.id)));
  const placed: Rect[] = [];
  const visible = new Set<string>();
  for (const c of sorted) {
    const left = c.x + LABEL_LEFT - 4;
    const rect = { left, top: c.y - 8 - 4, right: left + labelWidth(c.title) + 8, bottom: c.y + 8 + 4 };
    const blocked = placed.some((p) => !(rect.right < p.left || p.right < rect.left || rect.bottom < p.top || p.bottom < rect.top));
    if (!blocked || c.focused) {
      visible.add(c.id);
      placed.push(rect);
    }
  }
  return visible;
}
