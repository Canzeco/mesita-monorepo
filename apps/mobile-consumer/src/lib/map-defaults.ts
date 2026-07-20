// Shared Google Maps defaults — port of apps/web-consumer/src/lib/map-defaults.ts.
// Monterrey is the launch city; geolocation re-centers when available.

export const MONTERREY_CENTER = { lat: 25.6714, lng: -100.3094 } as const;

export const MAP_DEFAULT_ZOOM = 13;
export const MAP_USER_ZOOM = 14;

// Light map styling — colour where it matters (blue water, green parks) while
// still hiding Google's own business pins/labels so Mesita's pins own the
// canvas. Roads + locality labels stay for orientation. Applied via
// `customMapStyle` on react-native-maps MapView (Google provider).
export const MAP_MINIMAL_STYLES = [
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f7f2ec' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#a9d3ec' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#f1ece3' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#c7e7c7' }],
  },
  {
    featureType: 'landscape.natural.landcover',
    elementType: 'geometry',
    stylers: [{ color: '#dcebd2' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.neighborhood',
    stylers: [{ visibility: 'off' }],
  },
];

// Discover-map pin colours — partners vs scraped web listings.
export const MAP_PARTNER_PIN_COLOR = '#E91E63';
export const MAP_WEB_PIN_COLOR = '#9ca3af';

// Search-map selection pin (held place in the rail).
export const MAP_SELECTED_PIN_COLOR = '#EF4444';
