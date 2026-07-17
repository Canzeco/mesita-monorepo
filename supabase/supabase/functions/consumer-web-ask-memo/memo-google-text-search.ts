import {
  classifyGoogleError,
  friendlyGoogleError,
  GOOGLE_PLACES_TEXT_SEARCH_URL,
} from "../_shared/google-places.ts";
import {
  type ChannelPolicy,
  evaluatePlaceForChannel,
} from "../_shared/sourcing.ts";
import { openScore } from "../_shared/local-time.ts";

export type PredictionStatus =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

// Mirrors the consumer PlacePrediction contract (see consumer-web-suggest-
// places) so the same PredictionRow renders these with no client changes.
// `rating`/`ratingCount` are Memo extras the client may ignore.
export type Prediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: PredictionStatus;
  mesitaId?: string;
  mesitaSlug?: string;
  // Memo extra: Google's live open/closed state, used to demote closed spots
  // at the current local hour (null = unknown, don't penalise).
  rating?: number | null;
  ratingCount?: number | null;
  openNow?: boolean | null;
};

const GOOGLE_RADIUS_M = 8000;

export async function googleTextSearch(
  key: string,
  query: string,
  lat: number | null,
  lng: number | null,
  memoPolicy: ChannelPolicy,
): Promise<Prediction[]> {
  const reqBody: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 10,
    regionCode: "MX",
  };
  if (lat !== null && lng !== null) {
    reqBody.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: GOOGLE_RADIUS_M,
      },
    };
  }

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
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.primaryType,places.types,places.currentOpeningHours.openNow",
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
      rating?: number;
      userRatingCount?: number;
      primaryType?: string;
      types?: string[];
      currentOpeningHours?: { openNow?: boolean };
    }[];
  };

  return (d.places ?? [])
    .filter((p) =>
      evaluatePlaceForChannel(memoPolicy, {
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
