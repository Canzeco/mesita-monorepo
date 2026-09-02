// Small pure helpers for the Search surface: session tokens for Google
// Places autocomplete billing, prediction↔catalog matching, the anchored
// searchbar pick, and distance derivation/formatting for the rail cards.

import type { Place } from "@/lib/api/places";
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

// Accent/case-insensitive name key so "Café Nómada" matches "cafe nomada".
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Best-effort resolution of a suggest prediction to a catalog Place.
 *
 * Predictions carry the Google placeId, and the public places projection
 * doesn't expose google_place_id, so the only client-side join available
 * is the (normalized) name. Exact equality ONLY: Mesita-side rows use the
 * place name verbatim as mainText, so equality hits the honest cases,
 * while any substring fallback misroutes look-alikes ("Casa Luminar"
 * contains-matching "Casa Lu"). Predictions the EF stamps with a Mesita
 * id/slug skip this join entirely.
 */
export function matchPredictionToPlace(
  prediction: PlacePrediction,
  places: Place[],
): Place | null {
  const target = normalizeName(prediction.mainText);
  if (!target) return null;
  for (const place of places) {
    if (normalizeName(place.name) === target) return place;
  }
  return null;
}

// ── The anchored searchbar pick (MESITA-1405) ─────────────────────────
//
// EVERY pick anchors the map: camera to the coordinates, catalog reload
// there, and — for a Place — the chosen result as card ONE. The modal is
// one more tap away, on that card or its pin. A Location is a camera
// destination, never a card.

/**
 * Synthesize the rail-card Place for an anchored pick that is not in the
 * nearby snapshot. Mirrors `consumer-web-list-places`' Google stub shape
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
  return {
    id: onMesita ? prediction.mesitaId! : `g:${prediction.placeId}`,
    slug: onMesita
      ? (prediction.mesitaSlug ?? prediction.mesitaId!)
      : prediction.placeId,
    google_place_id: prediction.placeId || null,
    name: prediction.mainText,
    category: null,
    category_label: null,
    vibe: null,
    price_level: null,
    currency: "MXN",
    listing_type: "web",
    status: onMesita ? "active" : "lead",
    fiscal_type: "informal",
    plan: "free",
    partner: prediction.partner ?? false,
    enriched: prediction.enriched ?? false,
    lat: prediction.lat,
    lng: prediction.lng,
    address: prediction.secondaryText || null,
    closes_at: null,
    phone: null,
    pitch: null,
    story: null,
    photos: [],
    website_url: null,
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
    google_maps_url: null,
    email: null,
    created_at: new Date(0).toISOString(),
    ...(onMesita ? {} : { googleOnly: true, from_google: true }),
  } as Place;
}

/** Same entity? id, then the Google spine (a stub's slug IS the place id). */
function samePlaceRow(a: Place, b: Place): boolean {
  if (a.id === b.id) return true;
  const gidA = a.google_place_id ?? (a.googleOnly || a.from_google ? a.slug : null);
  const gidB = b.google_place_id ?? (b.googleOnly || b.from_google ? b.slug : null);
  return Boolean(gidA) && gidA === gidB;
}

/**
 * The chosen result is card ONE, whatever `applyMapFilters` and the How
 * many cap said — the bar does not apply the map's filters, so they never
 * veto a pick. Dedupe decides the total: the anchor already inside the N
 * keeps N unique (the catalog's own richer row wins the slot); outside it
 * the guest sees N + 1 — 21 is correct, not a bug (Pato).
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
 * from the entity's own extent instead of a fixed venue zoom. Null when
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

/** Visible width of a viewport at its center latitude. */
function viewportWidthKm(box: {
  south: number;
  west: number;
  north: number;
  east: number;
}): number {
  const { lat } = viewportCenter(box);
  if (box.west <= box.east) {
    return haversineKm(lat, box.west, lat, box.east);
  }
  return (
    haversineKm(lat, box.west, lat, 180) + haversineKm(lat, -180, lat, box.east)
  );
}

/**
 * Default floor matching discovery_config.map.reloadMinKm. A 110 m cell
 * (`toFixed(3)`) is a few pixels when the city is in frame — that was the
 * hypersensitive reload. 0.5 km is the default reload pair with 2 s;
 * zoomed-out views also require 20% of the visible width so a one-pixel
 * nudge never refetches.
 */
export const CATALOG_RELOAD_MIN_KM = 0.5;
const CATALOG_RELOAD_SPAN_FRACTION = 0.2;
const CATALOG_RELOAD_MIN_KM_MIN = 0.2;
const CATALOG_RELOAD_MIN_KM_MAX = 20;
/** Default wait matching discovery_config.map.reloadMinSec. */
export const CATALOG_RELOAD_MIN_SEC = 2;
const CATALOG_RELOAD_MIN_SEC_MIN = 0.5;
const CATALOG_RELOAD_MIN_SEC_MAX = 15;

export function clampReloadMinKm(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return CATALOG_RELOAD_MIN_KM;
  }
  return Math.min(
    CATALOG_RELOAD_MIN_KM_MAX,
    Math.max(CATALOG_RELOAD_MIN_KM_MIN, raw),
  );
}

export function nearbyReloadThresholdKm(
  spanKm: number,
  minKm: number,
): number {
  const floor = clampReloadMinKm(minKm);
  const fromSpan =
    Number.isFinite(spanKm) && spanKm > 0
      ? spanKm * CATALOG_RELOAD_SPAN_FRACTION
      : 0;
  return Math.max(floor, fromSpan);
}

export function clampReloadMinSec(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return CATALOG_RELOAD_MIN_SEC;
  }
  return Math.min(
    CATALOG_RELOAD_MIN_SEC_MAX,
    Math.max(CATALOG_RELOAD_MIN_SEC_MIN, raw),
  );
}

export function catalogMovedEnough(
  lastCenter: { lat: number; lng: number } | null,
  nextCenter: { lat: number; lng: number },
  box: { south: number; west: number; north: number; east: number },
  minKm: number,
): boolean {
  if (!lastCenter) return true;
  const need = nearbyReloadThresholdKm(viewportWidthKm(box), minKm);
  return (
    haversineKm(lastCenter.lat, lastCenter.lng, nextCenter.lat, nextCenter.lng) >=
    need
  );
}

function catalogWaitedEnough(
  fetchedAtMs: number | null,
  nowMs: number,
  minSec: number,
): boolean {
  if (fetchedAtMs == null) return true;
  return nowMs - fetchedAtMs >= clampReloadMinSec(minSec) * 1000;
}

/** First paint always loads. Later idles need BOTH gates: min km AND min wait. */
export function shouldReloadNearbyCatalog(
  lastCenter: { lat: number; lng: number } | null,
  nextCenter: { lat: number; lng: number },
  box: { south: number; west: number; north: number; east: number },
  minKm: number,
  timing: {
    fetchedAtMs: number | null;
    nowMs: number;
    minSec: number;
  } = { fetchedAtMs: null, nowMs: 0, minSec: 0 },
): boolean {
  if (!lastCenter) return true;
  return (
    catalogMovedEnough(lastCenter, nextCenter, box, minKm) &&
    catalogWaitedEnough(timing.fetchedAtMs, timing.nowMs, timing.minSec)
  );
}

/**
 * GPS recentre gains weight after a short move. 200 m is a couple of
 * city blocks — enough to ignore idle jitter, small enough that a
 * neighborhood shift is obviously "somewhere else."
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
