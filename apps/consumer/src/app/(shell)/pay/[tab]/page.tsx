import { redirect } from "next/navigation";
import { CONSUMER_ROUTE_PREFIX } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Legacy catch-all for the old tab segments (/pay/qr, /pay/tickets) plus
// /pay/wallet and /pay/balance — all land on the single /rewards page.
// Ticket detail (/pay/ticket/[id], /pay/tickets/[id]) are more specific
// routes and redirect to their /rewards/ticket/[id] equivalent.
export default function LegacyPayTabPage() {
  redirect(CONSUMER_ROUTE_PREFIX.rewards);
}
