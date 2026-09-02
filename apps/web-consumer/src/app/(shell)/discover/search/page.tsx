import { SearchClient } from "@/components/consumer/search/SearchClient";

export const dynamic = "force-dynamic";

// SEARCH — the map, and the mode that carries the search bar. Named for the
// control rather than the basemap: a found place needs somewhere to land, and
// the pins are that somewhere.
export default function DiscoverSearchPage() {
  const mapKey = process.env.NEXT_PUBLIC_GMP_KEY ?? "";
  return <SearchClient apiKey={mapKey} />;
}
