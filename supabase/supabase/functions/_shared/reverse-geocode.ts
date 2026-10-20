// Reverse geocode: the guest's point → the neighbourhood's name (MESITA-2466).
//
// consumer-web-reverse-geocode answers Home's location sheet, whose Current
// location row reads "Current location · Tecnológico". One Google Geocoding
// call per snapped point: the point is rounded to 3 decimals (~110 m) first,
// so a guest who has not moved, or many guests on one block, share one call.
// A `pin` request (MESITA-2500) names a saved location's pin instead: 4
// decimals, an unfiltered call, and a suggested name plus a street.
// The pure parts live here; the EF owns the fetch and the isolate cache.

/** Decimals kept before the call: 3 ≈ 110 m of latitude. */
export const REVERSE_GEOCODE_DECIMALS = 3;
/** A saved pin (MESITA-2500) is named at 4 decimals (~11 m): at 110 m a pin
 *  near a colonia's edge could take the neighbouring colonia's name. */
export const PIN_DECIMALS = 4;

/** Which question a request asks: `std` names where the guest stands (the
 *  sheet's Current location row and Around you); `pin` names a pin the guest
 *  is placing on a map (Home's saved locations). */
export type Precision = "std" | "pin";

/** The body's `precision`: absent = std, "pin" = pin, anything else = null
 *  (the caller answers `bad_precision`). */
export function readPrecision(body: { precision?: unknown }): Precision | null {
  const p = body.precision;
  if (p === undefined || p === null) return "std";
  return p === "pin" ? "pin" : null;
}

export function precisionDecimals(precision: Precision): number {
  return precision === "pin" ? PIN_DECIMALS : REVERSE_GEOCODE_DECIMALS;
}

/** The point a call is made (and cached) for. */
export function snapPoint(
  lat: number,
  lng: number,
  decimals = REVERSE_GEOCODE_DECIMALS,
): { lat: number; lng: number } {
  const f = 10 ** decimals;
  return { lat: Math.round(lat * f) / f, lng: Math.round(lng * f) / f };
}

/** The `latlng` of a snapped point. */
export function pointKey(p: { lat: number; lng: number }, decimals = REVERSE_GEOCODE_DECIMALS): string {
  return `${p.lat.toFixed(decimals)},${p.lng.toFixed(decimals)}`;
}

/** The isolate cache key: the precision first, so a pin and a std answer for
 *  the same digits never share an entry (the pin answer is unfiltered). */
export function cacheKey(p: { lat: number; lng: number }, precision: Precision): string {
  return `${precision}:${pointKey(p, precisionDecimals(precision))}`;
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

/** The Geocoding reverse URL for a snapped point. `std` asks only for the
 *  area levels (unchanged since MESITA-2466); `pin` asks for everything, so
 *  the answer also carries the street, the municipio and the state. */
export function reverseGeocodeUrl(
  p: { lat: number; lng: number },
  key: string,
  precision: Precision = "std",
): string {
  const q = new URLSearchParams({ latlng: pointKey(p, precisionDecimals(precision)) });
  if (precision === "std") q.set("result_type", LEVELS.join("|"));
  q.set("language", "es");
  q.set("key", key);
  return `https://maps.googleapis.com/maps/api/geocode/json?${q.toString()}`;
}

// ── A pin's names (MESITA-2500) ─────────────────────────────────────────
// Pato (2026-10-20): a saved location's suggested name is the colonia under
// the FINAL pin, then the municipality, then city + state, then the client's
// "Saved location"; its second line is the street. Both come from the same
// unfiltered answer. `results[0]` is Google's best match for the exact
// point, so it is read first: later results can belong to the next address
// or to the colonia across the street.

type Result = { types?: unknown; address_components?: unknown };

function resultsOf(payload: unknown): Result[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  return Array.isArray(results) ? (results as Result[]) : [];
}

function componentsOf(r: Result): Component[] {
  return Array.isArray(r.address_components) ? (r.address_components as Component[]) : [];
}

function hasType(x: { types?: unknown }, type: string): boolean {
  return Array.isArray(x.types) && x.types.includes(type);
}

/** A component's name, unless it is blank or Google's placeholder. */
function usableName(c: Component | undefined, field: "long_name" | "short_name"): string | null {
  const v = c?.[field];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && !PLACEHOLDER.test(t) ? t : null;
}

/** The first usable component of `type`: `results[0]` first, then the rest. */
function firstOfType(
  results: Result[],
  type: string,
  field: "long_name" | "short_name" = "long_name",
): string | null {
  for (const r of results) {
    for (const c of componentsOf(r)) {
      if (!hasType(c, type)) continue;
      const n = usableName(c, field);
      if (n) return n;
    }
  }
  return null;
}

/** A pin's suggested name: colonia → municipio → "city, state" → null (the
 *  client then shows "Saved location"). */
export function pickSuggestedName(payload: unknown): string | null {
  const results = resultsOf(payload);
  for (const level of ["neighborhood", "sublocality_level_1", "sublocality"]) {
    const colonia = firstOfType(results, level);
    if (colonia) return colonia;
  }
  const municipio = firstOfType(results, "administrative_area_level_2");
  if (municipio) return municipio;
  const city = firstOfType(results, "locality");
  const state = firstOfType(results, "administrative_area_level_1", "short_name");
  return city && state ? `${city}, ${state}` : null;
}

const ADDRESS_TYPES = ["street_address", "premise", "route"];

/** A pin's street: "<route> <number>", the route alone, or null. Read from
 *  the first address-like result only, so two neighbouring addresses never
 *  mix. */
export function pickFormattedAddress(payload: unknown): string | null {
  const hit = resultsOf(payload).find((r) => ADDRESS_TYPES.some((t) => hasType(r, t)));
  if (!hit) return null;
  const comps = componentsOf(hit);
  const route = usableName(comps.find((c) => hasType(c, "route")), "long_name");
  if (!route) return null;
  const number = usableName(comps.find((c) => hasType(c, "street_number")), "long_name");
  return number ? `${route} ${number}` : route;
}

// ── Around you (MESITA-2471) ──────────────────────────────────────────────
// Instagram's Add location shows places around you before you type. The
// same Geocoding answer already holds one result per level (neighbourhood,
// district, city), each with its viewport: those are the sheet's "Around
// you" rows, at no extra call. Since MESITA-2500 a row is only a starting
// point for the pin picker; its rectangle frames the camera, never a search.

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
/** An area wider than this is never offered under "Around you". */
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
 *  one per name, no placeholders, none wider than NEARBY_AREA_MAX_KM. */
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
