import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Bare /discover lands on the map — the only mode that answers "what is near
// me" without a query. The rail links straight to /discover/map so this hop is
// only ever paid by a direct URL.
export default function DiscoverPage() {
  redirect(CONSUMER_ROUTES.discoverDefault);
}
