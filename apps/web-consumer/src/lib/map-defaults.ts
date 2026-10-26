// Shared Google Maps defaults for consumer surfaces (discover map + search map).
// Monterrey is the launch city; geolocation re-centers when available.

export const MONTERREY_CENTER = { lat: 25.6714, lng: -100.3094 } as const;

export const MAP_DEFAULT_ZOOM = 13;
export const MAP_USER_ZOOM = 14;

// A QUIET MAP (Pato, MESITA-2469: "think the apple or instagram
// aesthetic"; MESITA-2748: parks must actually read green, like OpenTable /
// Apple Maps, not grey paper). Apple Maps' trick: the tiles step back so
// the pins carry the colour. Land is warm paper, water a clear grey-blue,
// parks mint you can see, roads white. Google's business pins/labels stay
// hidden so Mesita's pins own the canvas. Inline styles work without a mapId.
export const MAP_MINIMAL_STYLES = [
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f6f3ee" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9d9e8" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6e8496" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeae4" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#cde8c8" }],
  },
  {
    featureType: "landscape.natural.landcover",
    elementType: "geometry",
    stylers: [{ color: "#dcead4" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#ece6dc" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7a7a7a" }],
  },
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: "#5c5c5c" }],
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

// One circle for every map pin: place (red/ink/gray) and you-are-here
// (blue). r=7 (Pato, MESITA-2757: "make the dots a bit smaller"; was 10)
// — the 44px pad keeps it tappable, and a cluster still shows the map. Every place pin wears a thin dark ring (Pato, 2026-10-19,
// MESITA-2482: "dark border, not a white border"); selected is the same
// ring drawn thicker — never a bigger scale.
// The visible circle sits in a 44px pad so the hit box is a finger, not
// the painted disk. Cursor stays default — never the pointing hand.
export const MAP_PLACE_PIN_RADIUS = 7;
/** Mesita Selected mark (gate d4a): slightly larger disk on the map. */
export const MAP_SELECTED_PLACE_PIN_RADIUS = 9;
export const MAP_PIN_HIT_SIZE = 44;
export const MAP_PIN_CURSOR = "default";
export const MAP_PIN_STROKE_WEIGHT = 1.25;
export const MAP_SELECTED_PIN_STROKE_WEIGHT = 3;

/** Boost's ⚡ badge (MESITA-2789): a white disk with an ink bolt at the
 *  pin's upper right, on any tone. It marks paid visibility; the disk's
 *  colour stays the set law (red is Selected alone). */
export const MAP_BOOST_BADGE_COLOR = "#111111";

/** SVG for the Search pin: near-invisible full pad + the coloured disk,
 *  and the ⚡ badge when the place is boosted. */
export function mapPinSvg(
  fillColor: string,
  strokeColor: string,
  strokeWeight: number = MAP_PIN_STROKE_WEIGHT,
  radius: number = MAP_PLACE_PIN_RADIUS,
  boosted = false,
): string {
  const size = MAP_PIN_HIT_SIZE;
  const mid = size / 2;
  // The badge sits on the disk's upper-right edge: 6px radius, a bolt
  // drawn in its own 12px box.
  const bx = mid + radius * 0.75;
  const by = mid - radius * 0.75;
  const badge = boosted
    ? `<circle cx="${bx}" cy="${by}" r="6" fill="#ffffff" stroke="${MAP_BOOST_BADGE_COLOR}" stroke-width="1"/>` +
      `<path transform="translate(${bx - 6} ${by - 6})" d="M6.8 2 3.2 6.8h2.6L5.2 10l3.6-4.8H6.2L6.8 2z" fill="${MAP_BOOST_BADGE_COLOR}"/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${mid}" cy="${mid}" r="${mid - 0.5}" fill="#000000" fill-opacity="0.01"/>` +
    `<circle cx="${mid}" cy="${mid}" r="${radius}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWeight}"/>` +
    badge +
    `</svg>`
  );
}

export function mapPinIcon(
  fillColor: string,
  strokeColor: string,
  strokeWeight: number = MAP_PIN_STROKE_WEIGHT,
  radius: number = MAP_PLACE_PIN_RADIUS,
  boosted = false,
) {
  const size = MAP_PIN_HIT_SIZE;
  const mid = size / 2;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(mapPinSvg(fillColor, strokeColor, strokeWeight, radius, boosted))}`,
    scaledSize: { width: size, height: size },
    anchor: { x: mid, y: mid },
  };
}

// Search pins — same hexes as the results-row dots. THE LAW (Pato,
// 2026-10-12, MESITA-2158; 2026-10-18, MESITA-2316):
//
//   red     Mesita Selected Places  — the operator's own mark
//   gray    everything else         — a Mesita place without the mark and
//                                     a Google row alike
//
// The paint IS the set law, not a second opinion about it:
//
//   Google Places ⊃ Mesita Places ⊃ Mesita Selected Places
//
// Red is the operator's: Mesita Selected is `places.selected`, set from
// Single Place and nowhere else (MESITA-2707; Pato: "selected is the manual
// thing … independent of enrichment"). Until MESITA-2707 red was earned by
// an Enrich run; enrichment now paints nothing on the map. The brand-ink
// middle tone is gone (MESITA-2316).
//
// Blue is the guest's current location and is never a place pin.
export const MAP_MESITA_SELECTED_PIN_COLOR = "#ff2357";
// Google grey is a TRUE neutral (chroma 0); the old #9ca3af was a cool
// blue-grey that read as "disabled" on the map (MESITA-2469).
export const MAP_GOOGLE_PIN_COLOR = "#a3a3a3";
// iOS systemBlue: the one blue on the screen, and it means "you"
// (MESITA-2469; was Tailwind #2563eb).
export const MAP_USER_LOCATION_PIN_COLOR = "#007aff";

// Place pins ring dark. A SELECTED pin changes colour (Pato, MESITA-2488:
// "the selected place changes color"): ink fill, white ring, thicker — so it
// reads against both the red and the gray. The blue you-are-here dot keeps a
// white ring (iOS).
export const MAP_SELECTED_PIN_COLOR = "#111111";
export const MAP_SELECTED_PIN_STROKE_COLOR = "#ffffff";
export const MAP_PIN_STROKE_COLOR = "#111111";
export const MAP_USER_LOCATION_STROKE_COLOR = "#ffffff";
