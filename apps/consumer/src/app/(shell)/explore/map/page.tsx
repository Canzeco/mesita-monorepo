import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchPublicPlaces, type Place } from "@/lib/api/places";
import { errMsg } from "@/lib/utils";
import { ConsumerDiscoverMap } from "../../discover/map/ConsumerDiscoverMap";

export const dynamic = "force-dynamic";

export default async function ExploreMapPage() {
  const supabase = await createServerSupabase();
  let places: Place[] = [];
  let fetchError: string | null = null;
  try {
    places = await apiFetchPublicPlaces(supabase, 200);
  } catch (err) {
    fetchError = errMsg(err, "Couldn't load places.");
  }

  const mapKey = process.env.NEXT_PUBLIC_GMP_KEY ?? "";
  const located = places.filter(
    (v) => typeof v.lat === "number" && typeof v.lng === "number",
  );

  return (
    <ConsumerDiscoverMap
      apiKey={mapKey}
      places={located}
      fetchError={fetchError}
      totalPlaces={places.length}
    />
  );
}
