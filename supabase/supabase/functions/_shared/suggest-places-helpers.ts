import type { MapConfig } from "./discovery-config.ts";
import { enabledNearbyTypes } from "./map-engine.ts";

export type PredictionStatus =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

export type Prediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: PredictionStatus;
  // Present only on on-Mesita rows (status !== "not_in_mesita"):
  // profiles id + slug so clients can navigate directly to the
  // place instead of fuzzy-matching by name. Google-only predictions
  // omit both.
  mesitaId?: string;
  mesitaSlug?: string;
};

// How to constrain Google Autocomplete primary types for this call:
// - "skip": every Map type battery is off => don't call Google
// - "open": omit includedPrimaryTypes; post-filter evaluatePlaceForMap
export type GoogleTypeFilter = "skip" | "open";

/** Discovery › Map: skip Google when every type battery is off. */
export function googleTypeFilterForMap(map: MapConfig): GoogleTypeFilter {
  return enabledNearbyTypes(map).length === 0 ? "skip" : "open";
}

export function mergePredictionsByPlaceId(
  googlePreds: Prediction[],
  mesitaPreds: Prediction[],
): Map<string, Prediction> {
  const byPlaceId = new Map<string, Prediction>();
  for (const p of mesitaPreds) byPlaceId.set(p.placeId, p);
  for (const p of googlePreds) {
    const existing = byPlaceId.get(p.placeId);
    byPlaceId.set(
      p.placeId,
      existing
        ? {
          ...p,
          status: existing.status,
          mesitaId: existing.mesitaId,
          mesitaSlug: existing.mesitaSlug,
        }
        : p,
    );
  }
  return byPlaceId;
}

export function sortMesitaPredictionsFirst(
  predictions: Prediction[],
): Prediction[] {
  return [...predictions].sort((a, b) => {
    const aIn = a.status !== "not_in_mesita";
    const bIn = b.status !== "not_in_mesita";
    return aIn === bIn ? 0 : aIn ? -1 : 1;
  });
}
