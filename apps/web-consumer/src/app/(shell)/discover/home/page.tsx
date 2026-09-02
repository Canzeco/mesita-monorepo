import { CatalogRails } from "@/components/consumer/home/CatalogRails";

export const dynamic = "force-dynamic";

// HOME — the catalog rails, browse only.
//
// NO SEARCH BAR, and no client wrapper either: CatalogRails takes no props and
// owns its own fetch, loading, error and empty states, so anything between it
// and the route would be a pass-through. Typing lives on Search, one pill over
// — two typed inputs one tap apart was the redundancy this split removes.
export default function DiscoverHomePage() {
  return <CatalogRails />;
}
