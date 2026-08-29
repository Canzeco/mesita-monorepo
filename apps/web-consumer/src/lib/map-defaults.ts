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

// One circle for every map pin: place (red/gray) and you-are-here (blue).
// r=7 (was 12) so a cluster still shows the map. Selected is a black
// ring only — never a bigger scale or thicker stroke.
export const MAP_PLACE_PIN_RADIUS = 7;
export const MAP_PIN_STROKE_WEIGHT = 1.75;
export const MAP_PIN_SCALE = 1;
export const MAP_CIRCLE_PATH =
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

// Search pins — same hexes as the results-row dots.
// Yellow = Mesita Partners. Red = Mesita Places. Gray = Google Places.
// Blue = current location.
export const MAP_PARTNER_PIN_COLOR = "#ffc400";
export const MAP_LISTED_PIN_COLOR = "#ff2357";
export const MAP_MESITA_PIN_COLOR = "#ff2357";
export const MAP_GOOGLE_PIN_COLOR = "#9ca3af";
export const MAP_USER_LOCATION_PIN_COLOR = "#2563eb";

// Selected pin is a black ring. Fill stays the membership color.
export const MAP_SELECTED_PIN_COLOR = "#111111";
export const MAP_PIN_STROKE_COLOR = "#ffffff";
