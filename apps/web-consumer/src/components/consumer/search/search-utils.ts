// Small pure helpers for the Search surface: session tokens for Google
// Places autocomplete billing, prediction↔catalog matching by id, the anchored
// searchbar pick, and distance derivation/formatting for the rail cards.

import type { MapBounds, Place } from "@/lib/api/places";
import { stripInsecurePhotos } from "@/lib/api/places";
import type { LocationAnchor, PlacePrediction } from "@/lib/api/place-search";
import { haversineKm } from "@/lib/utils";

// Stable per-page-session token, passed on every consumer-suggest-places
// call so Google bills the autocomplete keystrokes as one session.
export function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Resolution of a suggest prediction to a catalog Place, by identity only:
 * the Mesita id the EF stamps on a held hit, else the Google Place ID. Never
 * by name — Google's name is canonical and the Mesita name is display only
 * (MESITA-2896, MESITA-2907). A Google-only row carries its Place ID as its
 * slug.
 */
export function matchPredictionToPlace(
  prediction: PlacePrediction,
  places: Place[],
): Place | null {
  if (prediction.mesitaId) {
    const held = places.find((p) => p.id === prediction.mesitaId);
    if (held) return held;
  }
  const googleId = prediction.placeId;
  if (!googleId) return null;
  return (
    places.find(
      (p) =>
        (p.google_place_id ??
          (p.googleOnly || p.from_google ? p.slug : null)) === googleId,
    ) ?? null
  );
}

// ── The anchored searchbar pick (MESITA-1405) ─────────────────────────
//
// EVERY pick anchors the map: camera to the coordinates, catalog reload
// there, and — for a Place — the chosen result as card ONE. The modal is
// one more tap away, on that card or its pin. A Location is a camera
// destination, never a card.

/**
 * Synthesize the rail-card Place for an anchored pick that is not in the
 * nearby snapshot. Mirrors the server's Google stub shape (`google-stub.ts`)
 * (`g:<placeId>` id, slug = the Google place id) so the pin/card second
 * tap flows through the exact same open paths as a catalog row. Returns
 * null without coordinates — a camera cannot anchor nowhere.
 */
export function anchorPlaceFromPrediction(
  prediction: PlacePrediction,
): Place | null {
  if (
    typeof prediction.lat !== "number" ||
    typeof prediction.lng !== "number"
  ) {
    return null;
  }
  const onMesita = Boolean(prediction.mesitaId);
  // Every place pick carries its card (MESITA-2678): a Google-only row the
  // stub Text Search sends (MESITA-2325), a Mesita row its own catalog card. Its
  // facts fill the draft; identity and coordinates stay the pick's.
  const card: Partial<Place> = prediction.card ?? {};
  return {
    ...card,
    id: onMesita ? prediction.mesitaId! : `g:${prediction.placeId}`,
    slug: onMesita
      ? (prediction.mesitaSlug ?? prediction.mesitaId!)
      : prediction.placeId,
    google_place_id: prediction.placeId || null,
    name: prediction.mainText,
    category: card.category ?? null,
    category_label: card.category_label ?? null,
    price_level: card.price_level ?? null,
    currency: card.currency ?? "MXN",
    enriched: prediction.enriched ?? false,
    // Premier rides the prediction too (MESITA-2925): the synthesized
    // card's pin and mark keep the lane's answer.
    boost_tier: prediction.boost_tier ?? card.boost_tier ?? 0,
    lat: prediction.lat,
    lng: prediction.lng,
    address: card.address ?? (prediction.secondaryText || null),
    closes_at: null,
    phone: card.phone ?? null,
    pitch: null,
    story: null,
    // A Mesita card's photos draw, https only (an http one crashes
    // next/image); a Google-only card never shows a photo (MESITA-2298).
    photos: onMesita
      ? stripInsecurePhotos({
          photos: Array.isArray(card.photos) ? card.photos : [],
        }).photos
      : [],
    website_url: card.website_url ?? null,
    instagram_url: null,
    facebook_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    x_url: null,
    threads_url: null,
    reddit_url: null,
    didi_food_url: null,
    google_maps_url: card.google_maps_url ?? null,
    created_at: new Date(0).toISOString(),
    ...(onMesita ? {} : { googleOnly: true, from_google: true }),
  } as Place;
}

/** Same entity? id, then the Google spine (a stub's slug IS the place id). */
function samePlaceRow(a: Place, b: Place): boolean {
  if (a.id === b.id) return true;
  const gidA =
    a.google_place_id ?? (a.googleOnly || a.from_google ? a.slug : null);
  const gidB =
    b.google_place_id ?? (b.googleOnly || b.from_google ? b.slug : null);
  return Boolean(gidA) && gidA === gidB;
}

/**
 * The chosen result is card ONE, whatever the operator cap said — the
 * bar does not apply the map's filters, so they never veto a pick. Dedupe
 * decides the total: the anchor already inside the N keeps N unique
 * (the catalog's own richer row wins the slot); outside it the guest sees
 * N + 1 — 21 is correct, not a bug (Pato). The one pick that never reaches
 * here as a card is a Google place under the Area floor (`underFloor`,
 * MESITA-2849): SearchClient anchors it with no place, like a Location.
 */
