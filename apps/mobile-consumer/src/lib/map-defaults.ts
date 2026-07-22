// Shared Google Maps defaults — port of apps/web-consumer/src/lib/map-defaults.ts.
// Monterrey is the launch city; geolocation re-centers when available.

export const MONTERREY_CENTER = { lat: 25.6714, lng: -100.3094 } as const;

// Discover-map pin colours — partners vs scraped web listings.
export const MAP_PARTNER_PIN_COLOR = '#E91E63';
export const MAP_WEB_PIN_COLOR = '#9ca3af';

// Search-map selection pin (held place in the rail).
export const MAP_SELECTED_PIN_COLOR = '#EF4444';
