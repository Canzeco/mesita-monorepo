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

// ── Around you (MESITA-2471) ──────────────────────────────────────────────
// Instagram's Add location shows places around you before you type. The
// same Geocoding answer already holds one result per level (neighbourhood,
// district, city), each with its viewport: those are the sheet's "Around
// you" rows, at no extra call. A tap saves the row as an AREA.

/** An area around the guest, ready to save as an Area location. */
export type NearbyArea = {
  name: string;
  level: "neighborhood" | "district" | "city";
  lat: number;
  lng: number;
  bounds: { low: { lat: number; lng: number }; high: { lat: number; lng: number } };
};

/** At most this many rows under the search field. */
export const NEARBY_AREAS_MAX = 4;
/** The Area pipeline drops a rectangle wider than this (parseAreaBounds). */
export const NEARBY_AREA_MAX_KM = 100;

const LEVEL_WORD: Record<(typeof LEVELS)[number], NearbyArea["level"]> = {
  neighborhood: "neighborhood",
  sublocality_level_1: "district",
  sublocality: "district",
  locality: "city",
};

function latLng(x: unknown): { lat: number; lng: number } | null {
  if (!x || typeof x !== "object") return null;
  const { lat, lng } = x as { lat?: unknown; lng?: unknown };
  return typeof lat === "number" && Number.isFinite(lat) &&
      typeof lng === "number" && Number.isFinite(lng)
    ? { lat, lng }
    : null;
}

function diagonalKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The areas a Geocoding answer names around the point: most local first,
 *  one per name, no placeholders, none wider than the Area pipeline takes. */
export function pickNearbyAreas(payload: unknown): NearbyArea[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const found: { area: NearbyArea; rank: number }[] = [];
  for (const r of results as Record<string, unknown>[]) {
    const types = Array.isArray(r?.types) ? (r.types as unknown[]) : [];
    const rank = LEVELS.findIndex((l) => types.includes(l));
    if (rank < 0) continue;
    const level = LEVELS[rank];
    const comps = Array.isArray(r.address_components)
      ? (r.address_components as Component[])
      : [];
    const comp = comps.find(
      (c) => Array.isArray(c.types) && c.types.includes(level) && typeof c.long_name === "string",
    );
    const name = typeof comp?.long_name === "string" ? comp.long_name.trim() : "";
    if (!name || PLACEHOLDER.test(name)) continue;
    const geometry = (r.geometry ?? {}) as { location?: unknown; viewport?: unknown };
    const at = latLng(geometry.location);
    const vp = (geometry.viewport ?? {}) as { southwest?: unknown; northeast?: unknown };
    const low = latLng(vp.southwest);
    const high = latLng(vp.northeast);
    if (!at || !low || !high) continue;
    if (!(low.lat < high.lat && low.lng < high.lng)) continue;
    if (diagonalKm(low, high) > NEARBY_AREA_MAX_KM) continue;
    found.push({
      area: { name, level: LEVEL_WORD[level], lat: at.lat, lng: at.lng, bounds: { low, high } },
      rank,
    });
  }
  found.sort((a, b) => a.rank - b.rank);
  const seen = new Set<string>();
  const out: NearbyArea[] = [];
  for (const { area } of found) {
    const k = area.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(area);
    if (out.length >= NEARBY_AREAS_MAX) break;
  }
  return out;
}
