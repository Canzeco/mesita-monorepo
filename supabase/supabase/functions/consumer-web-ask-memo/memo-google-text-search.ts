import {
  classifyGoogleError,
  friendlyGoogleError,
  GOOGLE_PLACES_TEXT_SEARCH_URL,
} from "../_shared/google-places.ts";
import {
  applyPlacesTextSearchRegion,
} from "../_shared/sourcing.ts";
import { evaluatePlaceForMap } from "../_shared/map-engine.ts";
import type { MapConfig } from "../_shared/discovery-config.ts";
import { openScore } from "../_shared/local-time.ts";

// The Prediction card contract now lives in _shared/memo-types.ts (shared with
// the admin playground engine). Imported for this file's own use and re-exported
// so downstream local importers (index.ts, memo-answer.ts, memo-catalog-helpers)
// are unchanged.
import type { Prediction, PredictionStatus } from "../_shared/memo-types.ts";
export type { Prediction, PredictionStatus };

export async function googleTextSearch(
  key: string,
  query: string,
  lat: number | null,
  lng: number | null,
  map: MapConfig,
): Promise<Prediction[]> {
  const reqBody: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 10,
  };
  applyPlacesTextSearchRegion(
    reqBody,
    lat !== null && lng !== null ? { lat, lng } : null,
  );

  let r: Response;
  try {
    r = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // openNow lets us demote closed spots at the current hour. No extra
        // billing: rating/userRatingCount already put this call on the
        // Enterprise+Atmosphere SKU; currentOpeningHours is a lower tier.
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.primaryType,places.types,places.currentOpeningHours.openNow",
      },
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    console.error("[ask-memo] google fetch threw:", (e as Error).message);
    return [];
  }

  if (!r.ok) {
    const t = await r.text();
    console.error(
      "[ask-memo] google text search:",
      friendlyGoogleError(classifyGoogleError(r.status, t), r.status, t),
    );
    return [];
  }

  const d = (await r.json()) as {
    places?: {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      rating?: number;
      userRatingCount?: number;
      primaryType?: string;
      types?: string[];
      currentOpeningHours?: { openNow?: boolean };
    }[];
  };

  return (d.places ?? [])
    .filter((p) =>
      evaluatePlaceForMap(map, {
        primaryType: p.primaryType ?? null,
        rating: p.rating ?? null,
        reviewCount: p.userRatingCount ?? null,
      }).eligible
    )
    .map<Prediction>((p) => ({
      placeId: p.id ?? "",
      mainText: p.displayName?.text ?? "",
      secondaryText: p.formattedAddress ?? "",
      status: "not_in_mesita",
      rating: p.rating ?? null,
      ratingCount: p.userRatingCount ?? null,
      openNow: p.currentOpeningHours?.openNow ?? null,
    }))
    .filter((p) => p.placeId && p.mainText)
    // Open-now first (demote, don't drop closed spots), then by rating.
    .sort((a, b) =>
      openScore(b.openNow) - openScore(a.openNow) ||
      (b.rating ?? 0) - (a.rating ?? 0)
    );
}
