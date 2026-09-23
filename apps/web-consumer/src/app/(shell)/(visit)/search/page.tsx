import { SearchClient } from "@/components/consumer/search/SearchClient";

export const dynamic = "force-dynamic";

// SEARCH — the map, and the mode that carries the search bar. Named for the
// control rather than the basemap: a found place needs somewhere to land, and
// the pins are that somewhere.
//
// ITS OWN ROUTE (MESITA-1616), moved out from under discover/layout.tsx —
// that nesting kept Home's mode rail rendering above the map here, which was
// a bug (MESITA-1609 promoted the TAB but left the route nested). No shared
// layout with Home any more: just the search bar and the map.
export default function SearchPage() {
  const mapKey = process.env.NEXT_PUBLIC_GMP_KEY ?? "";
  return <SearchClient apiKey={mapKey} />;
}
