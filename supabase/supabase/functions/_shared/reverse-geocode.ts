// Reverse geocode: the guest's point → the neighbourhood's name (MESITA-2466).
//
// consumer-web-reverse-geocode answers Home's location sheet, whose Current
// location row reads "Current location · Tecnológico". One Google Geocoding
// call per snapped point: the point is rounded to 3 decimals (~110 m) first,
// so a guest who has not moved, or many guests on one block, share one call.
// The pure parts live here; the EF owns the fetch and the isolate cache.

/** Decimals kept before the call: 3 ≈ 110 m of latitude. */
export const REVERSE_GEOCODE_DECIMALS = 3;

/** The point a call is made (and cached) for. */
export function snapPoint(lat: number, lng: number): { lat: number; lng: number } {
  const f = 10 ** REVERSE_GEOCODE_DECIMALS;
  return { lat: Math.round(lat * f) / f, lng: Math.round(lng * f) / f };
}

/** The cache key of a snapped point. */
export function pointKey(p: { lat: number; lng: number }): string {
  return `${p.lat.toFixed(REVERSE_GEOCODE_DECIMALS)},${p.lng.toFixed(REVERSE_GEOCODE_DECIMALS)}`;
}

/** A usable WGS84 point, or null. */
export function readPoint(body: { lat?: unknown; lng?: unknown }): { lat: number; lng: number } | null {
  const { lat, lng } = body;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Most local first: a neighbourhood beats a sublocality beats a city. */
const LEVELS = [
  "neighborhood",
  "sublocality_level_1",
  "sublocality",
  "locality",
] as const;

/** Google's placeholder for an unnamed block ("Sin Nombre 34", "Sin Nombre de
 *  Col 46"): never a name to show; the next level up answers instead. */
const PLACEHOLDER = /^sin nombre\b/i;

type Component = { long_name?: unknown; short_name?: unknown; types?: unknown };
type GeocodeResult = { address_components?: unknown };

/** The most local name in a Geocoding API answer, or null. */
export function pickAreaName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return null;
  const components: Component[] = [];
  for (const r of results as GeocodeResult[]) {
    if (Array.isArray(r?.address_components)) {
      components.push(...(r.address_components as Component[]));
    }
  }
  for (const level of LEVELS) {
    for (const c of components) {
      if (
        Array.isArray(c.types) &&
        c.types.includes(level) &&
        typeof c.long_name === "string" &&
        c.long_name.trim() &&
        !PLACEHOLDER.test(c.long_name.trim())
      ) {
        return c.long_name.trim();
      }
    }
  }
  return null;
}

/** Google's top-level status, e.g. "OK", "ZERO_RESULTS", "REQUEST_DENIED". */
export function geocodeStatus(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "INVALID";
  const s = (payload as { status?: unknown }).status;
  return typeof s === "string" ? s : "INVALID";
}

/** The Geocoding reverse URL for a snapped point. */
export function reverseGeocodeUrl(p: { lat: number; lng: number }, key: string): string {
  const q = new URLSearchParams({
    latlng: pointKey(p),
    result_type: LEVELS.join("|"),
    language: "es",
    key,
  });
  return `https://maps.googleapis.com/maps/api/geocode/json?${q.toString()}`;
}
