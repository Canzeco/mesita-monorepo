import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Catalog is parked with the rest of Home. Unpark via HomeModeNav + remounting
// CatalogRails (the page body is in git history).
export default function HomeCatalogPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
