import { redirect } from "next/navigation";
import { CONSUMER_ROUTE_PREFIX } from "@/lib/consumer-route-contract";

// Legacy: the Rewards surface moved from /pay to /rewards. Send the bare
// /pay path (and any old bookmark) to the single Rewards page.
export default function LegacyPayPage() {
  redirect(CONSUMER_ROUTE_PREFIX.rewards);
}
