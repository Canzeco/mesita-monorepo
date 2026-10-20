// Frontend API surface for the Search page — live catalog text search +
// the consumer "Add to Mesita" create flow.
//
// Architectural constraints honoured (same as places.ts):
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Each helper calls exactly one Edge Function.
//
// apiSuggestPlaces already lives in ./places (it backs the search add-place
// picker); re-exported here so the Search surface has a single import
// site for both halves of its search→add pipeline.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export {
  apiSuggestPlaces,
  apiSuggestPlacesWithIdle,
  type PlacePrediction,
} from "./places";

/** Where a picked Location lands the camera; viewport decides the zoom. */
export type LocationAnchor = {
  lat: number;
  lng: number;
  viewport: {
    low: { lat: number; lng: number };
    high: { lat: number; lng: number };
  } | null;
};

/**
 * Resolve a picked Location's coordinates — ONE Details call per pick,
 * never per keystroke (MESITA-1403). The map anchor (MESITA-1405)
 * consumes this when a `kind: "location"` row is chosen from the bar.
 */
export async function apiResolveLocationAnchor(
  client: SupabaseClient,
  placeId: string,
): Promise<LocationAnchor> {
  const { anchor } = await invokeEF<{ anchor: LocationAnchor }>(
    client,
    "consumer-web-suggest-places",
    { anchorPlaceId: placeId },
    "Couldn't open that location right now.",
  );
  return anchor;
}

type CreatedProject = {
  ok: boolean;
  /** False when Mesita already held this Google Place ID: the row opens as is. */
  created?: boolean;
  /** The ugly profile (ready, not Enriched), created now or already there. */
  place: { id: string; slug: string; name: string; state: string };
};

/**
 * Create a Google-only search result on Mesita immediately.
 *
 * Calls consumer-web-create-place, which runs Create only (dedupe → Google
 * spine → ready row, enriched_at null). Enricher is not queued. The place
 * modal opens on the Enrich vote tab until the Crenup threshold is hit.
 */
export async function apiCreateProject(
  client: SupabaseClient,
  input: { placeId: string },
): Promise<CreatedProject> {
  // `googlePlaceId` on the wire: `placeId` is reserved for place-row UUIDs
  // platform-wide (MESITA-51 addendum 9).
  return invokeEF<CreatedProject>(
    client,
    "consumer-web-create-place",
    { googlePlaceId: input.placeId },
    "Couldn't add that place right now.",
  );
}

/** An area around the guest (MESITA-2471): a row under "Around you". */
export type NearbyArea = {
  name: string;
  level: "neighborhood" | "district" | "city";
  lat: number;
  lng: number;
  bounds: { low: { lat: number; lng: number }; high: { lat: number; lng: number } };
};

/** Where the guest stands: the neighbourhood's name and the areas around. */
export type HereAnswer = { name: string | null; areas: NearbyArea[] };

const LEVELS = new Set(["neighborhood", "district", "city"]);

function isNearbyArea(a: unknown): a is NearbyArea {
  if (!a || typeof a !== "object") return false;
  const o = a as Record<string, unknown>;
  const b = o.bounds as NearbyArea["bounds"] | undefined;
  return (
    typeof o.name === "string" &&
    !!o.name.trim() &&
    LEVELS.has(o.level as string) &&
    Number.isFinite(o.lat) &&
    Number.isFinite(o.lng) &&
    !!b &&
    Number.isFinite(b.low?.lat) &&
    Number.isFinite(b.low?.lng) &&
    Number.isFinite(b.high?.lat) &&
    Number.isFinite(b.high?.lng)
  );
}

/**
 * Where the guest stands, for Home's location sheet (MESITA-2466,
 * MESITA-2471): the neighbourhood for the Current location row and the
 * areas for "Around you". One Geocoding call per ~110 m point on the
 * server; the caller keeps the answer for the visit. Null when Google had
 * nothing or the call failed: a nicety, never an error in the sheet.
 */
export async function apiReverseGeocode(
  client: SupabaseClient,
  point: { lat: number; lng: number },
): Promise<HereAnswer | null> {
  try {
    const res = await invokeEF<{ name?: unknown; areas?: unknown }>(
      client,
      "consumer-web-reverse-geocode",
      { lat: point.lat, lng: point.lng },
    );
    const name = typeof res.name === "string" && res.name.trim() ? res.name.trim() : null;
    const areas = Array.isArray(res.areas) ? res.areas.filter(isNearbyArea) : [];
    return name || areas.length > 0 ? { name, areas } : null;
  } catch {
    return null;
  }
}

/** What Google says about a saved location's pin (MESITA-2501). */
export type PinNames = { suggestedName: string | null; formattedAddress: string | null };

/**
 * Name a pin the guest is placing (MESITA-2500/2501): the colonia (else the
 * municipio, else "city, state") and the street, at the server's ~11 m pin
 * snap. Throws an `EFError` whose `code` says whether to try again
 * (`classifyThrown` in `lib/pin-picker-state.ts`); an answer with neither
 * name is the terminal `no_area_name`.
 */
export async function apiReverseGeocodePin(
  client: SupabaseClient,
  point: { lat: number; lng: number },
): Promise<PinNames> {
  const res = await invokeEF<{ suggestedName?: unknown; formattedAddress?: unknown }>(
    client,
    "consumer-web-reverse-geocode",
    { lat: point.lat, lng: point.lng, precision: "pin" },
  );
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return { suggestedName: text(res.suggestedName), formattedAddress: text(res.formattedAddress) };
}
