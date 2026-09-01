// Shared Google Maps defaults for consumer surfaces (discover map + search map).
// Monterrey is the launch city; geolocation re-centers when available.

export const MONTERREY_CENTER = { lat: 25.6714, lng: -100.3094 } as const;

export const MAP_DEFAULT_ZOOM = 13;
export const MAP_USER_ZOOM = 14;

// Light map styling — colour where it matters (blue water, green parks) while
// still hiding Google's own business pins/labels so Mesita's pins own the
// canvas. Roads + locality labels stay for orientation. Inline styles work
// without a mapId.
export const MAP_MINIMAL_STYLES = [
  // Warm cream land base (the brand wash).
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f7f2ec" }],
  },
  // Water reads as real water now — a soft blue, not the old near-white
  // #e9f1f7 that just looked grey.
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#a9d3ec" }],
  },
  // Parks + green space actually look green. The old style blanket-hid every
  // POI (which also hid parks), so instead we flatten the OTHER poi blobs into
  // the land base and colour only parks + natural landcover green.
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#f1ece3" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#c7e7c7" }],
  },
  {
    featureType: "landscape.natural.landcover",
    elementType: "geometry",
    stylers: [{ color: "#dcebd2" }],
  },
  // Hide Google's business pins + all POI text — colour, not label clutter.
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road.local",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.neighborhood",
    stylers: [{ visibility: "off" }],
  },
] as const;

// One circle for every map pin: place (yellow/red/gray) and you-are-here
// (blue). r=10 — big enough to tap, small enough that a cluster still
// shows the map. Selected is a black ring only — never a bigger scale.
// The visible circle sits in a 44px pad so the hit box is a finger, not
// the painted disk. Cursor stays default — never the pointing hand.
export const MAP_PLACE_PIN_RADIUS = 10;
export const MAP_PIN_HIT_SIZE = 44;
export const MAP_PIN_CURSOR = "default";
export const MAP_PIN_STROKE_WEIGHT = 1.75;
export const MAP_PIN_SCALE = 1;
const MAP_CIRCLE_PATH =
  `M -${MAP_PLACE_PIN_RADIUS} 0 A ${MAP_PLACE_PIN_RADIUS} ${MAP_PLACE_PIN_RADIUS} 0 1 0 ${MAP_PLACE_PIN_RADIUS} 0 A ${MAP_PLACE_PIN_RADIUS} ${MAP_PLACE_PIN_RADIUS} 0 1 0 -${MAP_PLACE_PIN_RADIUS} 0`;

export function mapCircleIcon(fillColor: string, strokeColor: string) {
  return {
    path: MAP_CIRCLE_PATH,
    fillColor,
    fillOpacity: 1,
    strokeColor,
    strokeWeight: MAP_PIN_STROKE_WEIGHT,
    scale: MAP_PIN_SCALE,
  };
}

/** SVG for the Search pin: near-invisible full pad + the membership disk. */
export function mapPinSvg(fillColor: string, strokeColor: string): string {
  const size = MAP_PIN_HIT_SIZE;
  const mid = size / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${mid}" cy="${mid}" r="${mid - 0.5}" fill="#000000" fill-opacity="0.01"/>` +
    `<circle cx="${mid}" cy="${mid}" r="${MAP_PLACE_PIN_RADIUS}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${MAP_PIN_STROKE_WEIGHT}"/>` +
    `</svg>`
  );
}

export function mapPinIcon(fillColor: string, strokeColor: string) {
  const size = MAP_PIN_HIT_SIZE;
  const mid = size / 2;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(mapPinSvg(fillColor, strokeColor))}`,
    scaledSize: { width: size, height: size },
    anchor: { x: mid, y: mid },
  };
}

// Search pins — same hexes as the results-row dots. THE LAW, checked in
// this order (Pato, 2026-08-29):
//
//   yellow  Mesita Partner Places   — the place PAYS
//   red     Mesita ENRICHED Places  — we wrote a profile
//   gray    everything else         — Google rows AND our own stubs
//
// Red is EARNED by enrichment. A row existing is not enough: a Created or
// Requested stub has nothing to show, so it promises exactly as much as a
// raw Google row and wears the same gray. Yellow beats red beats gray, so
// an unenriched partner is still yellow.
//
// Blue is the guest's current location and is never a place pin.
export const MAP_PARTNER_PIN_COLOR = "#ffc400";
export const MAP_ENRICHED_PIN_COLOR = "#ff2357";
export const MAP_GOOGLE_PIN_COLOR = "#9ca3af";
export const MAP_USER_LOCATION_PIN_COLOR = "#2563eb";

// Selected pin is a black ring. Fill stays the membership color.
export const MAP_SELECTED_PIN_COLOR = "#111111";
export const MAP_PIN_STROKE_COLOR = "#ffffff";
