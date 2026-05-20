import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchPublicVenues, type Venue } from "@/lib/api/venues";
import { GuestDiscoverMap } from "./GuestDiscoverMap";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const supabase = await createServerSupabase();
  let venues: Venue[] = [];
  let fetchError: string | null = null;
  try {
    venues = await apiFetchPublicVenues(supabase, 200);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Couldn't load venues.";
  }

  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
  // Only ship venues that have coordinates (lat + lng both non-null).
  const located = venues.filter(
    (v) => typeof v.lat === "number" && typeof v.lng === "number",
  );

  return (
    <GuestDiscoverMap
      apiKey={mapKey}
      venues={located}
      fetchError={fetchError}
      totalVenues={venues.length}
    />
  );
}
