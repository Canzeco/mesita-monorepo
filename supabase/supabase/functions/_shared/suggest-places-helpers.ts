import type { MapConfig } from "./discovery-config.ts";
import { enabledNearbyTypes } from "./map-engine.ts";
import type { ChannelPolicy } from "./sourcing.ts";

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
// - "legacy": no sourcing channel => static hospitality allowlist
// - "skip": channel disabled / no families => don't call Google
// - "open": sourced search => omit includedPrimaryTypes; post-filter enforces policy
export type GoogleTypeFilter = "legacy" | "skip" | "open";

export function googleTypeFilterForPolicy(
  policy: ChannelPolicy | null,
): GoogleTypeFilter {
  if (!policy) return "legacy";
  if (!policy.enabled || policy.families.length === 0) return "skip";
  return "open";
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
