import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Bare /discover lands on the default pill, Scroll (the deck at
// /discover/scroll, MESITA-2140). The rail links straight there, so this hop is
// only ever paid by a direct URL.
export default function DiscoverPage() {
  redirect(CONSUMER_ROUTES.discoverDefault);
}
