import { CatalogRails } from "@/components/consumer/home/CatalogRails";

export const dynamic = "force-dynamic";

// HOME — the catalog rails, browse only (Pato, MESITA-2081: "Home, Scroll,
// Chat, Favs"). The pill reads Home; the address stays Feed's, the same
// label-is-not-a-route shape Pay has at /new-visit.
//
// NO SEARCH BAR, and no client wrapper either: CatalogRails takes no props and
// owns its own fetch, loading, error and empty states, so anything between it
// and the route would be a pass-through. Typing lives on Search.
export default function DiscoverFeedPage() {
  return <CatalogRails />;
}
