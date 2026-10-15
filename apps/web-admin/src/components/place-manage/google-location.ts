// Google's structured location, shown as the keys Google returned.
// Missing components stay missing. formattedAddress is never split.

export type LocationPair = { key: string; value: string };

type GoogleComponent = { types?: string[]; longText?: string; shortText?: string };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function componentKey(types: string[] | undefined): string | null {
  if (!types) return null;
  const key = types.find((type) => type && type !== "political");
  return key ?? null;
}

export function googleLocationEntries(raw: unknown): LocationPair[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const body = raw as {
    formattedAddress?: unknown;
    location?: { latitude?: unknown; longitude?: unknown };
    addressComponents?: GoogleComponent[];
  };
  const pairs: LocationPair[] = [];
  const formatted = text(body.formattedAddress);
  if (formatted) pairs.push({ key: "formattedAddress", value: formatted });
  const seen = new Set<string>();
  for (const component of body.addressComponents ?? []) {
    const key = componentKey(component.types);
    const value = text(component.longText) ?? text(component.shortText);
    if (!key || !value || seen.has(key)) continue;
    seen.add(key);
    pairs.push({ key, value });
  }
  const lat = body.location?.latitude;
  const lng = body.location?.longitude;
  if (typeof lat === "number" && Number.isFinite(lat)) {
    pairs.push({ key: "location.latitude", value: String(lat) });
  }
  if (typeof lng === "number" && Number.isFinite(lng)) {
    pairs.push({ key: "location.longitude", value: String(lng) });
  }
  return pairs;
}
