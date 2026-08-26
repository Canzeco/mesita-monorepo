// Shared Google Maps defaults — port of apps/web-consumer/src/lib/map-defaults.ts.
// Monterrey is the launch city; geolocation re-centers when available.

export const MONTERREY_CENTER = { lat: 25.6714, lng: -100.3094 } as const;

// Search membership pins — same hexes as the results-row dots (web parity).
export const MAP_PARTNER_PIN_COLOR = '#fb2b7b';
export const MAP_LISTED_PIN_COLOR = '#9ca3af';
export const MAP_GOOGLE_PIN_COLOR = '#EAB308';
export const MAP_WEB_PIN_COLOR = MAP_LISTED_PIN_COLOR;

// Selected pin fill — black circle. Unselected pins keep membership colors.
export const MAP_SELECTED_PIN_COLOR = '#111111';
