import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Catalog stays Soon (Pato, 2026-08-27). Swipe is the live place deck until
// the listed set is thick enough for rails. Unpark via HomeModeNav + remounting
// CatalogRails (the page body is on disk).
export default function HomeCatalogPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
