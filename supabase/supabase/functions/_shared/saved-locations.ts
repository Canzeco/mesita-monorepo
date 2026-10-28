// Saved locations (MESITA-2400): the row ⇄ wire map shared by
// consumer-web-list-saved-locations and consumer-web-save-location.
//
// The wire shape is the consumer's own `SavedLocation` (apps/web-consumer
// src/lib/saved-locations.ts) minus the derived `name`: camelCase, `namedAt`
// in epoch ms. The row is public.saved_locations (MESITA-2501's field map).

/** At most this many per guest; the consumer's SAVED_LOCATIONS_MAX. */
export const SAVED_LOCATIONS_MAX = 8;

export const SAVED_LOCATION_COLUMNS =
  "id, lat, lng, suggested_name, custom_name, formatted_address, name_edited, named_at, needs_name, unconfirmed, legacy_name, ordered_at";

export type SavedLocationRow = {
  id: string;
  lat: number;
  lng: number;
  suggested_name: string | null;
  custom_name: string | null;
  formatted_address: string | null;
  name_edited: boolean;
  named_at: string | null;
  needs_name: boolean;
  unconfirmed: boolean;
  legacy_name: string | null;
  ordered_at: string;
};

export type SavedLocationWire = {
  id: string;
  lat: number;
  lng: number;
  suggestedName: string | null;
  customName: string | null;
  formattedAddress: string | null;
  kind: "point";
  nameEdited: boolean;
  namedAt: number | null;
  needsName: boolean;
  unconfirmed: boolean;
  legacyName: string | null;
};

export function toWire(row: SavedLocationRow): SavedLocationWire {
  const namedAt = row.named_at ? Date.parse(row.named_at) : NaN;
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    suggestedName: row.suggested_name,
    customName: row.custom_name,
    formattedAddress: row.formatted_address,
    kind: "point",
    nameEdited: row.name_edited,
    namedAt: Number.isFinite(namedAt) ? namedAt : null,
    needsName: row.needs_name,
    unconfirmed: row.unconfirmed,
    legacyName: row.legacy_name,
  };
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** The writable columns of one wire entry, or an error naming the field. */
export function fromWire(
  x: unknown,
): { ok: true; row: Omit<SavedLocationRow, "ordered_at"> } | { ok: false; error: string } {
  if (!x || typeof x !== "object") return { ok: false, error: "location must be an object" };
  const o = x as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id || id.length > 64) return { ok: false, error: "location.id must be 1-64 characters" };
  if (!finite(o.lat) || o.lat < -90 || o.lat > 90) {
    return { ok: false, error: "location.lat must be a latitude" };
  }
  if (!finite(o.lng) || o.lng < -180 || o.lng > 180) {
    return { ok: false, error: "location.lng must be a longitude" };
  }
  // Google's names are kept only with the time they were fetched: the 30-day
  // rule (expire_saved_location_names) runs on named_at.
  const namedAtMs = finite(o.namedAt) && o.namedAt > 0 ? o.namedAt : null;
  return {
    ok: true,
    row: {
      id,
      lat: o.lat,
      lng: o.lng,
      suggested_name: text(o.suggestedName, 200),
      custom_name: text(o.customName, 200),
      formatted_address: text(o.formattedAddress, 400),
      name_edited: o.nameEdited === true,
      named_at: namedAtMs === null ? null : new Date(namedAtMs).toISOString(),
      needs_name: o.needsName === true,
      unconfirmed: o.unconfirmed === true,
      legacy_name: text(o.legacyName, 200),
    },
  };
}