export function prependAnchorPlace(
  places: Place[],
  anchor: Place | null,
): Place[] {
  if (!anchor) return places;
  const own = places.find((p) => samePlaceRow(p, anchor));
  const rest = places.filter((p) => !samePlaceRow(p, anchor));
  return [own ?? anchor, ...rest];
}

/**
 * A reload centered away from the anchored place ends the anchor: the
 * guest moved on, and a far-away card one would misorder the new set. A
 * reload AT the place (its own forced load, a filter refetch there) keeps
 * it. 0.4 km sits under the 0.5 km drag-reload floor, so any genuine
 * travel clears and the pick's own load never does.
 */
export const ANCHOR_DROP_KM = 0.4;

export function anchorSurvivesReload(
  anchor: { lat: number | null; lng: number | null },
  loadedCenter: { lat: number; lng: number },
): boolean {
  if (typeof anchor.lat !== "number" || typeof anchor.lng !== "number") {
    return false;
  }
  return (
    haversineKm(anchor.lat, anchor.lng, loadedCenter.lat, loadedCenter.lng) <
    ANCHOR_DROP_KM
  );
}

/**
 * A Location's Details viewport → the bounds the camera should fit: a
 * city opens wide, a neighbourhood close — `fitBounds` derives the zoom
 * from the entity's own extent instead of a fixed place zoom. Null when
 * the viewport is missing; the caller falls back to a plain pan.
 */
export function anchorViewportBounds(
  viewport: LocationAnchor["viewport"],
): { south: number; west: number; north: number; east: number } | null {
  if (!viewport) return null;
  return {
    south: viewport.low.lat,
    west: viewport.low.lng,
    north: viewport.high.lat,
    east: viewport.high.lng,
  };
}

/**
 * Where the map's sight sits, as a share of the map's height from its top
 * (Pato, MESITA-2448: "put the cruz more at the top … the carousel is
 * taking some space at the bottom"); 45% (MESITA-2505); THE MIDDLE since
 * MESITA-2514 ("circle must be veritcally centered"): the rail has its own
 * band under the map since MESITA-2506, so nothing covers the bottom, and
 * the ring's gaps above and below are equal. The crosshair draws here,
 * every viewport load is centred here, and a camera centre puts its target
 * here.
 */
// 0.38 since MESITA-2672 (Pato: "the cross must be vertically aligned as if
// the carousel were still in its own box"): the carousel floats over the
// map's foot since MESITA-2670, ~150px of a ~600px map on a phone, so the
// middle of the map above it sits ~38% down.
export const SIGHT_Y = 0.38;

const mercatorY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOfMercatorY = (y: number) =>
  ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

/** The point under the sight: SIGHT_Y down the view, Mercator-exact. */
export function viewportSight(box: {
  south: number;
  west: number;
  north: number;
  east: number;
}): { lat: number; lng: number } {
  const { lng } = viewportCenter(box);
  const north = mercatorY(box.north);
  const south = mercatorY(box.south);
  return { lat: latOfMercatorY(north - (north - south) * SIGHT_Y), lng };
}

/** The camera centre that puts `target` under the sight, for a view `scale`
 *  times as tall as `box` (a zoom change halves or doubles it). */
export function centerForSight(
  box: { south: number; north: number },
  target: { lat: number; lng: number },
  scale = 1,
): { lat: number; lng: number } {
  const span = (mercatorY(box.north) - mercatorY(box.south)) * scale;
  return {
    lat: latOfMercatorY(mercatorY(target.lat) - span * (0.5 - SIGHT_Y)),
    lng: target.lng,
  };
}

type Box = { south: number; west: number; north: number; east: number };

/** The visible map as the EF's `bounds` (MESITA-2499). Null when the box
 *  crosses the dateline or is degenerate, which the EF cannot read: that
 *  load falls back to its centre inside the operator's radius. */
export function boxBounds(box: Box | null): MapBounds | null {
  if (!box) return null;
  const ok = [box.south, box.west, box.north, box.east].every(Number.isFinite);
  if (!ok || !(box.south < box.north) || !(box.west < box.east)) return null;
  return {
    low: { lat: box.south, lng: box.west },
    high: { lat: box.north, lng: box.east },
  };
}

/** The search ring's share of the cross's distance to the nearest edge, so
 *  it never touches the map's border (Pato, MESITA-2825: "add border
 *  margin"). The client mirror of the EF's SCREEN_RING_INSET. */
export const RING_INSET = 0.9;

/**
 * The screen radius the NEXT load would send (MESITA-2512): RING_INSET of
 * the cross's distance to the nearest edge of `box`, km — the client mirror of the
 * EF's `screenRadiusKm` (MESITA-2511), at least 0.05, no ceiling (MESITA-2918). Null with no view,
 * across the dateline, or a cross off the view.
 */
