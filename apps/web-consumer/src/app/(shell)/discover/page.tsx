import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Bare /discover lands on Search — the map, the one mode that answers "what is
// near me" with no query at all. The rail links straight to /discover/search so
// this hop is only ever paid by a direct URL.
export default function DiscoverPage() {
  redirect(CONSUMER_ROUTES.discoverDefault);
}
