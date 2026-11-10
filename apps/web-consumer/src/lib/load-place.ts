import { redirect } from "next/navigation";
import { apiFetchPlaceDetail } from "@/lib/api/places";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { placeGoneHref, toCanonicalPlaceHrefOrNull } from "@/lib/place-route";
import { createServerSupabase } from "@/lib/supabase/server";

// ONE PLACE READ FOR EVERY PLACE ROUTE (MESITA-3648). The full place page,
// its @modal panel twin and the Reserve page each copied these lines: an id
// that is no place address goes Home; a dead id (a reset-away row, a stale
// favorite, an old bookmark) goes Home and says so (<PlaceGoneNotice />).

/** The place an /place/<id> address names, or a redirect Home. */
export async function loadPlaceOrLeave(id: string) {
  if (!toCanonicalPlaceHrefOrNull(id)) redirect(CONSUMER_ROUTES.home);
  const place = await apiFetchPlaceDetail(await createServerSupabase(), id);
  if (!place) redirect(placeGoneHref(CONSUMER_ROUTES.home, id));
  return place;
}
