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

// SVG circle path for place markers + the user location dot.
export const MAP_CIRCLE_PATH = "M -12 0 A 12 12 0 1 0 12 0 A 12 12 0 1 0 -12 0";

// Search membership pins — same hexes as the results-row dots.
// Partner = Mesita pink.500 (Pato's "red"); listed = gray; Google-only = yellow.
export const MAP_PARTNER_PIN_COLOR = "#fb2b7b";
export const MAP_LISTED_PIN_COLOR = "#9ca3af";
export const MAP_GOOGLE_PIN_COLOR = "#EAB308";
/** @deprecated Use MAP_LISTED_PIN_COLOR — kept so older map surfaces compile. */
export const MAP_WEB_PIN_COLOR = MAP_LISTED_PIN_COLOR;

// Selected pin used to force a red fill. Search now keeps membership color
// and thickens the stroke instead.
export const MAP_SELECTED_PIN_COLOR = "#EF4444";