export function viewRadiusKm(
  box: Box | null,
  cross: { lat: number; lng: number } | null,
): number | null {
  if (!boxBounds(box) || !box || !cross) return null;
  if (
    cross.lat < box.south ||
    cross.lat > box.north ||
    cross.lng < box.west ||
    cross.lng > box.east
  ) {
    return null;
  }
  const r = Math.min(
    haversineKm(cross.lat, cross.lng, cross.lat, box.west),
    haversineKm(cross.lat, cross.lng, cross.lat, box.east),
    haversineKm(cross.lat, cross.lng, box.south, cross.lng),
    haversineKm(cross.lat, cross.lng, box.north, cross.lng),
  );
  return Number.isFinite(r) ? Math.max(0.05, r * RING_INSET) : null;
}

/** The view `box` becomes once `target` sits under the sight at the same
 *  zoom (MESITA-2499): a load that leaves before its camera move lands (a
 *  fix, the disc, a place pick) asks for the map the guest is about to see.
 *  Null across the dateline. */
export function boxAtSight(
  box: Box | null,
  target: { lat: number; lng: number },
): Box | null {
  if (!box || !(box.west < box.east)) return null;
  const center = centerForSight(box, target);
  const half = (mercatorY(box.north) - mercatorY(box.south)) / 2;
  const halfLng = (box.east - box.west) / 2;
  return {
    south: latOfMercatorY(mercatorY(center.lat) - half),
    north: latOfMercatorY(mercatorY(center.lat) + half),
    west: center.lng - halfLng,
    east: center.lng + halfLng,
  };
}

/**
 * Camera center of a map viewport. west > east is the dateline wrap.
 */
export function viewportCenter(box: {
  south: number;
  west: number;
  north: number;
  east: number;
}): { lat: number; lng: number } {
  const lat = (box.south + box.north) / 2;
  if (box.west <= box.east) {
    return { lat, lng: (box.west + box.east) / 2 };
  }
  const span = 180 - box.west + (box.east + 180);
  let lng = box.west + span / 2;
  if (lng > 180) lng -= 360;
  return { lat, lng };
}

/**
 * Has the guest's fix left the loaded catalog behind? 200 m is a couple
 * of city blocks — enough to ignore GPS jitter, small enough that a
 * neighborhood shift is obviously "somewhere else." Read only when the
 * camera was asked to move there (first load, the location disc).
 */
const CATALOG_STALE_MIN_KM = 0.2;

export function catalogIsStale(
  lastCenter: { lat: number; lng: number } | null,
  nextCenter: { lat: number; lng: number },
  minKm = CATALOG_STALE_MIN_KM,
): boolean {
  if (!lastCenter) return false;
  return (
    haversineKm(
      lastCenter.lat,
      lastCenter.lng,
      nextCenter.lat,
      nextCenter.lng,
    ) >= minKm
  );
}

/** Which rail page is centered. Page width is 80% of the rail. */
export function railCenterIndex(
  scrollLeft: number,
  pageWidth: number,
  count: number,
): number {
  if (count <= 0 || pageWidth <= 0) return 0;
  return Math.max(0, Math.min(Math.round(scrollLeft / pageWidth), count - 1));
}

/** First catalog card is selected until a pin or a scroll picks another.
 *  A stale id (an auto-reload replaced the set) falls back to the first card. */
/**
 * Centre the rail card for the selected place?
 *
 * A flick that already parked on the card must NOT be re-centred —
 * scrollIntoView would fight the finger, so the pager naming the card
 * (`idx === railIndex`) normally means "leave it alone". A TAP overrides
 * that (Pato, 2026-08-29): opening a collapsed rail leaves railIndex
 * stale at 0, so card 0 looked already-centred and the tap scrolled
 * nothing. The guest tapped a pin and the carousel did not move.
 */
export function shouldCenterRailCard(
  idx: number,
  railIndex: number,
  tapped: boolean,
): boolean {
  if (idx < 0) return false;
  if (tapped) return true;
  return idx !== railIndex;
}

export function defaultRailSelection(
  ids: readonly string[],
  current: string | null,
): string | null {
  if (ids.length === 0) return null;
  if (current && ids.includes(current)) return current;
  return ids[0] ?? null;
}

/**
 * Fill distance_km from a center (the map camera for Search, or the
 * consumer's live location). Real data only — places without coordinates
 * (or before the geolocation grant) keep distance_km null and the chip
 * simply hides.
 */
export function withDistances(
  places: Place[],
  userLocation: { lat: number; lng: number } | null,
): Place[] {
  if (!userLocation) return places;
  return places.map((place) => {
    if (typeof place.lat !== "number" || typeof place.lng !== "number") {
      return place;
    }
    const km = haversineKm(
      userLocation.lat,
      userLocation.lng,
      place.lat,
      place.lng,
    );
    return { ...place, distance_km: Math.round(km * 10) / 10 };
  });
}
