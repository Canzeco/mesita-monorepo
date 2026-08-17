import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Catalog is parked (Pato, 2026-08-16: only Swipe and Favorites are
// functional). The redirect keeps deep links safe.
//
// The grid is BUILT and working — see CatalogGrid, which this page rendered
// until it was re-parked. Un-parking is two edits: flip `soon: false` on the
// Catalog tab in HomeModeNav and restore the two-line body here:
//
//   const { places, fetchError } = useHomeDeck();
//   return <CatalogGrid places={places} fetchError={fetchError} />;
export default function HomeCatalogPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
