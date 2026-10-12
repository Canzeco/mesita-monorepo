import { CatalogRails } from "@/components/consumer/home/CatalogRails";

export const dynamic = "force-dynamic";

// PLACES — Home's lead pill (Pato, MESITA-2166: "Places. Social. Chat.
// Favs."): the catalog as rails, browse only. CatalogRails takes no props and
// owns its own fetch, loading, error and empty states, so anything between it
// and the route would be a pass-through. Typing lives on Search.
export default function DiscoverPlacesPage() {
  return <CatalogRails />;
}
