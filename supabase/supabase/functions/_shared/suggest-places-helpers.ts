import {
  NEARBY_TYPE_KEYS,
  type MapConfig,
  type NearbyTypeKey,
} from "./discovery-config.ts";
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
  // Discovery > General inputs (discovery-general-gate.ts). Filled from the
  // Mesita row on an on-Mesita hit, from Place Details on a Google-only one.
  // Never on the wire — `business_status` stays an operator fact.
  businessStatus?: string | null;
  reviewCount?: number | null;
};

// How to constrain Google Autocomplete primary types for this call:
// - "skip": every Map type battery is off => don't call Google
// - "open": omit includedPrimaryTypes; post-filter evaluatePlaceForMap
export type GoogleTypeFilter = "skip" | "open";

/** Skip Google when every type battery is off. */
export function googleTypeFilterForTypes(
  types: Record<NearbyTypeKey, boolean>,
): GoogleTypeFilter {
  return NEARBY_TYPE_KEYS.some((key) => types[key]) ? "open" : "skip";
}

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
          // On Mesita now: the operator's Active is the fact that counts.
          businessStatus: existing.businessStatus ?? p.businessStatus ?? null,
          reviewCount: existing.reviewCount ?? p.reviewCount ?? null,
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

/**
 * Strip the Discovery › General inputs before the response goes out.
 * `business_status` is an OPERATOR fact — place-columns.ts keeps it out of
 * the public payload precisely so no consumer surface gates on it, and a
 * gate input is not a licence to publish it.
 */
export function toWirePrediction(p: Prediction): Prediction {
  const { businessStatus: _bs, reviewCount: _rc, ...wire } = p;
  return wire;
}
