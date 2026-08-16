import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Catalog is parked — redirect keeps deep links safe. The route exists so the
// HomeModeNav pill has a real href; unpark by flipping `soon: false` in
// HomeModeNav and rendering the catalog grid here.
export default function HomeCatalogPage() {
  redirect(CONSUMER_ROUTES.homeDefault);
}
