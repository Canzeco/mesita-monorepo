import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchPublicVenues, type Venue } from "@/lib/api/venues";
import { errMsg } from "@/lib/utils";
import { ConsumerDiscoverMap } from "./ConsumerDiscoverMap";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const supabase = await createServerSupabase();
  let venues: Venue[] = [];
  let fetchError: string | null = null;
  try {
    venues = await apiFetchPublicVenues(supabase, 200);
  } catch (err) {
    fetchError = errMsg(err, "Couldn't load venues.");
  }

  const mapKey = process.env.NEXT_PUBLIC_GMP_KEY ?? "";
  // Only ship venues that have coordinates (lat + lng both non-null).
  const located = venues.filter(
    (v) => typeof v.lat === "number" && typeof v.lng === "number",
  );

  return (
    <ConsumerDiscoverMap
      apiKey={mapKey}
      venues={located}
      fetchError={fetchError}
      totalVenues={venues.length}
    />
  );
}
