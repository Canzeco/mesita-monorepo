// Saved locations on the server (MESITA-2400): the guest's own pins, read
// and written back. One helper per call, each one Edge Function. The store
// itself (cache, write-through, first-sync push) is lib/saved-locations.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { SavedLocation } from "@/lib/saved-locations";

/** The guest's pins, newest first, as stored (read through readStoredLocations). */
export async function apiListSavedLocations(client: SupabaseClient): Promise<unknown[]> {
  const { locations } = await invokeEF<{ locations: unknown[] }>(
    client,
    "consumer-web-list-saved-locations",
    {},
  );
  return Array.isArray(locations) ? locations : [];
}

/** Insert or replace one pin; `front` moves it to the front of the list. */
export async function apiUpsertSavedLocation(
  client: SupabaseClient,
  location: SavedLocation,
  front: boolean,
): Promise<void> {
  await invokeEF(client, "consumer-web-save-location", {
    op: "upsert",
    front,
    location: {
      id: location.id,
      lat: location.lat,
      lng: location.lng,
      suggestedName: location.suggestedName,
      customName: location.customName,
      formattedAddress: location.formattedAddress,
      nameEdited: location.nameEdited,
      namedAt: location.namedAt,
      needsName: location.needsName,
      unconfirmed: location.unconfirmed,
      legacyName: location.legacyName,
    },
  });
}

export async function apiRemoveSavedLocation(client: SupabaseClient, id: string): Promise<void> {
  await invokeEF(client, "consumer-web-save-location", { op: "remove", id });
}
