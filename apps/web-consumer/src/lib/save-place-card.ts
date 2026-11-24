import type { SupabaseClient } from "@supabase/supabase-js";
import { isMesitaPlaceId } from "@/lib/api/activity";
import { apiFetchPlaceCard } from "@/lib/api/places";
import { addSavedPlaceCard, readSavedPlacePreviews } from "@/lib/saved-places";

/** Saved draws a place from its cached card. A save made where there is no
 *  list card (the profile's heart, a save finished after Sign) reads it once;
 *  a failed read leaves it to the next shell sync (MESITA-4917). */
export function fetchSavedPlaceCard(supabase: SupabaseClient, id: string): void {
  if (!isMesitaPlaceId(id) || readSavedPlacePreviews().has(id)) return;
  void apiFetchPlaceCard(supabase, id).then((card) => {
    if (card) addSavedPlaceCard(card);
  });
}
