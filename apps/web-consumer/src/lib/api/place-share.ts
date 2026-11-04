// A guest shared a place (MESITA-3206): Business Views counts it. Only a
// Mesita place has a row to count against, so a Google-only card is skipped.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMesitaPlaceId } from "./activity";
import { invokeEF } from "./_invoke";

export async function apiTrackPlaceShare(client: SupabaseClient, placeId: string): Promise<void> {
  if (!isMesitaPlaceId(placeId)) return;
  await invokeEF(client, "consumer-web-track-place-share", { place_id: placeId });
}
