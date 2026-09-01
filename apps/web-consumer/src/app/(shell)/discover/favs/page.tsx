import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Favorites is parked with the rest of the Discover ladder (MESITA-383: visible,
// tappable, no Soon pill). The rail opens a coming-soon dialog rather than
// navigating, so this page only ever catches a direct URL or an old deep link.
// Un-park = mount the body, which is already on disk, and replace this
// redirect with the real page.
export default function DiscoverFavsPage() {
  redirect(CONSUMER_ROUTES.discoverDefault);
}
