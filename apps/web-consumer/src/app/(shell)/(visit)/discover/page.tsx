import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Bare /discover lands on Visit's default pill, Home (the Scroll deck). The
// rail links straight to /discover/scroll, so this hop is only ever paid by a
// direct URL.
export default function DiscoverPage() {
  redirect(CONSUMER_ROUTES.discoverDefault);
}
