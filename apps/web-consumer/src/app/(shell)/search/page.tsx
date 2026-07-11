import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchPublicPlaces, type Place } from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import { errMsg } from "@/lib/utils";
import { SearchClient } from "@/components/consumer/search/SearchClient";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const supabase = await createServerSupabase();
  let places: Place[] = [];
  let fetchError: string | null = null;
  try {
    places = await apiFetchPublicPlaces(supabase, 200);
  } catch (err) {
    fetchError = errMsg(err, "Couldn't load places.");
  }

  const mapKey = process.env.NEXT_PUBLIC_GMP_KEY ?? "";
  // Derive the overview-parity fields (open_now, zone, rating…) the same
  // way the swipe deck does — the chip filters and rail cards read them —
  // then keep only mappable rows: the rail mirrors the pins one-to-one.
  const located = places
    .map((v) => enrichPlaceOverview(v))
    .filter((v) => typeof v.lat === "number" && typeof v.lng === "number");

  return (
    <SearchClient apiKey={mapKey} places={located} fetchError={fetchError} />
  );
}
