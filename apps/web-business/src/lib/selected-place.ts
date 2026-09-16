// THE SELECTED PLACE — the console's memory, read once per request
// (MESITA-1832).
//
// Thirteen addresses carry no id (/profile, /settings, /products, …). Which
// place they are about is the same answer the rail gives (lib/rail-scope.ts,
// client): the place remembered in the rail cookie, if the caller still holds
// it — else the first place they hold. A remembered place the caller holds NO
// membership on is a pool place opened from the catalogue: it is selected as
// FOREIGN and the place layout shows it read-only (Profile alone), exactly as
// /places/<id> does.
//
// ONE COOKIE NOW (MESITA-1892). There were two, and the second one — which
// organization — is what the first used to be checked against. The
// organization is gone, so the check is a membership lookup in a flat list.
//
// `cache()`d so the (place) layout and the page beneath it pay one read.
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiMyPlaces, type ConsolePlace } from "@/lib/api/console";
import { findPlace, pickPlace } from "@/lib/active-place";
import { RAIL_PLACE_COOKIE, plausibleId } from "@/lib/sidebar-prefs";

export type Selection = {
  places: ConsolePlace[];
  /** The selected place's id. Null when the caller holds none. */
  placeId: string | null;
  /** True when `placeId` is one the caller holds no membership on: a pool
   *  place, or one they released. */
  foreign: boolean;
};

export const getSelection = cache(async (): Promise<Selection> => {
  const supabase = await createServerSupabase();
  const places = await apiMyPlaces(supabase);
  const jar = await cookies();
  const rememberedPlaceId = plausibleId(jar.get(RAIL_PLACE_COOKIE)?.value);

  const held = findPlace(places, rememberedPlaceId);
  if (held) return { places, placeId: held.id, foreign: false };
  if (rememberedPlaceId) {
    // Remembered but held by nobody the caller is: a pool place, or a released
    // one. The place layout asks get-place; a 404 there ends the visit.
    return { places, placeId: rememberedPlaceId, foreign: true };
  }
  return { places, placeId: pickPlace(places)?.id ?? null, foreign: false };
});
