// Shared Google Maps defaults for consumer surfaces (discover map + search map).
// Monterrey is the launch city; geolocation re-centers when available.

export const MONTERREY_CENTER = { lat: 25.6714, lng: -100.3094 } as const;

export const MAP_DEFAULT_ZOOM = 13;
export const MAP_USER_ZOOM = 14;

// Minimalist map styling — hide Google POIs so Mesita pins own the canvas.
// Roads + locality labels stay for orientation. Inline styles work without a mapId.
export const MAP_MINIMAL_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
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
  { featureType: "water", stylers: [{ color: "#e9f1f7" }] },
  { featureType: "landscape", stylers: [{ color: "#f7f2ec" }] },
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
export const MAP_CIRCLE_PATH =
  "M -12 0 A 12 12 0 1 0 12 0 A 12 12 0 1 0 -12 0";

// Discover-map pin colours — partners vs scraped web listings.
export const MAP_PARTNER_PIN_COLOR = "#E91E63";
export const MAP_WEB_PIN_COLOR = "#9ca3af";

// Search-map selection pin (held place in the rail).
export const MAP_SELECTED_PIN_COLOR = "#EF4444";
