// Consumer Search name-bar: membership is the colored point only.
// Yellow = Mesita Partners. Red = Mesita Places. Gray = Google Places.
// Hexes match map pins in lib/map-defaults.ts. Selected pin is a black ring;
// the fill stays the membership color.

import {
  MAP_GOOGLE_PIN_COLOR,
  MAP_LISTED_PIN_COLOR,
  MAP_PARTNER_PIN_COLOR,
  MAP_PIN_STROKE_COLOR,
  MAP_SELECTED_PIN_COLOR,
} from "@/lib/map-defaults";

export type MembershipTone = "partner" | "listed" | "google";

export const MEMBERSHIP_COLORS: Record<MembershipTone, string> = {
  partner: MAP_PARTNER_PIN_COLOR,
  listed: MAP_LISTED_PIN_COLOR,
  google: MAP_GOOGLE_PIN_COLOR,
};

export function membershipTone(item: {
  status?: string | null;
  partner?: boolean | null;
}): MembershipTone {
  if (item.status === "not_in_mesita") return "google";
  if (item.partner) return "partner";
  return "listed";
}

export function membershipColor(tone: MembershipTone): string {
  return MEMBERSHIP_COLORS[tone];
}

export function pinFillColor(tone: MembershipTone, _selected = false): string {
  return membershipColor(tone);
}

export function pinStrokeColor(selected: boolean): string {
  return selected ? MAP_SELECTED_PIN_COLOR : MAP_PIN_STROKE_COLOR;
}

/** First tap selects; a later tap on the same pin opens. Not a timed dblclick. */
export function pinGesture(
  selectedId: string | null,
  pinId: string,
): "select" | "open" {
  return selectedId === pinId ? "open" : "select";
}

/** Overlay map-pin tap. First tap holds (black ring); later tap opens.
 *  Overlay-only Mesita (not in the catalog snapshot) never opens on select —
 *  stash the prediction and keep the overlay. Google stash is the same hold. */
export type OverlayPinAction =
  | "select-google"
  | "select-mesita-catalog"
  | "select-mesita-overlay"
  | "open-google"
  | "open-catalog"
  | "open-mesita-slug"
  | "noop";

export function overlayPinDecision(input: {
  selectedId: string | null;
  pinId: string;
  googleOnly: boolean;
  inCatalog: boolean;
  hasOverlay: boolean;
}): OverlayPinAction {
  const gesture = pinGesture(input.selectedId, input.pinId);
  if (gesture === "open") {
    if (input.googleOnly) return "open-google";
    if (input.inCatalog) return "open-catalog";
    if (input.hasOverlay) return "open-mesita-slug";
    return "noop";
  }
  if (input.googleOnly) return "select-google";
  if (input.inCatalog) return "select-mesita-catalog";
  if (input.hasOverlay) return "select-mesita-overlay";
  return "noop";
}

export function placeMembershipTone(place: {
  partner?: boolean | null;
  plan?: string | null;
  googleOnly?: boolean;
  from_google?: boolean;
}): MembershipTone {
  if (place.googleOnly || place.from_google) return "google";
  if (place.partner === true) return "partner";
  if (place.partner === false) return "listed";
  if (place.plan && place.plan.toLowerCase() !== "free") return "partner";
  return "listed";
}

/** Live-search overlay pins. Catalog is coords only — tone follows the EF row
 *  so the list dot and the map pin cannot disagree. Empty coords → null so
 *  the map keeps catalog markers instead of blanking. */
export type SearchPinPrediction = {
  placeId: string;
  mainText: string;
  status?: string | null;
  partner?: boolean | null;
  mesitaId?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type SearchPinPlace = {
  id: string;
  lat?: number | null;
  lng?: number | null;
};

export type BuiltSearchPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  tone: MembershipTone;
};

export function buildSearchMapPins(
  predictions: SearchPinPrediction[],
  catalog: SearchPinPlace[],
): BuiltSearchPin[] | null {
  if (predictions.length === 0) return null;
  const byId = new Map(catalog.map((place) => [place.id, place]));
  const pins: BuiltSearchPin[] = [];
  for (const prediction of predictions) {
    const hit = prediction.mesitaId ? byId.get(prediction.mesitaId) : undefined;
    const lat = prediction.lat ?? hit?.lat ?? null;
    const lng = prediction.lng ?? hit?.lng ?? null;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    pins.push({
      id: prediction.mesitaId ?? prediction.placeId,
      lat,
      lng,
      title: prediction.mainText,
      tone: membershipTone(prediction),
    });
  }
  return pins.length > 0 ? pins : null;
}
