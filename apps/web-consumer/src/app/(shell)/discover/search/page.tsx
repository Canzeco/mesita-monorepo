import { DiscoverSearchClient } from "@/components/consumer/discover/DiscoverSearchClient";

export const dynamic = "force-dynamic";

// Name — search Mesita places by name, as a list. The Google key is read
// server-side, same as the map's page: GooglePlaceSheet needs it for the
// photo, and a client-side env read would not see it.
export default function DiscoverSearchPage() {
  const mapKey = process.env.NEXT_PUBLIC_GMP_KEY ?? "";
  return <DiscoverSearchClient apiKey={mapKey} />;
}
