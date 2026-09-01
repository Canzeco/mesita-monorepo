// Shared Google Maps defaults — port of apps/web-consumer/src/lib/map-defaults.ts.
// Monterrey is the launch city; geolocation re-centers when available.

export const MONTERREY_CENTER = { lat: 25.6714, lng: -100.3094 } as const;

// Search membership pins — same hexes as the results-row dots (web parity).
// Yellow Partners, red Mesita Places, gray Google.
export const MAP_PARTNER_PIN_COLOR = '#ffc400';
export const MAP_LISTED_PIN_COLOR = '#ff2357';
export const MAP_GOOGLE_PIN_COLOR = '#9ca3af';
export const MAP_PIN_STROKE_COLOR = '#ffffff';
export const MAP_PLACE_PIN_DIAMETER = 20;
export const MAP_PIN_HIT_SIZE = 44;

// Selected pin is a black ring. Fill stays the membership color.
export const MAP_SELECTED_PIN_COLOR = '#111111';
