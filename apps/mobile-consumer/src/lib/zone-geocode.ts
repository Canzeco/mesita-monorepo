// Resolve a Google Places prediction (place_id) → a discovery ZONE center,
// client-side (MESITA-672). Follows the same Pato-directed exception the
// GooglePlaceSheet uses: a direct Google Places (New) Details call with the
// public NEXT_PUBLIC_GMP_KEY — Google's API, not our DB, nothing persisted,
// display-only — so the Where filter can center distances on a searched area
// (any level: address → neighborhood → city → state → country) without a new
// Edge Function. The autocomplete itself still runs through the EF
// (consumer-web-suggest-places); only the chosen prediction is geocoded here.

import type {
  DiscoveryZone,
  DiscoveryZoneLevel,
} from "@/lib/discovery-filters-engine";

// Google `types` → our hierarchy level, most specific first (a place carries
// several types, e.g. ["locality","political"], so order decides the winner).
function levelFromTypes(
  types: string[] | undefined,
): DiscoveryZoneLevel | undefined {
  if (!types || types.length === 0) return undefined;
  const has = (t: string) => types.includes(t);
  if (has("street_address") || has("premise") || has("subpremise"))
    return "address";
  if (has("route")) return "street";
  if (has("neighborhood") || types.some((t) => t.startsWith("sublocality")))
    return "neighborhood";
  if (has("locality") || has("postal_town")) return "city";
  if (has("administrative_area_level_2")) return "county";
  if (has("administrative_area_level_1")) return "state";
  if (has("country")) return "country";
  return undefined;
}

/**
 * Fetch the center point of a Google place_id. Returns null when the key is
 * missing or the response carries no usable location; throws on a network /
 * non-OK response so the caller can surface a retry toast. `fallbackLabel` is
 * the prediction's own text, used when Google returns no displayName.
 */
export async function resolveZoneFromPlaceId(
  placeId: string,
  apiKey: string,
  fallbackLabel: string,
): Promise<DiscoveryZone | null> {
  if (!placeId || !apiKey) return null;
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
      `?fields=location,displayName,formattedAddress,types&key=${apiKey}`,
  );
  if (!res.ok) throw new Error(`places details ${res.status}`);
  const data = (await res.json()) as {
    location?: { latitude?: number; longitude?: number };
    displayName?: { text?: string };
    formattedAddress?: string;
    types?: string[];
  };
  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const label =
    data.displayName?.text?.trim() ||
    fallbackLabel.trim() ||
    data.formattedAddress?.trim() ||
    "Selected location";
  return { label, lat, lng, level: levelFromTypes(data.types) };
}
